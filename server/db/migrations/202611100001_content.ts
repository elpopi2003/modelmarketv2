import { sql, type Kysely } from 'kysely'

/**
 * Contenido: catálogos (categorías y marcas), anuncios, peticiones, favoritos y
 * suscripciones (solo la tabla; Stripe llega en M8d).
 *
 * Las reglas que en Postgres vivían en RLS y triggers ahora las aplica el servidor
 * (`server/content/*`), con tests:
 *  - visibilidad pública: activo/reservado (peticiones: abiertas), visible_at cumplido y
 *    dueño no suspendido; el dueño y los admins lo ven siempre;
 *  - moderación: con previous_status != NULL el dueño no puede cambiar el estado ni borrar;
 *  - límites del plan (anuncios, peticiones, fotos) y retardo de visibilidad del plan Free.
 *
 * Las listas (fotos, estados aceptados) son JSON: MariaDB no tiene arrays.
 * Las categorías y marcas se siembran con los mismos IDs que en Supabase para que la
 * migración de datos (M8e) encaje sin traducir referencias.
 */
const CATEGORIES: [string, string, string][] = [
  ['79ed83f5-129e-48a5-8394-bbfd5ca2d636', 'Aviación', 'aviacion'],
  ['4aca6157-baef-491b-b3f0-a4e112502770', 'Automóviles', 'automoviles'],
  ['1e45f15f-3b15-4060-8a43-df507c544cc4', 'Barcos', 'barcos'],
  ['5491d5a0-3dfb-48a1-af71-d74b88f2213b', 'Ciencia ficción', 'ciencia-ficcion'],
  ['8c76d9b5-e0f6-4c9e-8788-8fcf290520df', 'Figuras', 'figuras'],
  ['3d61470f-bd8d-443f-9167-c8fe8cc56096', 'Pinturas y Accesorios', 'pinturas-accesorios'],
  ['75e4f795-cfcd-4871-9736-e9601af2eda5', 'Trenes', 'trenes'],
  ['d273f8c5-c122-4aba-95e2-643dc72828df', 'Vehículos militares', 'vehiculos-militares'],
]

const BRANDS: [string, string, string][] = [
  ['cc61f523-d7db-447c-acbe-48ce9955eb06', 'Academy', 'academy'],
  ['177dd8d1-32ba-4578-ae3d-4cb6f00fe50a', 'Airfix', 'airfix'],
  ['0f493c56-2570-4938-9a0a-cb07baafb31e', 'Hasegawa', 'hasegawa'],
  ['2f42ee3a-0333-4916-b95d-410007d81db6', 'Italeri', 'italeri'],
  ['c514addc-f22a-49d9-8acc-db143b4ca63e', 'Meng', 'meng'],
  ['17ac2d59-984e-485b-8788-23c70d02a9ae', 'Revell', 'revell'],
  ['55c10d60-8da8-4603-aee9-67b090eb74ff', 'Tamiya', 'tamiya'],
  ['eac8248c-e8fe-4f0c-ab33-a7e9ca610449', 'Trumpeter', 'trumpeter'],
  ['445823a0-6228-4505-b1b7-706b450aa7d9', 'Zvezda', 'zvezda'],
]

const TABLE_OPTS = sql.raw('ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci')

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    CREATE TABLE categories (
      id         UUID         NOT NULL PRIMARY KEY,
      name       VARCHAR(80)  NOT NULL,
      slug       VARCHAR(80)  NOT NULL,
      parent_id  UUID         NULL,
      created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY categories_slug_unique (slug),
      CONSTRAINT categories_parent_fk FOREIGN KEY (parent_id) REFERENCES categories (id) ON DELETE SET NULL
    ) ${TABLE_OPTS}
  `.execute(db)

  await sql`
    CREATE TABLE brands (
      id         UUID         NOT NULL PRIMARY KEY,
      name       VARCHAR(80)  NOT NULL,
      slug       VARCHAR(80)  NOT NULL,
      created_at DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY brands_name_unique (name),
      UNIQUE KEY brands_slug_unique (slug)
    ) ${TABLE_OPTS}
  `.execute(db)

  // ref_number: número corto y correlativo que se enseña en la ficha ("Ref. 1042").
  await sql`
    CREATE TABLE listings (
      id              UUID          NOT NULL PRIMARY KEY,
      ref_number      BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id         UUID          NOT NULL,
      title           VARCHAR(200)  NOT NULL,
      description     TEXT          NULL,
      price_cents     INT UNSIGNED  NOT NULL DEFAULT 0,
      currency        CHAR(3)       NOT NULL DEFAULT 'EUR',
      \`condition\`   ENUM('sealed', 'opened', 'started') NOT NULL DEFAULT 'sealed',
      decals          ENUM('perfect', 'yellowed', 'unavailable') NOT NULL DEFAULT 'perfect',
      scale           VARCHAR(50)   NULL,
      category_id     UUID          NULL,
      brand_id        UUID          NULL,
      photos          JSON          NOT NULL DEFAULT ('[]'),
      status          ENUM('draft', 'active', 'reserved', 'sold', 'archived') NOT NULL DEFAULT 'active',
      -- Estado anterior a una retirada por moderación. NULL = no moderado.
      previous_status ENUM('draft', 'active', 'reserved', 'sold', 'archived') NULL,
      shipping_inpost BOOLEAN       NOT NULL DEFAULT FALSE,
      hand_delivery   BOOLEAN       NOT NULL DEFAULT FALSE,
      accepts_offers  BOOLEAN       NOT NULL DEFAULT TRUE,
      views           INT UNSIGNED  NOT NULL DEFAULT 0,
      visible_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      created_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at      DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY listings_ref_number_unique (ref_number),
      KEY listings_user_idx (user_id),
      KEY listings_status_visible_idx (status, visible_at),
      KEY listings_category_idx (category_id),
      KEY listings_brand_idx (brand_id),
      KEY listings_created_idx (created_at),
      CONSTRAINT listings_photos_json CHECK (JSON_VALID(photos) AND JSON_TYPE(photos) = 'ARRAY'),
      CONSTRAINT listings_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT listings_category_fk FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
      CONSTRAINT listings_brand_fk FOREIGN KEY (brand_id) REFERENCES brands (id) ON DELETE SET NULL
    ) ${TABLE_OPTS}
  `.execute(db)

  await sql`
    CREATE TABLE requests (
      id                  UUID          NOT NULL PRIMARY KEY,
      user_id             UUID          NOT NULL,
      title               VARCHAR(200)  NOT NULL,
      description         TEXT          NULL,
      category_id         UUID          NULL,
      brand_id            UUID          NULL,
      scale               VARCHAR(50)   NULL,
      max_price_cents     INT UNSIGNED  NULL,
      photos              JSON          NOT NULL DEFAULT ('[]'),
      accepted_conditions JSON          NOT NULL DEFAULT ('["sealed","opened","started"]'),
      decals_requirement  ENUM('any', 'perfect', 'yellowed', 'unavailable') NOT NULL DEFAULT 'any',
      urgency             ENUM('no_rush', 'normal', 'urgent') NOT NULL DEFAULT 'no_rush',
      status              ENUM('open', 'fulfilled', 'closed') NOT NULL DEFAULT 'open',
      previous_status     ENUM('open', 'fulfilled', 'closed') NULL,
      created_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at          DATETIME(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      KEY requests_user_idx (user_id),
      KEY requests_status_idx (status),
      KEY requests_category_idx (category_id),
      KEY requests_brand_idx (brand_id),
      KEY requests_created_idx (created_at),
      CONSTRAINT requests_photos_json CHECK (JSON_VALID(photos) AND JSON_TYPE(photos) = 'ARRAY'),
      CONSTRAINT requests_conditions_json CHECK (JSON_VALID(accepted_conditions) AND JSON_TYPE(accepted_conditions) = 'ARRAY'),
      CONSTRAINT requests_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT requests_category_fk FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL,
      CONSTRAINT requests_brand_fk FOREIGN KEY (brand_id) REFERENCES brands (id) ON DELETE SET NULL
    ) ${TABLE_OPTS}
  `.execute(db)

  await sql`
    CREATE TABLE favorites (
      id         UUID        NOT NULL PRIMARY KEY,
      user_id    UUID        NOT NULL,
      listing_id UUID        NOT NULL,
      created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      UNIQUE KEY favorites_user_listing_unique (user_id, listing_id),
      KEY favorites_listing_idx (listing_id),
      CONSTRAINT favorites_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      CONSTRAINT favorites_listing_fk FOREIGN KEY (listing_id) REFERENCES listings (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}
  `.execute(db)

  // Una fila por usuario como mucho. Sin fila = plan Free. La rellena Stripe (M8d).
  await sql`
    CREATE TABLE subscriptions (
      id                     UUID         NOT NULL PRIMARY KEY,
      user_id                UUID         NOT NULL,
      tier                   ENUM('free', 'pro', 'retail') NOT NULL DEFAULT 'free',
      status                 VARCHAR(30)  NOT NULL DEFAULT 'active',
      stripe_customer_id     VARCHAR(255) NULL,
      stripe_subscription_id VARCHAR(255) NULL,
      current_period_end     DATETIME(3)  NULL,
      created_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updated_at             DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      UNIQUE KEY subscriptions_user_unique (user_id),
      KEY subscriptions_stripe_customer_idx (stripe_customer_id),
      CONSTRAINT subscriptions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    ) ${TABLE_OPTS}
  `.execute(db)

  for (const [id, name, slug] of CATEGORIES) {
    await sql`INSERT INTO categories (id, name, slug) VALUES (${id}, ${name}, ${slug})`.execute(db)
  }
  for (const [id, name, slug] of BRANDS) {
    await sql`INSERT INTO brands (id, name, slug) VALUES (${id}, ${name}, ${slug})`.execute(db)
  }
}

export async function down(db: Kysely<unknown>): Promise<void> {
  for (const t of ['subscriptions', 'favorites', 'requests', 'listings', 'brands', 'categories']) {
    await sql`DROP TABLE IF EXISTS ${sql.table(t)}`.execute(db)
  }
}
