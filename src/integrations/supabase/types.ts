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
/** Precintado / Abierto / Empezado */
export type ListingCondition = 'sealed' | 'opened' | 'started'
export type ListingStatus = 'draft' | 'active' | 'reserved' | 'sold' | 'archived'
/** Perfectas / Amarilleadas / No disponibles. "Calcas OK" es derivado: decals === 'perfect'. */
export type DecalsStatus = 'perfect' | 'yellowed' | 'unavailable'
export type RequestStatus = 'open' | 'fulfilled' | 'closed'
/** Requisito de calcas del autor de una petición ('any' = no importante). */
export type DecalsRequirement = 'any' | 'perfect' | 'yellowed' | 'unavailable'
export type RequestUrgency = 'no_rush' | 'normal' | 'urgent'
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'
export type ReportReason =
  | 'spam'
  | 'prohibited'
  | 'counterfeit'
  | 'misleading'
  | 'offensive'
  | 'other'
export type ReportStatus = 'pending' | 'resolved' | 'dismissed'
/** Un mensaje generado por una oferta se marca 'offer' (no notifica como mensaje). */
export type MessageKind = 'text' | 'offer'

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
          location: string | null
          notify_email: boolean
          notify_push: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          notify_email?: boolean
          notify_push?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          display_name?: string | null
          avatar_url?: string | null
          bio?: string | null
          location?: string | null
          notify_email?: boolean
          notify_push?: boolean
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
          decals: DecalsStatus
          shipping_inpost: boolean
          hand_delivery: boolean
          /** El vendedor admite ofertas por debajo del precio publicado. */
          accepts_offers: boolean
          ref_number: number
          views: number
          scale: string | null
          category_id: string | null
          brand_id: string | null
          photos: string[]
          status: ListingStatus
          /** Estado antes de una retirada por moderación (para restaurar). */
          previous_status: ListingStatus | null
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
          decals?: DecalsStatus
          shipping_inpost?: boolean
          hand_delivery?: boolean
          accepts_offers?: boolean
          ref_number?: number
          views?: number
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
          decals?: DecalsStatus
          shipping_inpost?: boolean
          hand_delivery?: boolean
          accepts_offers?: boolean
          ref_number?: number
          views?: number
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
          accepted_conditions: ListingCondition[]
          decals_requirement: DecalsRequirement
          urgency: RequestUrgency
          photos: string[]
          status: RequestStatus
          /** Estado antes de una retirada por moderación (para restaurar). */
          previous_status: RequestStatus | null
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
          accepted_conditions?: ListingCondition[]
          decals_requirement?: DecalsRequirement
          urgency?: RequestUrgency
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
          accepted_conditions?: ListingCondition[]
          decals_requirement?: DecalsRequirement
          urgency?: RequestUrgency
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
        /** Cuelga de un anuncio O de una petición (exactamente uno). */
        Row: {
          id: string
          listing_id: string | null
          request_id: string | null
          buyer_id: string
          seller_id: string
          buyer_deleted_at: string | null
          seller_deleted_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          listing_id?: string | null
          request_id?: string | null
          buyer_id: string
          seller_id: string
          buyer_deleted_at?: string | null
          seller_deleted_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          listing_id?: string | null
          request_id?: string | null
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
          kind: MessageKind
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          sender_id: string
          body: string
          kind?: MessageKind
          read_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          conversation_id?: string
          sender_id?: string
          body?: string
          kind?: MessageKind
          read_at?: string | null
          created_at?: string
        }
        Relationships: []
      }
      offers: {
        /** Apunta a un anuncio O a una petición (exactamente uno). */
        Row: {
          id: string
          listing_id: string | null
          request_id: string | null
          from_user_id: string
          to_user_id: string
          conversation_id: string | null
          amount_cents: number
          message: string | null
          status: OfferStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          listing_id?: string | null
          request_id?: string | null
          from_user_id: string
          to_user_id: string
          conversation_id?: string | null
          amount_cents: number
          message?: string | null
          status?: OfferStatus
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          listing_id?: string | null
          request_id?: string | null
          from_user_id?: string
          to_user_id?: string
          conversation_id?: string | null
          amount_cents?: number
          message?: string | null
          status?: OfferStatus
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        /** Apunta a un anuncio, una petición O un usuario (exactamente uno). */
        Row: {
          id: string
          reporter_id: string
          listing_id: string | null
          request_id: string | null
          reported_user_id: string | null
          reason: ReportReason
          details: string | null
          status: ReportStatus
          resolved_by: string | null
          resolved_at: string | null
          resolution_note: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          reporter_id: string
          listing_id?: string | null
          request_id?: string | null
          reported_user_id?: string | null
          reason: ReportReason
          details?: string | null
          status?: ReportStatus
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          reporter_id?: string
          listing_id?: string | null
          request_id?: string | null
          reported_user_id?: string | null
          reason?: ReportReason
          details?: string | null
          status?: ReportStatus
          resolved_by?: string | null
          resolved_at?: string | null
          resolution_note?: string | null
          created_at?: string
          updated_at?: string
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
      subscriptions: {
        Row: {
          id: string
          user_id: string
          tier: SubscriptionPlan
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          current_period_end: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          tier?: SubscriptionPlan
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          tier?: SubscriptionPlan
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          current_period_end?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      subscriptions_public: {
        Row: {
          user_id: string | null
          tier: SubscriptionPlan | null
          status: string | null
        }
        Relationships: []
      }
    }
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
      get_or_create_brand: {
        Args: { _name: string }
        Returns: string
      }
      increment_listing_views: {
        Args: { _listing_id: string }
        Returns: undefined
      }
      request_offer_count: {
        Args: { _request_id: string }
        Returns: number
      }
      listing_offer_count: {
        Args: { _listing_id: string }
        Returns: number
      }
      /** Crea (o revisa) la oferta, abre el chat y devuelve el id de la conversación. */
      create_offer: {
        Args: {
          _listing_id: string | null
          _request_id: string | null
          _amount_cents: number
          _message?: string | null
        }
        Returns: string
      }
      respond_to_offer: {
        Args: { _offer_id: string; _status: OfferStatus }
        Returns: undefined
      }
      /** Contadores del panel de administración. Solo responde a admins. */
      admin_stats: {
        Args: Record<string, never>
        Returns: {
          users: number
          listings: number
          requests: number
          offers: number
          reports_pending: number
        }
      }
      /** Listado de usuarios con email y actividad. Solo admins. */
      admin_users: {
        Args: Record<string, never>
        Returns: {
          id: string
          email: string
          display_name: string | null
          username: string | null
          location: string | null
          avatar_url: string | null
          is_admin: boolean
          tier: SubscriptionPlan
          listings_count: number
          requests_count: number
          reports_count: number
          created_at: string
        }[]
      }
      /** Promueve o degrada a administrador. Solo admins, con salvaguardas. */
      admin_set_admin: {
        Args: { _user_id: string; _make_admin: boolean }
        Returns: undefined
      }
      /** Retira contenido guardando su estado previo. Solo admins. */
      admin_take_down: {
        Args: { _kind: 'listing' | 'request'; _id: string }
        Returns: undefined
      }
      /** Restaura contenido a su estado previo. Solo admins. */
      admin_restore: {
        Args: { _kind: 'listing' | 'request'; _id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: AppRole
      subscription_plan: SubscriptionPlan
      listing_condition: ListingCondition
      listing_status: ListingStatus
      decals_status: DecalsStatus
      decals_requirement: DecalsRequirement
      request_status: RequestStatus
      request_urgency: RequestUrgency
      offer_status: OfferStatus
      report_reason: ReportReason
      report_status: ReportStatus
    }
    CompositeTypes: Record<string, never>
  }
}
