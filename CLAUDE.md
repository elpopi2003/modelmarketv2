# CLAUDE.md — ModelMarket

Contexto para Claude Code. Guía la **construcción greenfield** de ModelMarket hacia la
arquitectura objetivo. (Doc original redactado como guía de refactor; aquí se construye ya en el
estado final para no acumular deuda.)

---

## 0. Estado del proyecto (greenfield)

Roadmap por hitos. Una PR por hito. `tsc` + `vitest` en verde antes de cerrar cada uno.

- [x] **M0 · Andamiaje** — Vite 7 + React 19 + TS, Tailwind **v4**, shadcn/ui, ESLint + Prettier, Vitest, CI.
- [x] **M1 · Fundaciones de dominio** — `SubscriptionTier` + feature matrix, `queryKeys.ts`, `handleSupabaseError`, cliente Supabase por env, Router con layouts + lazy. (Schemas Zod se posponen a M3, con los formularios.)
- [x] **M2 · Auth + perfil** — `useAuth` (AuthProvider), `Auth` (login/registro Zod), `RequireAuth`, `AppLayout`, `Dashboard`, `auth/callback`; backend Supabase conectado (`.env`), migración `profiles` + `user_roles` aplicada (RLS + `has_role()` + trigger de alta), `useProfile` + página `Perfil`. Verificado en vivo: alta real → trigger crea perfil/rol → editar/guardar con RLS.
- [x] **M3 · Listings** — publicar/**editar/borrar** (form Zod compartido `ListingForm`, fotos, gating), explorar (filtros + grid) y producto (`/producto/:id`). Design system "Blueprint" aplicado (ProductCard/ConditionBadge/ScaleTag). Fixes de audit aplicados (responsive, contraste, lazy, vendor chunks).
- [x] **M4 · Requests, favoritos, mensajería, notificaciones** — peticiones (CRUD + gating), favoritos (toggle + contador RPC), mensajería (conversaciones/hilo + "Contactar" + no leídos) y notificaciones (triggers mensaje/favorito + campanita). RLS y RPCs SECURITY DEFINER; verificado en vivo con 2 usuarios.
- [x] **M5 · Suscripciones/Stripe** — tabla `subscriptions` + vista pública, página `/precios` (feature matrix), Edge Functions (create-checkout, check-subscription, customer-portal, stripe-webhook) y tier real conectado. Verificado end-to-end: pago test (4242) → webhook → `pro/active` → gating desbloqueado.
- [ ] **M6 · Admin, moderación, Edge Functions, emails**.
- [x] **M7 · SEO, rendimiento, tests e2e** — SEO por ruta (`<Seo/>` con hoisting nativo de
  React 19: título/meta/OG/canonical, JSON-LD Product y FAQPage); rendimiento (hero PNG 2 MB
  → AVIF ~54 KB vía `<picture>`, `npm run optimize:hero`, lazy-loading auditado); e2e Playwright
  (`npm run test:e2e`) cubriendo flujos públicos + login por la interfaz y rutas protegidas
  (credenciales vía `E2E_EMAIL`/`E2E_PASSWORD`, nunca en el repo). Los e2e que mutan datos
  (publicar con foto, mensajería entre dos usuarios, checkout Stripe) se dejan fuera a propósito
  para no ensuciar el backend real; se verifican a mano y por los tests de Vitest de la lógica.
- [ ] **M8 · v3.0: todo en el VPS** (rama `v3.0`; `main` = v2.0 hasta el corte) — sustituir
  Supabase y Resend por backend propio en el VPS Plesk (Ubuntu 24.04, MariaDB 10.11, Postfix).
  Servidor Node 22 + Fastify + Kysely en `server/`; Stripe y reCAPTCHA se mantienen.
  - [x] **M8a · Base** — `server/` (config Zod, `{ ok, data, error }`, migraciones al arrancar),
    esquema de usuarios/sesiones/perfiles/roles/suspensiones, autenticación propia (cookie
    httpOnly, argon2id + bcrypt migrado, verificación de email, recuperación, CSRF por Origin,
    rate limit), cola `email_outbox` con reintentos (transporte `sendmail` en Plesk), frontend
    conectado (`useAuth` → `/api/auth/me`, pantallas de verificar/recuperar/restablecer).
    Desplegado en `staging.modelmarket.es` con la extensión Git de Plesk
    (`deploy/plesk-deploy.sh`); mail-tester 8.5/10 con SPF, DKIM y DMARC correctos.
  - [x] **M8b · Contenido** — anuncios, peticiones, catálogos (sembrados con los IDs de
    Supabase), favoritos, perfiles y suscripciones (lectura). Reglas de RLS/triggers en el
    servidor con tests (visibilidad, suspendidos, moderación por `previous_status`). El plan se
    cumple en el servidor: límites de activos, fotos y retardo de 24 h del Free (en v2 no se
    aplicaba; la UI avisa «Público en X h»). Fotos en disco (`UPLOADS_DIR`, fuera del deploy):
    WebP 1600 px + miniatura 600 px, sin EXIF/GPS, solo subidas propias, borrado al dejar de usarse.
  - [x] **M8c · Comunicación** — conversaciones, mensajes, ofertas y notificaciones; la lógica
    de las RPC y triggers de v2 en `server/messaging` (transacciones). Una oferta pendiente por
    persona con columna generada + UNIQUE. Avisos con email por la cola si `notify_email`; los
    mensajes seguidos se agrupan (un email). Texto ajeno escapado en el email. Si el dueño retira
    (suspende/borrador) o elimina un anuncio del catálogo, se avisa a quien lo tenía en favoritos
    (como mucho una vez por semana y anuncio). Fechas siempre en
    UTC: cualquier escritura fuera de la app (scripts, migración M8e) debe usar `UTC_TIMESTAMP()`.
  - [x] **M8d · Admin, contacto y cuenta** (sin pagos) — panel (estadísticas, usuarios, roles,
    contenido, retirar/restaurar), suspensión con motivo y email, denuncias con aviso a admins,
    contacto con reCAPTCHA v3 verificado en servidor hacia `hola@`, baja propia y por admin
    (borra también fotos del disco). Corrige el fallo de v2 al retirar contenido ya suspendido.
    Clave pública de reCAPTCHA en `.env.production` (versionado: solo variables públicas).
  - [ ] **M8e · Corte** — hecho: modo beta `BETA_ALL_PRO`, importación desde Supabase
    (`npm run db:import-supabase`, ensayada en staging), guion `docs/corte-v3.md`, `main` en
    v3 y release `v3.0.0`. Pendiente: **puesta en producción, que espera a M8p**; producción
    arrancará vacía (v2 solo tenía cuentas de prueba).
  - [x] **Importador masivo (admin)** — `/admin/importar`: Excel de colección + ZIP de imágenes
    por referencia, vista previa con motivos y categorías a elegir, publicación con etiqueta
    «Foto de catálogo» (`listings.catalog_photo`) y `manufacturer_ref` para no duplicar.
    Guía en `docs/importador.md`; ZIP desde ModelKitLibrary con `scripts/modelkitlibrary-zip.py`.
  - [ ] **M8p · Pagos (aplazado, a estudiar)** — Stripe: checkout, portal, webhook al VPS
    (ruta fuera de la contraseña de staging, verificada por firma), cambio de plan desde admin
    (`TIER_CHANGES_ENABLED`) y cancelación de la suscripción al borrar una cuenta.
    Hoy `src/lib/api/subscriptions.ts` (checkout/portal) es lo único que aún usa Supabase.

### Desviaciones respecto al doc original (decididas)

- **Gestor de paquetes**: `npm` (no `bun`). Todos los comandos usan npm.
- **React 19** (no 18) y **Tailwind v4** (no v3) — "últimas por defecto".
- **Tailwind v4** ⇒ **no hay `tailwind.config.ts`**. La config es CSS-first en `src/index.css`
  (`@import "tailwindcss"`, tokens en `:root`/`.dark`, mapeo en `@theme inline`). El plugin de build
  es `@tailwindcss/vite`.

---

## 1. Visión general

Marketplace de coleccionismo de maquetas y modelos a escala:

- **0% comisión** entre usuarios.
- **Anuncios** (`listings`) y **peticiones** (`requests`).
- **Mensajería** interna, **favoritos**, **notificaciones**, **reportes**, panel **admin**.
- **Suscripciones** en tres niveles (Free, PRO, Retail) vía Stripe.

---

## 2. Estructura objetivo

```text
.
├── src/
│   ├── assets/
│   ├── components/            # + admin/ + ui/ (shadcn)
│   ├── hooks/                 # useListings, useRequests, useAuth, ...
│   ├── integrations/supabase/ # cliente + tipos (types.ts AUTOGENERADO — no editar)
│   ├── lib/                   # api/, schemas/, queryKeys.ts, subscription.ts, utils.ts
│   ├── pages/                 # rutas React Router (+ admin/)
│   ├── test/
│   ├── App.tsx
│   ├── index.css              # design tokens (Tailwind v4, CSS-first)
│   └── main.tsx
├── supabase/
│   ├── functions/             # Edge Functions (Deno)
│   └── migrations/            # SQL (RLS, policies, GRANTs)
├── public/
├── index.html
└── vite.config.ts
```

### Páginas

- **Públicas**: Index, Explorar, Producto, Peticiones, Precios, FAQ, Contacto, Cookies, Privacidad, TerminosDeUso, Auth.
- **Autenticadas**: Dashboard, PublicarAnuncio, CrearPeticion, MisPeticiones, Mensajes, Favoritos, Perfil, Configuracion.
- **Admin**: `pages/admin/*`.

### Hooks de dominio

`useAuth`, `useListings`, `useRequests`, `useFavorites`, `useConversations`, `useNotifications`,
`useSubscriptionLimits`, `useBrands`, `useCategories`, `useFilterOptions`, `useRecaptcha`.

### Edge Functions (objetivo)

- **Pagos**: `create-checkout`, `check-subscription`, `customer-portal`, `stripe-webhook`.
- **Cuenta**: `delete-account`, `admin-delete-user`.
- **Emails**: `send-welcome-email`, `send-pro-welcome-email`, `send-downgrade-email`,
  `send-message-notification`, `send-new-offer-email`, `send-new-request-offer-email`,
  `send-listing-status-email`, `send-request-status-email`, `send-admin-email`,
  `send-contact-email`, `notify-admins-new-content`.
- **Seguridad**: `verify-recaptcha`.

---

## 3. Modelo de datos

Tablas clave en `public`:

- `profiles` (+ vista `profiles_public` SECURITY DEFINER).
- `listings`, `requests`, `favorites`.
- `conversations`, `messages` (soft-delete por participante).
- `subscriptions` (+ vista `subscriptions_public`).
- `user_roles` + enum `app_role` + `has_role(user_id, role)` SECURITY DEFINER.
- Catálogos: `brands`, `categories`, `filter_options`.
- Moderación: `reports`, `notifications`.

**Reglas críticas**:

1. RLS habilitado + `GRANT`s explícitos en cada tabla `public`.
2. Roles solo en `user_roles`, nunca en `profiles`.
3. Vistas SECURITY DEFINER para exponer solo campos seguros (nunca email, `stripe_customer_id`, etc.).
4. Contadores públicos (ej. favoritos) vía RPC SECURITY DEFINER, no SELECT directo.

---

## 4. Suscripciones

| Plan   | Precio     | Anuncios | Peticiones | Fotos | Visibilidad              | Extras                             |
| ------ | ---------- | -------- | ---------- | ----- | ------------------------ | ---------------------------------- |
| Free   | 0€         | 1        | 1          | 2     | Retardada 24h            | —                                  |
| PRO    | 4,99€/mes  | ∞        | ∞          | 5     | Inmediata                | Insignia, prioridad sobre Free     |
| Retail | 19,99€/mes | ∞        | ∞          | ∞     | Inmediata, máx prioridad | Herramientas pro                   |

Modelo tipado desde el inicio: `SubscriptionTier = "free" | "pro" | "retail"` con la feature matrix
centralizada en `src/lib/subscription.ts`. **Nada de `isPro: boolean`.**

---

## 5. Objetivos de arquitectura (aplicar desde el primer commit de cada área)

### 5.1 Suscripciones tipadas

- `SubscriptionTier` + feature matrix en `src/lib/subscription.ts`.
- Consumido por `useSubscriptionLimits`, `useListings`, `useRequests`, Edge Functions y RLS.

### 5.2 Capa de datos

- Queries Supabase en `src/lib/api/*` (`listings.ts`, `requests.ts`, ...), no en los hooks.
- `queryKey`s unificadas en `src/lib/queryKeys.ts`.
- Helper `handleSupabaseError` para errores + toasts.

### 5.3 Componentes

- Páginas grandes divididas en subcomponentes por responsabilidad.
- Schemas Zod en `src/lib/schemas/` reutilizados por `Publicar*` y `Edit*Dialog`.

### 5.4 Design system

- Todo color/sombra/gradiente como token semántico (Tailwind v4, en `index.css`).
- Nada de `text-white`, `bg-[#...]` en componentes. Verificar contraste y modo oscuro por página.

### 5.5 Edge Functions

- Utilidades comunes en `supabase/functions/_shared/` (CORS, auth, Resend, logger).
- Validar payloads con Zod (Deno). Respuestas homogéneas `{ ok, data, error }`.
- Tests para `stripe-webhook` y `check-subscription`.

### 5.6 Seguridad

- Cada policy RLS a mínimo privilegio. Ninguna vista/tabla expone PII sensible.
- Tests de integración RLS (`anon` vs `authenticated` vs `service_role`).

### 5.7 Testing y CI

- Vitest para hooks y utilidades (empezar por subscription, schemas, formatters).
- Playwright para flujos críticos: publicar anuncio, crear petición, checkout Stripe test, mensajería.

### 5.8 SEO y rendimiento

- `<title>` y `<meta description>` por ruta. JSON-LD `Product` en `/producto/:id`.
- `React.lazy` + `Suspense` en rutas pesadas, lazy loading de imágenes.

---

## 6. Convenciones innegociables

- **No editar** `src/integrations/supabase/client.ts`, `types.ts`, ni `.env`.
- **No tocar** schemas Supabase reservados: `auth`, `storage`, `realtime`, `supabase_functions`, `vault`.
- Migraciones: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `CREATE POLICY` en el MISMO fichero.
- Roles: **siempre** vía `user_roles` + `has_role()`.
- Secrets: tooling de Lovable, nunca en código.
- OAuth `redirect_uri`: `${window.location.origin}` o `/auth/callback`, nunca ruta protegida.
- Design tokens semánticos, nada de colores hardcodeados.
- Hacia el usuario: "Lovable Cloud" / "backend" (nunca "Supabase").

---

## 7. Flujo por hito

1. Leer los ficheros implicados en paralelo.
2. Proponer un plan corto antes de tocar código.
3. Commits pequeños y verificables.
4. `npm run typecheck` + `npm test` (y revisar consola/red) antes de cerrar el hito.

---

## 8. Comandos útiles

```bash
npm install
npm run dev

# Typecheck
npm run typecheck

# Tests
npm test

# Lint / formato
npm run lint
npm run format
```

---

## 9. Riesgos conocidos

- El webhook de Stripe es la fuente de verdad de la suscripción: desplegar en orden DB → funciones → UI.
- Vistas SECURITY DEFINER minimalistas; no añadir columnas sensibles sin revisión.

---

_Mantén este archivo actualizado cuando la arquitectura evolucione._
