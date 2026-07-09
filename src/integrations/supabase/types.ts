/**
 * Tipos del esquema de base de datos.
 *
 * IDEAL: regenerar con `supabase gen types typescript` una vez aplicada la migración.
 * De momento se mantienen a mano las tablas ya definidas en supabase/migrations/.
 * Cuando Lovable gestione el proyecto, este fichero pasa a ser autogenerado — no editar.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type AppRole = 'admin' | 'user'
export type SubscriptionPlan = 'free' | 'pro' | 'retail'

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: AppRole
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role?: AppRole
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: AppRole
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      has_role: {
        Args: { _user_id: string; _role: AppRole }
        Returns: boolean
      }
    }
    Enums: {
      app_role: AppRole
      subscription_plan: SubscriptionPlan
    }
    CompositeTypes: Record<string, never>
  }
}
