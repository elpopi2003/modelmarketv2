import type { ColumnType, Insertable, Selectable, Updateable } from 'kysely'

/**
 * Tipos de las tablas de MariaDB para Kysely.
 *
 * Se mantienen a mano junto a las migraciones (`server/db/migrations`): cada migración que
 * cambia una tabla actualiza aquí su interfaz en el mismo commit.
 */

/** Columna con valor por defecto en la base de datos: opcional al insertar. */
type Defaulted<T> = ColumnType<T, T | undefined, T>
/** Fecha gestionada por MariaDB (DEFAULT / ON UPDATE): no se escribe desde la app. */
type AutoDate = ColumnType<Date, never, never>

export type AppRole = 'admin' | 'user'
export type AuthTokenPurpose = 'verify_email' | 'reset_password'

export interface UsersTable {
  id: string
  email: string
  password_hash: string | null
  email_verified_at: Date | null
  last_login_at: Date | null
  created_at: AutoDate
  updated_at: AutoDate
}

export interface SessionsTable {
  /** SHA-256 (hex) del token de la cookie. */
  id: string
  user_id: string
  expires_at: Date
  last_seen_at: Defaulted<Date>
  ip: string | null
  user_agent: string | null
  created_at: AutoDate
}

export interface AuthTokensTable {
  token_hash: string
  user_id: string
  purpose: AuthTokenPurpose
  expires_at: Date
  used_at: Date | null
  created_at: AutoDate
}

export interface ProfilesTable {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  location: string | null
  notify_email: Defaulted<boolean>
  notify_push: Defaulted<boolean>
  created_at: AutoDate
  updated_at: AutoDate
}

export interface UserRolesTable {
  id: string
  user_id: string
  role: Defaulted<AppRole>
  created_at: AutoDate
}

export interface UserSuspensionsTable {
  user_id: string
  reason: string
  suspended_at: Defaulted<Date>
  suspended_by: string | null
}

export type EmailStatus = 'pending' | 'sending' | 'sent' | 'failed'

export interface EmailOutboxTable {
  id: string
  to_email: string
  subject: string
  html: string
  text: string
  reply_to: string | null
  /** Se escribe como JSON serializado; mysql2 lo entrega ya convertido en objeto. */
  headers: ColumnType<Record<string, string> | string | null, string | null, string | null>
  kind: string
  status: Defaulted<EmailStatus>
  attempts: Defaulted<number>
  last_error: string | null
  send_after: Defaulted<Date>
  sent_at: Date | null
  created_at: AutoDate
}

/**
 * Columna JSON: se escribe serializada y mysql2 la entrega ya convertida (o como texto,
 * según la versión de MariaDB). Normalizar al leer con `jsonArray()` de `db/json.ts`.
 */
type JsonColumn<T> = ColumnType<T | string, string | undefined, string>

export type ListingCondition = 'sealed' | 'opened' | 'started'
export type ListingStatus = 'draft' | 'active' | 'reserved' | 'sold' | 'archived'
export type DecalsStatus = 'perfect' | 'yellowed' | 'unavailable'
export type DecalsRequirement = 'any' | 'perfect' | 'yellowed' | 'unavailable'
export type RequestUrgency = 'no_rush' | 'normal' | 'urgent'
export type RequestStatus = 'open' | 'fulfilled' | 'closed'
export type TierName = 'free' | 'pro' | 'retail'

export interface CategoriesTable {
  id: string
  name: string
  slug: string
  parent_id: string | null
  created_at: AutoDate
}

export interface BrandsTable {
  id: string
  name: string
  slug: string
  created_at: AutoDate
}

export interface ListingsTable {
  id: string
  /** AUTO_INCREMENT: no se escribe. */
  ref_number: ColumnType<string, never, never>
  user_id: string
  title: string
  description: string | null
  price_cents: number
  currency: Defaulted<string>
  condition: ListingCondition
  decals: DecalsStatus
  scale: string | null
  category_id: string | null
  brand_id: string | null
  photos: JsonColumn<string[]>
  status: Defaulted<ListingStatus>
  previous_status: ListingStatus | null
  shipping_inpost: Defaulted<boolean>
  hand_delivery: Defaulted<boolean>
  accepts_offers: Defaulted<boolean>
  views: Defaulted<number>
  visible_at: Defaulted<Date>
  created_at: AutoDate
  updated_at: AutoDate
}

export interface RequestsTable {
  id: string
  user_id: string
  title: string
  description: string | null
  category_id: string | null
  brand_id: string | null
  scale: string | null
  max_price_cents: number | null
  photos: JsonColumn<string[]>
  accepted_conditions: JsonColumn<ListingCondition[]>
  decals_requirement: Defaulted<DecalsRequirement>
  urgency: Defaulted<RequestUrgency>
  status: Defaulted<RequestStatus>
  previous_status: RequestStatus | null
  created_at: AutoDate
  updated_at: AutoDate
}

export interface FavoritesTable {
  id: string
  user_id: string
  listing_id: string
  created_at: AutoDate
}

export interface SubscriptionsTable {
  id: string
  user_id: string
  tier: Defaulted<TierName>
  status: Defaulted<string>
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: Date | null
  created_at: AutoDate
  updated_at: AutoDate
}

export type MessageKind = 'text' | 'offer'
export type OfferStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

export interface ConversationsTable {
  id: string
  listing_id: string | null
  request_id: string | null
  buyer_id: string
  seller_id: string
  buyer_deleted_at: Date | null
  seller_deleted_at: Date | null
  created_at: AutoDate
  /** Lo actualiza la aplicación al llegar un mensaje (ordena la bandeja). */
  updated_at: Defaulted<Date>
}

export interface MessagesTable {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  kind: Defaulted<MessageKind>
  read_at: Date | null
  created_at: AutoDate
}

export interface OffersTable {
  id: string
  listing_id: string | null
  request_id: string | null
  from_user_id: string
  to_user_id: string
  conversation_id: string | null
  amount_cents: number
  message: string | null
  status: Defaulted<OfferStatus>
  /** Columna generada: no se escribe. */
  pending_key: ColumnType<string | null, never, never>
  created_at: AutoDate
  updated_at: AutoDate
}

export interface NotificationsTable {
  id: string
  user_id: string
  type: string
  title: string
  body: string | null
  link: string | null
  read_at: Date | null
  created_at: Defaulted<Date>
}

export type ReportReason = 'spam' | 'prohibited' | 'counterfeit' | 'misleading' | 'offensive' | 'other'
export type ReportStatus = 'pending' | 'resolved' | 'dismissed'

export interface ReportsTable {
  id: string
  reporter_id: string
  listing_id: string | null
  request_id: string | null
  reported_user_id: string | null
  reason: ReportReason
  details: string | null
  status: Defaulted<ReportStatus>
  resolved_by: string | null
  resolved_at: Date | null
  resolution_note: string | null
  /** Columna generada: no se escribe. */
  pending_key: ColumnType<string | null, never, never>
  created_at: AutoDate
  updated_at: AutoDate
}

export interface Database {
  users: UsersTable
  sessions: SessionsTable
  auth_tokens: AuthTokensTable
  profiles: ProfilesTable
  user_roles: UserRolesTable
  user_suspensions: UserSuspensionsTable
  email_outbox: EmailOutboxTable
  categories: CategoriesTable
  brands: BrandsTable
  listings: ListingsTable
  requests: RequestsTable
  favorites: FavoritesTable
  subscriptions: SubscriptionsTable
  conversations: ConversationsTable
  messages: MessagesTable
  offers: OffersTable
  notifications: NotificationsTable
  reports: ReportsTable
}

export type User = Selectable<UsersTable>
export type NewUser = Insertable<UsersTable>
export type Profile = Selectable<ProfilesTable>
export type ProfileUpdate = Updateable<ProfilesTable>
export type Session = Selectable<SessionsTable>
