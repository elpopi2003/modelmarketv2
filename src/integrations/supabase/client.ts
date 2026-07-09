import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Cliente de Lovable Cloud (Supabase).
 *
 * Lee las credenciales de las variables de entorno `VITE_*`. Mientras el backend no esté
 * conectado, se construye con valores de placeholder para que el módulo sea import-safe
 * (no rompe la app), pero cualquier petición fallará hasta rellenar el `.env`.
 *
 * NOTA: una vez Lovable gestione el proyecto, este fichero pasa a ser autogenerado — no editar.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[supabase] Backend no conectado: faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env',
  )
}

export const supabase = createClient<Database>(
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'anon-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
)
