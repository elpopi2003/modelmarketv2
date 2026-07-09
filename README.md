# ModelMarket

Marketplace de coleccionismo de maquetas y modelos a escala. **0% de comisión** entre usuarios.

> Construcción **greenfield** por hitos. Ver [`CLAUDE.md`](./CLAUDE.md) para arquitectura,
> convenciones y el roadmap (M0 → M7).

## Stack

- **Frontend**: React 19 + TypeScript + Vite 7, Tailwind **v4** (config CSS-first), shadcn/ui.
- **Estado / datos**: React Router v6, TanStack Query, React Hook Form + Zod.
- **Backend** (pendiente): Lovable Cloud (Supabase — Postgres + RLS, Auth, Storage, Edge Functions).
- **Pagos** (pendiente): Stripe. **Email** (pendiente): Resend.
- **Test**: Vitest + Testing Library.

## Requisitos

- Node ≥ 20.19 (probado con Node 24).
- npm (gestor de paquetes del proyecto).

## Puesta en marcha

```bash
npm install
cp .env.example .env   # y rellena las claves de Lovable Cloud
npm run dev
```

## Scripts

| Script                | Qué hace                                  |
| --------------------- | ----------------------------------------- |
| `npm run dev`         | Servidor de desarrollo (Vite).            |
| `npm run build`       | Typecheck + build de producción.          |
| `npm run preview`     | Sirve el build de producción.             |
| `npm run typecheck`   | `tsc --noEmit`.                           |
| `npm run lint`        | ESLint.                                    |
| `npm run format`      | Prettier (escribe).                       |
| `npm test`            | Vitest (una pasada).                       |
| `npm run test:watch`  | Vitest en modo watch.                      |

## Estado

- [x] **M0 — Andamiaje**: Vite + React + TS + Tailwind v4 + shadcn, ESLint/Prettier, Vitest, CI.
- [x] **M1 — Fundaciones de dominio**: `SubscriptionTier` + feature matrix, `queryKeys`, `handleSupabaseError`, cliente Supabase, router con layouts + lazy.
- [x] **M2 — Auth + perfil**: backend Supabase conectado, auth (login/registro/guards), migración `profiles`+`user_roles` con RLS, página de perfil. Verificado en vivo.
- [ ] M3 — Listings · M4 — Requests/mensajería · M5 — Stripe · M6 — Admin/Edge · M7 — SEO/perf.
