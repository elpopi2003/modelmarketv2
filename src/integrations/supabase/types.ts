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
export type ListingCondition = 'new' | 'like_new' | 'used' | 'for_parts'
export type ListingStatus = 'draft' | 'active' | 'sold' | 'archived'
export type RequestStatus = 'open' | 'fulfilled' | 'closed'

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
      brands: {
        Row: { id: string; name: string; slug: string; created_at: string }
        Insert: { id?: string; name: string; slug: string; created_at?: string }
        Update: { id?: string; name?: string; slug?: string; created_at?: string }
        Relationships: []
      }
      categories: {
        Row: {
          id: string
          name: string
          slug: string
          parent_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          parent_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          parent_id?: string | null
          created_at?: string
        }
        Relationships: []
      }
      listings: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          price_cents: number
          currency: string
          condition: ListingCondition
          scale: string | null
          category_id: string | null
          brand_id: string | null
          photos: string[]
          status: ListingStatus
          visible_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          price_cents?: number
          currency?: string
          condition?: ListingCondition
          scale?: string | null
          category_id?: string | null
          brand_id?: string | null
          photos?: string[]
          status?: ListingStatus
          visible_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          price_cents?: number
          currency?: string
          condition?: ListingCondition
          scale?: string | null
          category_id?: string | null
          brand_id?: string | null
          photos?: string[]
          status?: ListingStatus
          visible_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      requests: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          category_id: string | null
          brand_id: string | null
          scale: string | null
          max_price_cents: number | null
          photos: string[]
          status: RequestStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          category_id?: string | null
          brand_id?: string | null
          scale?: string | null
          max_price_cents?: number | null
          photos?: string[]
          status?: RequestStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          category_id?: string | null
          brand_id?: string | null
          scale?: string | null
          max_price_cents?: number | null
          photos?: string[]
          status?: RequestStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          id: string
          user_id: string
          listing_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          listing_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          listing_id?: string
          created_at?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          listing_id: string
          buyer_id: string
          seller_id: string
          buyer_deleted_at: string | null
          seller_deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          listing_id: string
          buyer_id: string
          seller_id: string
          buyer_deleted_at?: string | null
          seller_deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          listing_id?: string
          buyer_id?: string
          seller_id?: string
          buyer_deleted_at?: string | null
          seller_deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          conversation_id: string
          sender_id: string
          body: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          body: string
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          body?: string
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          body: string | null
          link: string | null
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          body?: string | null
          link?: string | null
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          body?: string | null
          link?: string | null
          read_at?: string | null
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
      listing_favorite_count: {
        Args: { _listing_id: string }
        Returns: number
      }
      is_conversation_participant: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      get_or_create_conversation: {
        Args: { _listing_id: string }
        Returns: string
      }
      unread_message_count: {
        Args: Record<string, never>
        Returns: number
      }
      mark_conversation_read: {
        Args: { _conversation_id: string }
        Returns: undefined
      }
      unread_notification_count: {
        Args: Record<string, never>
        Returns: number
      }
    }
    Enums: {
      app_role: AppRole
      subscription_plan: SubscriptionPlan
      listing_condition: ListingCondition
      listing_status: ListingStatus
      request_status: RequestStatus
    }
    CompositeTypes: Record<string, never>
  }
}
