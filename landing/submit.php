<?php
/**
 * ModelMarket — Manejador del formulario de la beta (Plesk / PHP).
 *
 * Recibe el envío del formulario (JSON), valida, verifica reCAPTCHA v3, avisa al equipo
 * en hola@modelmarket.es y envía al interesado un correo de agradecimiento con el logo.
 *
 * El envío de correo se hace con RESEND (no con mail() de PHP): mail() entrega bien en
 * local — de ahí que el aviso al equipo llegara — pero los correos a destinatarios
 * externos (Gmail, etc.) se pierden o van a spam sin SPF/DKIM del dominio remitente.
 * Resend envía con autenticación real, igual que la app.
 *
 * No depende de la app ni de Supabase: es autónomo. Ajusta la CONFIGURACIÓN de abajo.
 * Requiere la extensión cURL de PHP (activa por defecto en Plesk).
 */

// ============================ CONFIGURACIÓN ============================
$TO_EMAIL         = 'hola@modelmarket.es';                 // destino de los avisos
$FROM_EMAIL       = 'no-reply@modelmarket.es';             // remitente: debe ser de un DOMINIO VERIFICADO en Resend
$FROM_NAME        = 'ModelMarket';
$BASE_URL         = 'https://TU-DOMINIO';                  // sin barra final; para el logo del email
$RESEND_API_KEY   = 're_XXXXXXXXXXXXXXXXXXXXXXXX';         // tu API key de Resend (empieza por re_)
$RECAPTCHA_SECRET = '';                                     // clave SECRETA v3 (vacío = no se verifica)
$RECAPTCHA_MIN    = 0.5;                                    // umbral de score v3
// ======================================================================

header('Content-Type: application/json; charset=utf-8');

function fail($msg, $code = 400) {
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg]);
  exit;
}
function ok($data = []) {
  echo json_encode(array_merge(['ok' => true], $data));
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  fail('Método no permitido', 405);
}

// --- Leer el cuerpo (JSON o formulario clásico) ---
$raw = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
  $body = $_POST;
}

$name     = trim($body['name'] ?? '');
$email    = trim($body['email'] ?? '');
$comments = trim($body['comments'] ?? '');
$privacy  = !empty($body['privacy']);
$token    = $body['recaptchaToken'] ?? null;

// --- Validación ---
if (mb_strlen($name) < 2 || mb_strlen($name) > 100) {
  fail('Introduce tu nombre y apellidos.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 120) {
  fail('Introduce un email válido.');
}
if (mb_strlen($comments) > 1000) {
  fail('Los comentarios son demasiado largos.');
}
if (!$privacy) {
  fail('Debes aceptar la Política de Privacidad.');
}

// --- Verificación reCAPTCHA v3 (si hay clave configurada) ---
if ($RECAPTCHA_SECRET !== '') {
  if (!$token) {
    fail('Falta la verificación anti-spam.', 403);
  }
  $verify = @file_get_contents(
    'https://www.google.com/recaptcha/api/siteverify?' . http_build_query([
      'secret'   => $RECAPTCHA_SECRET,
      'response' => $token,
      'remoteip' => $_SERVER['REMOTE_ADDR'] ?? '',
    ])
  );
  $result = json_decode($verify, true);
  if (empty($result['success']) || (isset($result['score']) && $result['score'] < $RECAPTCHA_MIN)) {
    fail('No hemos podido verificar que no eres un robot. Inténtalo de nuevo.', 403);
  }
}

// --- Utilidades de email ---
function esc($s) {
  return htmlspecialchars($s, ENT_QUOTES, 'UTF-8');
}

/**
 * Envía un email HTML vía la API de Resend. Devuelve [ok(bool), error(string|null)].
 * Resend maneja UTF-8 en asuntos de forma nativa, así que no hace falta codificarlo.
 */
function send_resend($to, $subject, $html, $fromEmail, $fromName, $apiKey, $replyTo = null) {
  $payload = [
    'from'    => $fromName . ' <' . $fromEmail . '>',
    'to'      => [$to],
    'subject' => $subject,
    'html'    => $html,
  ];
  if ($replyTo) {
    $payload['reply_to'] = $replyTo;
  }

  $ch = curl_init('https://api.resend.com/emails');
  curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_HTTPHEADER     => [
      'Authorization: Bearer ' . $apiKey,
      'Content-Type: application/json',
    ],
    CURLOPT_POSTFIELDS     => json_encode($payload),
    CURLOPT_TIMEOUT        => 15,
  ]);
  $response = curl_exec($ch);
  $status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  $curlErr  = curl_error($ch);
  curl_close($ch);

  if ($curlErr) {
    return [false, 'cURL: ' . $curlErr];
  }
  if ($status < 200 || $status >= 300) {
    return [false, 'Resend ' . $status . ': ' . $response];
  }
  return [true, null];
}

/** Maquetación "Blueprint" común (cabecera blanca con logo + franja naranja). */
function layout($baseUrl, $heading, $bodyHtml) {
  $logo = esc($baseUrl) . '/logo.png';
  return '<!doctype html><html lang="es"><body style="margin:0;background:#F4F6F9;padding:24px;font-family:Arial,Helvetica,sans-serif;">'
    . '<div style="max-width:520px;margin:0 auto;background:#ffffff;border:2px solid #E1E7EF;border-radius:6px;overflow:hidden;box-shadow:4px 4px 0 0 #E1E7EF;">'
    . '<div style="background:#ffffff;padding:20px 24px 16px;border-bottom:3px solid #F7941D;">'
    . '<img src="' . $logo . '" alt="ModelMarket" width="200" style="display:block;border:0;width:200px;max-width:100%;height:auto;" /></div>'
    . '<div style="padding:24px;">'
    . '<h1 style="margin:0 0 12px;color:#1B3A5F;font-size:20px;line-height:1.3;">' . $heading . '</h1>'
    . $bodyHtml
    . '</div>'
    . '<div style="background:#F9FAFB;border-top:1px solid #E1E7EF;padding:14px 24px;color:#5B6B7B;font-size:12px;">ModelMarket — Nada de comisiones, sólo maquetas.</div>'
    . '</div></body></html>';
}

// --- 1) Aviso al equipo (hola@modelmarket.es) ---
$adminBody =
  '<p style="margin:0 0 8px;color:#1A2733;font-size:15px;"><strong>Nombre:</strong> ' . esc($name) . '</p>'
  . '<p style="margin:0 0 8px;color:#1A2733;font-size:15px;"><strong>Email:</strong> ' . esc($email) . '</p>'
  . '<p style="margin:0 0 6px;color:#1A2733;font-size:15px;"><strong>Comentarios:</strong></p>'
  . '<div style="border-top:1px solid #E1E7EF;padding-top:10px;color:#1A2733;font-size:15px;line-height:1.6;white-space:pre-line;">'
  . ($comments !== '' ? esc($comments) : '<em style="color:#5B6B7B;">(sin comentarios)</em>')
  . '</div>'
  . '<p style="margin:16px 0 0;color:#5B6B7B;font-size:12px;">Responde a este correo para contactar directamente con la persona.</p>';

[$adminOk, $adminErr] = send_resend(
  $TO_EMAIL,
  'Nueva solicitud de beta — ' . $name,
  layout($BASE_URL, 'Nueva solicitud de beta', $adminBody),
  $FROM_EMAIL,
  $FROM_NAME,
  $RESEND_API_KEY,
  $email // reply-to = interesado
);

// --- 2) Agradecimiento al interesado ---
$thanksBody =
  '<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">Hola ' . esc($name) . ',</p>'
  . '<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">Gracias por tu confianza y por querer formar parte de la beta de ModelMarket. Hemos recibido tu solicitud correctamente.</p>'
  . '<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">Estamos ultimando los detalles del periodo de pruebas. <strong>Te escribiremos en cuanto abramos</strong>, y entrarás entre los primeros con tus <strong>12 meses de plan PRO gratis</strong>.</p>'
  . '<p style="margin:0 0 14px;color:#1A2733;font-size:15px;line-height:1.6;">Mientras tanto, ve pensando qué maquetas te gustaría publicar y qué piezas llevas tiempo buscando. 😉</p>'
  . '<p style="margin:18px 0 0;color:#5B6B7B;font-size:13px;line-height:1.6;">Un saludo,<br>El equipo de ModelMarket</p>';

[$thanksOk, $thanksErr] = send_resend(
  $email,
  'Gracias por unirte a la beta de ModelMarket',
  layout($BASE_URL, '¡Gracias por tu confianza, ' . esc($name) . '!', $thanksBody),
  $FROM_EMAIL,
  $FROM_NAME,
  $RESEND_API_KEY
);

// El aviso al equipo es el crítico: si falla, avisamos al interesado.
if (!$adminOk) {
  error_log('[beta] Fallo aviso equipo: ' . $adminErr);
  fail('No hemos podido registrar tu solicitud. Escríbenos a hola@modelmarket.es.', 500);
}
if (!$thanksOk) {
  // No bloquea: la solicitud ya está registrada. Se deja rastro en el log.
  error_log('[beta] Fallo email de agradecimiento a ' . $email . ': ' . $thanksErr);
}

ok(['message' => 'Solicitud recibida', 'thanksSent' => $thanksOk]);
