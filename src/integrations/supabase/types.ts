/**
 * PLACEHOLDER de tipos del esquema de base de datos.
 *
 * Cuando se conecte Lovable Cloud, este fichero se REGENERA con el esquema real y
 * NO debe editarse a mano (ver convenciones en CLAUDE.md). De momento solo declara
 * los enums que ya conocemos para poder tipar el cliente.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: Record<string, never>
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      subscription_plan: 'free' | 'pro' | 'retail'
      app_role: 'admin' | 'user'
    }
    CompositeTypes: Record<string, never>
  }
}
