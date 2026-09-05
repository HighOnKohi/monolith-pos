# Monolith Project Context

> This file is the persistent development reference for Monolith.
> Read this file before making any changes to the project.
> Inspect actual source code before making assumptions.
> Update this file after any meaningful change.

---

## Project Overview

| Field | Value |
|---|---|
| Project | Monolith |
| Type | Web-based Point-of-Sale (POS) System |
| Deployment | Vercel |
| Backend | Supabase (planned, not connected) |

---

## Current Development Stage

**Project skeleton / foundation.**

The architecture, tooling, and routing have been established.
No POS features, authentication, or business logic have been implemented.

---

## Technology Stack

### Frontend
- **React** 19
- **TypeScript** 5 (strict)
- **Vite** 6
- **React Router** 7 (`createBrowserRouter`, Data API)
- **Tailwind CSS** 4 (CSS-first, `@tailwindcss/vite` plugin)
- **Lucide React** — icons

### Auth / Backend
- **Supabase** (`@supabase/supabase-js`) — Auth connected (email/password)

### Hosting
- **Vercel** — SPA rewrite configured in `vercel.json`

### Backend *(planned)*
- **Supabase** — PostgreSQL, Auth, Row Level Security, Realtime, Storage
- Not connected. Client not created. No migrations or schemas defined.

---

## Design & Color Palette

| Color | Hex | Suggested Usage |
|---|---|---|
| Off-White/Light Gray | `#F1F6F9` | Backgrounds, surface areas |
| Dark Navy | `#14274E` | Primary text, main navigation, headers |
| Navy/Blue-gray | `#394867` | Secondary elements, borders, subtle text |
| Light Blue-gray | `#9BA4B4` | Muted text, disabled states, dividers |
| Yellow/Gold | `#E9C46A` | Accents, primary buttons, warnings |
| Red | `#C94A4A` | Destructive actions, errors |

---

## Database Schema

> Full schema with DDL: [`Context/DBSchema`](file:///c:/Users/vince/Documents/Thesis/monolith-pos/Context/DBSchema)
> Full annotated reference: [`PROJECT_CONTEXT.md — Database Schema`](file:///c:/Users/vince/Documents/Thesis/monolith-pos/PROJECT_CONTEXT.md)

### Tables

| Table | Purpose | Key Columns |
|---|---|---|
| `Restaurant_Tables` | Physical dining tables | `TABLE_ID`, `TABLE_NUM`, `STATUS`, `GUEST_CAPACITY`, `BILL_OUT_REQUESTED` |
| `Menu_Categories` | Menu item groupings | `CATEGORY_ID`, `CATEGORY_NAME` |
| `Menu_Items` | Orderable food/drink items | `ITEM_ID`, `CATEGORY_ID`, `ITEM_NAME`, `ITEM_PRICE`, `ITEM_IMAGE_URL` (Base64 in DB), `ITEM_STATUS` |
| `Restaurant_Orders` | Orders per table | `ORDER_ID`, `TABLE_ID`, `ORDER_STATUS`, `ORDER_TYPE`, `TOTAL_BILL` |
| `Order_Items` | Line items within an order | `ORDER_ITEM_ID`, `ORDER_ID`, `ITEM_ID`, `ORDER_ITEM_STATUS` |
| `Discounts` | Discounts on orders/items | `DISCOUNT_ID`, `ORDER_ID`, `PWD`, `SENIOR`, `CUSTOM_PERCENT`, `PESO_DISCOUNT` |

### Status Enums (enforced via CHECK constraints)

| Table | Column | Values |
|---|---|---|
| `Restaurant_Tables` | `STATUS` | `AVAILABLE`, `RESERVED`, `OCCUPIED`, `HAS_REQUEST` |
| `Menu_Items` | `ITEM_STATUS` | `AVAILABLE`, `OUT_OF_STOCK` |
| `Restaurant_Orders` | `ORDER_STATUS` | `REQUESTED`, `VERIFIED`, `PREPARING`, `READY` |
| `Restaurant_Orders` | `ORDER_TYPE` | `DINE-IN`, `TAKEOUT` |
| `Restaurant_Orders` | `REQUESTED_FROM` | `Cashier`, `Customer` |
| `Order_Items` | `ORDER_ITEM_STATUS` | `PENDING`, `PREPARING`, `SERVED` |

---

## Architecture

```text
monolith-pos/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/              # Static assets
│   ├── components/
│   │   ├── ui/              # Primitive UI components (empty)
│   │   ├── layout/          # Layout components (empty)
│   │   └── common/          # Shared components (empty)
│   ├── config/
│   │   └── app.ts           # Non-secret constants (APP_NAME, APP_VERSION)
│   ├── contexts/            # React Context providers (empty)
│   ├── hooks/               # Custom hooks (empty)
│   ├── layouts/
│   │   └── RootLayout.tsx   # Minimal shell layout (renders <Outlet />)
│   ├── lib/                 # Library initialization (empty; Supabase client goes here)
│   ├── pages/
│   │   ├── Home/            # Placeholder — /
│   │   ├── Login/           # Placeholder — /login
│   │   ├── Dashboard/       # Placeholder — /dashboard
│   │   ├── POS/             # Placeholder — /pos
│   │   └── NotFound/        # 404 for unmatched routes
│   ├── routes/
│   │   └── index.tsx        # Centralized createBrowserRouter config
│   ├── services/            # Business/service layer (empty)
│   ├── styles/
│   │   └── index.css        # Global styles + Tailwind v4 import
│   ├── types/
│   │   └── index.ts         # Shared TypeScript types (empty barrel)
│   ├── utils/               # Pure utilities (empty)
│   ├── App.tsx              # Root component — renders <RouterProvider>
│   └── main.tsx             # Entry point — mounts React into #root
├── index.html               # Vite HTML entry
├── .env.example             # Env var template (no real credentials)
├── .gitignore
├── CONTEXT.md               # This file
├── README.md
├── eslint.config.js         # ESLint flat config (React + TypeScript)
├── package.json
├── tsconfig.json            # Project references root
├── tsconfig.app.json        # Strict TS config for src/
├── tsconfig.node.json       # TS config for vite.config.ts
├── vite.config.ts           # Vite config with Tailwind + React plugins
└── vercel.json              # SPA rewrite rule
```

---

## Implemented

- [x] React 19 + Vite 6 + TypeScript (strict)
- [x] React Router 7 with `createBrowserRouter`
- [x] Route-level lazy loading (`React.lazy` + `Suspense` on all pages)
- [x] Tailwind CSS 4 (CSS-first via `@tailwindcss/vite`)
- [x] Placeholder pages: `/`, `/login`, `/dashboard`, `/pos`, `404`
- [x] Vercel SPA routing (`vercel.json` rewrite rule)
- [x] Environment variable template (`.env.example`)
- [x] ESLint flat config
- [x] Git configuration (`.gitignore`)
- [x] `CONTEXT.md`
- [x] `README.md`

## Not Implemented

- [ ] POS / kitchen / cashier business logic
- [ ] Database tables / RLS policies
- [ ] Supabase Realtime subscriptions
- [ ] Supabase Storage
- [ ] Role-based access control
- [ ] Menu / table / order CRUD
- [ ] Analytics charts
- [ ] External integrations (printers, barcode scanners, payment terminals)

---

## Architectural Decisions

### React 19 + Vite 6
Lightweight SPA architecture. Vite provides fast HMR in development and efficient production builds. Chosen for performance on low-end hardware.

### React Router 7 — `createBrowserRouter`
Uses the Data API router (not the legacy `<Routes>` component API). Enables clean route-level lazy loading and centralized configuration. All routes defined in `src/routes/index.tsx`.

### Tailwind CSS 4 — CSS-first configuration
No `tailwind.config.js`. Configuration done in CSS via `@import "tailwindcss"` in `src/styles/index.css`. Plugin: `@tailwindcss/vite`.

### Lazy-loaded pages
All page components are wrapped in `React.lazy()` + `<Suspense>`. This ensures route-level code splitting is active from the beginning and will scale cleanly as more pages are added.

### Supabase (planned)
Supabase will provide the backend. Intentionally not connected during the foundation stage to keep dependencies minimal and avoid premature architecture coupling. When connected, the Supabase client will be initialized in `src/lib/`.

### Vercel
Deployment target. SPA rewrite in `vercel.json` ensures client-side routes do not result in 404 errors when accessed directly.

### `@` path alias
All `src/` imports use `@/` alias (e.g., `import RootLayout from '@/layouts/RootLayout'`). Configured in both `vite.config.ts` and `tsconfig.app.json`.

---

## Environment Variables

| Variable | Description | Status |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Planned |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Planned |

> Never expose `SUPABASE_SERVICE_ROLE_KEY` or any privileged key to browser code.

---

## Project Constraints

- Prioritize performance on low-end PCs.
- Keep dependencies minimal — do not install libraries speculatively.
- Modification of UI/UX, layouts, and functionalities is explicitly allowed and encouraged to match reference designs or improve the mobile experience.
- Do not expose backend secrets to browser code.
- Web-only application — no Tauri, Electron, or native packaging.
- Deployment target is Vercel only.

---

## Test Accounts

| Email | Password | Role |
|---|---|---|
| `taponakawnt123@gmail.com` | `test1234` | Development test account |

---

## Known Issues

None currently known.

---

## Development History

### 2026-09-05 — Restaurant Management Skeleton + Auth

- Installed `@supabase/supabase-js` and `lucide-react`
- Connected Supabase Auth (email/password login/logout)
- Built `AuthContext`, `useAuth`, `ProtectedRoute`
- Built `AppLayout`, `AppHeader`, `AppSidebar` (mobile drawer + desktop persistent)
- Built navigation from centralized `src/config/navigation.ts`
- Created 8 page skeletons: Kitchen, Cashier, Customer, Tables, Menu, Analytics, Accounts, Order Logs
- Built UI design system: `Button`, `Input`, `Card`, `PageHeader`, `EmptyState`
- Rewrote routes: protected routes, public login, `/` → `/kitchen` redirect
- Removed old placeholder pages (Home, Dashboard, POS)
- Created `PROJECT_CONTEXT.md`

### 2026-09-05 — Initial Foundation

- Created project skeleton.
- Configured React 19, Vite 6, TypeScript 5 (strict).
- Configured React Router 7 with `createBrowserRouter` and lazy-loaded pages.
- Configured Tailwind CSS 4 (CSS-first).
- Set up placeholder pages: `/`, `/login`, `/dashboard`, `/pos`, `404`.
- Configured Vercel SPA routing (`vercel.json`).
- Added environment variable template (`.env.example`).
- Configured ESLint (flat config).
- Created `.gitignore`.
- Created `README.md`.
- Created `CONTEXT.md`.

---

## Notes for Future Development

1. Read this file before making any changes.
2. Inspect the actual source files before making assumptions.
3. Compare this file with the actual repository if in doubt — the repository is the source of truth.
4. Only implement what has been explicitly requested.
5. Update this file after any meaningful architectural change, feature addition, dependency change, or integration.
