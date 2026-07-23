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
- [ ] **M7 · SEO, rendimiento, tests e2e**.

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
