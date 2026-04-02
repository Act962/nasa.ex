# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies (uses pnpm)
pnpm install

# Development — Next.js only
pnpm dev

# Development — Next.js + Inngest (background jobs) together via mprocs
pnpm dev:all

# Inngest dev server only
pnpm inngest:dev

# Lint
pnpm lint

# Build (runs prisma generate + prisma migrate deploy + next build)
pnpm build

# Database
pnpm db:migrate       # prisma migrate dev (create + apply migrations)
pnpm db:generate      # prisma generate (regenerate client after schema changes)
pnpm db:seed          # seed the database
pnpm db:studio        # open Prisma Studio UI
```

No test runner is configured — there are no test scripts.

## Environment Setup

Copy `.examplo.env` to `.env` and fill in:
- `DATABASE_URL` — PostgreSQL connection string (local: `postgresql://docker:docker@localhost/nasa_db`)
- `BETTER_AUTH_SECRET` — random secret for auth
- `BETTER_AUTH_URL` / `NEXT_PUBLIC_BASE_URL` — app base URL (dev: `http://localhost:3000`)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — optional Google OAuth

Start local Postgres with Docker: `docker-compose up -d` (creates `nasa_db` on port 5432, user/pass `docker`).

The Prisma client is generated into `src/generated/prisma` (not `node_modules`), so always run `pnpm db:generate` after schema changes.

## Architecture

**N.A.S.A** is a lead-tracking / CRM platform built on Next.js 16 App Router.

### Request Flow

Client components → `orpc` TanStack Query utils (`src/lib/orpc.ts`) → `POST /api/rpc` → router (`src/app/router/index.ts`) → domain route handlers.

Server components use the direct router client (`src/lib/orpc.server.ts`) which bypasses HTTP entirely.

### RPC Layer (`orpc`)

All data-fetching goes through `orpc`. The single router is assembled in `src/app/router/index.ts` and served at `/api/rpc`. Each domain has its own file under `src/app/router/` (leads, status, trackings, org, workflow, etc.). Route handlers use oRPC middleware defined in `src/app/middlewares/`:
- `base.ts` — base middleware
- `auth.ts` — requires session via `better-auth` (`requiredAuthMiddleware`)
- `org.ts` — requires active organization in session
- `admin.ts` — requires system admin role

### Authentication

`better-auth` handles auth at `src/lib/auth.ts`. Supports email/password and Google OAuth. Auth endpoints live at `/api/auth/*`. Session hooks log login activity and upsert user presence.

### App Route Groups

```
src/app/
  (auth)/          — sign-in, sign-up pages
  (platform)/
    (orgs)/        — org-scoped pages: tracking, leads, workspaces, forge, nbox, insights, etc.
    (tracking)/    — tracking-specific nested routes
  (home)/          — landing/home
  (public)/        — public-facing pages (booking chat, forms, etc.)
  (admin)/         — system admin pages
  api/             — route handlers (auth, rpc, inngest, s3, stripe, chat, etc.)
```

### Feature Modules

Most UI lives in `src/features/<domain>/`. Patterns within each feature:
- `components/` — React components
- `hooks/` — TanStack Query hooks wrapping `orpc` utils
- `server/routes.ts` — oRPC route definitions (for features not in `src/app/router/`)

### Background Jobs (Inngest)

Async/scheduled functions are in `src/inngest/functions/`. The Inngest handler is at `/api/inngest`. Inngest realtime channels live in `src/inngest/channels/`. Run `pnpm dev:all` (mprocs) to start both Next.js and the Inngest dev server simultaneously.

### Key Libraries

| Concern | Library |
|---|---|
| UI components | Radix UI primitives + shadcn/ui patterns |
| Styling | Tailwind CSS v4 |
| State (server) | TanStack Query via `orpc` |
| State (client) | Zustand + Jotai |
| Forms | React Hook Form + Zod v4 |
| Drag & Drop | `@dnd-kit` |
| Rich text | TipTap |
| Tables | TanStack Table |
| Data viz | Recharts |
| Emails | Resend + React Email |
| File storage | AWS S3 (client in `src/lib/s3-client.ts`) |
| Real-time | Pusher (`src/lib/pusher.ts`) |
| Payments | Stripe (`src/lib/stripe.ts`) |

### Database

PostgreSQL via Prisma 7. Schema at `prisma/schema.prisma`. Client output: `src/generated/prisma`. Core models: `User`, `Organization`, `Member`, `Tracking`, `Status`, `Lead`, `Tag`, `Action`, `Workflow`, `Form`, and many more domain models.

### Sidebar / Apps System

`src/lib/sidebar-items.ts` defines the sidebar navigation items with visibility preferences. Users can toggle which apps appear in their sidebar. The `/apps` page (`src/features/apps/`) is the app store/launcher; always visible.
