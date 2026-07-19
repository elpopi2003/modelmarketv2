import { useCallback, useEffect, useState } from 'react'

/**
 * reCAPTCHA v3 (invisible, sin interacción del usuario).
 *
 * Degrada con elegancia: si `VITE_RECAPTCHA_SITE_KEY` no está configurada, el hook se
 * queda inerte y `getToken()` devuelve null. Así el formulario sigue funcionando en
 * desarrollo y la protección se activa sola en cuanto existan las claves, sin tocar
 * código. La verificación real ocurre en el servidor: un token de cliente no prueba nada
 * por sí mismo.
 */

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined
const SCRIPT_ID = 'recaptcha-v3'

declare global {
  interface Window {
    grecaptcha?: {
      ready: (cb: () => void) => void
      execute: (siteKey: string, opts: { action: string }) => Promise<string>
    }
  }
}

export function useRecaptcha() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!SITE_KEY) return
    if (document.getElementById(SCRIPT_ID)) {
      setReady(true)
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = `https://www.google.com/recaptcha/api.js?render=${SITE_KEY}`
    script.async = true
    script.onload = () => setReady(true)
    document.head.appendChild(script)
  }, [])

  /** Token para una acción concreta, o null si reCAPTCHA no está configurado. */
  const getToken = useCallback(async (action: string): Promise<string | null> => {
    if (!SITE_KEY || !window.grecaptcha) return null
    try {
      return await window.grecaptcha.execute(SITE_KEY, { action })
    } catch {
      // Un fallo de reCAPTCHA no debe impedir el envío: el servidor decide.
      return null
    }
  }, [])

  return { enabled: Boolean(SITE_KEY), ready, getToken }
}
