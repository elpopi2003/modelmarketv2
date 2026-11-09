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
  /** mysql://usuario:contraseña@host:3306/base_de_datos */
  DATABASE_URL: z.string().startsWith('mysql://'),
  /** Carpeta de la app compilada (vite build). Vacío = no servir el frontend (dev). */
  STATIC_DIR: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  /** Días que dura una sesión sin actividad antes de caducar. */
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /**
   * Cómo salen los emails:
   *  - smtp: por el Postfix del VPS (producción y staging).
   *  - file: se guardan como .eml/.html en MAIL_FILE_DIR para verlos sin enviar nada (local).
   */
  MAIL_TRANSPORT: z.enum(['smtp', 'file']).default('file'),
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

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Configuración inválida del servidor:\n${detail}`)
  }
  return parsed.data
}
