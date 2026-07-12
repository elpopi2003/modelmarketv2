# Edge Functions — Capa de email (Resend)

Notificaciones por **email** de ModelMarket. Deno + [Resend](https://resend.com) vía `fetch`
(sin dependencias). Adelanto de M6: la infraestructura reutilizable + una función de test.

## Estructura

```
_shared/
  cors.ts             CORS
  response.ts         { ok, data, error } homogéneo
  resend.ts           sendEmail() -> API de Resend
  email-templates.ts  plantillas "Blueprint" (una por tipo) + allSampleEmails()
send-test-emails/     envía UN ejemplo de CADA tipo a una dirección (protegida por secreto)
send-message-notification/  ejemplo de función "real"
```

Tipos de email cubiertos: `welcome`, `pro-welcome`, `downgrade`, `new-message`, `new-offer`,
`new-request-offer`, `listing-status`, `request-status`, `contact`.

## 1. Cuenta y clave de Resend

1. Crea cuenta en [resend.com](https://resend.com) (idealmente con **alf.mosquera@gmail.com**).
2. Crea una **API key** (empieza por `re_`).
3. **Remitente (`EMAIL_FROM`)**:
   - **Modo test rápido:** `ModelMarket <onboarding@resend.dev>`. ⚠️ En este modo Resend **solo
     entrega a la dirección del dueño de la cuenta** (por eso conviene que la cuenta sea la tuya).
   - **Producción:** verifica un dominio (p. ej. `modelmarket.es`) y usa `ModelMarket <no-reply@modelmarket.es>`.

## 2. Secretos (tooling de Lovable, o Supabase CLI)

Configura estos secretos del proyecto (nunca en código):

| Secreto             | Ejemplo                                   |
| ------------------- | ----------------------------------------- |
| `RESEND_API_KEY`    | `re_xxxxxxxx`                             |
| `EMAIL_FROM`        | `ModelMarket <onboarding@resend.dev>`     |
| `EMAIL_TEST_SECRET` | una cadena aleatoria (protege el test)    |
| `APP_URL`           | `https://modelmarket.es` (o tu staging)   |

Con Supabase CLI:

```bash
supabase secrets set RESEND_API_KEY=re_xxx EMAIL_FROM="ModelMarket <onboarding@resend.dev>" \
  EMAIL_TEST_SECRET=un-secreto-largo APP_URL=https://modelmarket.es
```

## 3. Desplegar

```bash
supabase functions deploy send-test-emails --no-verify-jwt
supabase functions deploy send-message-notification
```

(`--no-verify-jwt` en la de test porque va protegida por `EMAIL_TEST_SECRET`, no por JWT.)

## 4. Probar el envío de TODAS las notificaciones

```bash
curl -X POST "https://shanozqxmmdiqvqhffbz.supabase.co/functions/v1/send-test-emails" \
  -H "Content-Type: application/json" \
  -H "apikey: <TU_PUBLISHABLE_KEY>" \
  -H "x-test-secret: <EMAIL_TEST_SECRET>" \
  -d '{"to":"alf.mosquera@gmail.com"}'
```

Respuesta: `{ ok, data: { to, total, sent, results: [{ type, sent, id }] } }`. Revisa la bandeja
(y spam) de `alf.mosquera@gmail.com`: debería llegar un email `[TEST] …` por cada tipo.

> Si `sent` < `total`, mira `results[].error` (normalmente falta un secreto o el remitente/dominio
> no está verificado en Resend).
