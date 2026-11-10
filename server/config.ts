import { z } from 'zod'

/**
 * Configuración del servidor, validada al arrancar. Si falta algo obligatorio el proceso
 * no arranca: es preferible a descubrirlo en la primera petición que lo necesite.
 *
 * Los valores vienen de variables de entorno. En local, de `server/.env` (gitignored);
 * en Plesk, de las variables de la aplicación Node.js del dominio.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Origen público de la app, sin barra final (enlaces en emails, cookies, CORS en dev). */
  APP_URL: z.string().url().default('http://localhost:5173'),
  /** mysql://usuario:contraseña@host:3306/base_de_datos (o DB_HOST/DB_USER/... por partes). */
  DATABASE_URL: z
    .string({ required_error: 'Falta DATABASE_URL (o DB_HOST, DB_USER, DB_PASSWORD y DB_NAME)' })
    .startsWith('mysql://'),
  /** Carpeta de la app compilada (vite build). Vacío = no servir el frontend (dev). */
  STATIC_DIR: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /**
   * Carpeta de fotos y avatares subidos. En Plesk, una ruta absoluta FUERA de la carpeta
   * que despliega Git (p. ej. /var/www/vhosts/modelmarket.es/uploads-staging), para que un
   * despliegue no pueda tocarla.
   */
  UPLOADS_DIR: z.string().default('server/.local/uploads'),

  /** Días que dura una sesión sin actividad antes de caducar. */
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * Cómo salen los emails:
   *  - sendmail: por el comando sendmail del VPS (producción y staging en Plesk).
   *  - smtp: por SMTP sin autenticar (un Postfix que acepte relay local; Plesk no lo hace).
   *  - file: se guardan como .eml/.html en MAIL_FILE_DIR para verlos sin enviar nada (local).
   */
  MAIL_TRANSPORT: z.enum(['sendmail', 'smtp', 'file']).default('file'),
  SENDMAIL_PATH: z.string().default('/usr/sbin/sendmail'),
  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().positive().default(25),
  MAIL_FROM: z.string().default('ModelMarket <info@modelmarket.es>'),
  /** Adonde llegan las respuestas a los avisos automáticos. */
  MAIL_REPLY_TO: z.string().default('hola@modelmarket.es'),
  /** URL absoluta del logo en los emails (lo abre el cliente de correo, sin sesión). */
  MAIL_LOGO_URL: z.string().url().default('https://modelmarket.es/brand/logo.png'),
  MAIL_FILE_DIR: z.string().default('server/.local/mail'),
})

export type Config = z.infer<typeof envSchema>

/**
 * Si no hay DATABASE_URL pero sí DB_HOST/DB_USER/DB_PASSWORD/DB_NAME (como los muestra
 * Plesk), se compone la URL codificando cada parte: las contraseñas generadas por Plesk
 * llevan símbolos (`@`, `#`, `/`…) que romperían una URL escrita a mano.
 */
export function databaseUrlFromParts(env: NodeJS.ProcessEnv): string | undefined {
  const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME } = env
  if (!DB_HOST || !DB_USER || !DB_NAME) return undefined
  const enc = encodeURIComponent
  return `mysql://${enc(DB_USER)}:${enc(DB_PASSWORD ?? '')}@${DB_HOST}:${DB_PORT || 3306}/${enc(DB_NAME)}`
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse({
    ...env,
    DATABASE_URL: env.DATABASE_URL || databaseUrlFromParts(env),
  })
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Configuración inválida del servidor:\n${detail}`)
  }
  return parsed.data
}
