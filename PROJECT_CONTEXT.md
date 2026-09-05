# Monolith — Project Context

> Persistent architecture reference for AI agents and developers.
> Read this before making changes. Inspect actual source code before making assumptions.
> Update after every meaningful architectural change.

---

## Project Overview

| Field | Value |
|---|---|
| Name | Monolith |
| Type | Web-based Restaurant Point-of-Sale System |
| Deployment | Vercel |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage) |

---

## Current Development Stage

**Frontend skeleton with Supabase Authentication.**

- Project architecture established
- Supabase Auth connected (email/password)
- Application layout (header + sidebar) implemented
- Navigation driven by centralized config
- 8 page route skeletons created
- No POS business logic implemented yet

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5 (strict) |
| Build Tool | Vite 6 |
| Routing | React Router 7 (`createBrowserRouter`) |
| Styling | Tailwind CSS 4 (CSS-first, `@tailwindcss/vite`) |
| Auth / Backend | Supabase (`@supabase/supabase-js`) |
| Icons | Lucide React |
| Hosting | Vercel |

---

## Environment Variables

| Variable | Description | Status |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ Set in `.env` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/publishable key | ✅ Set in `.env` |

> Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
> Never commit `.env` — use `.env.example` as the template.

---

## Database Schema

> Source of truth: [`Context/DBSchema`](file:///c:/Users/vince/Documents/Thesis/monolith-pos/Context/DBSchema)
> Schema is defined in Supabase (PostgreSQL). All table and column names use quoted UPPER_SNAKE_CASE identifiers.

### Entity Relationship Overview

```
Restaurant_Tables
  └── Restaurant_Orders  (TABLE_ID)
        └── Order_Items  (ORDER_ID)
              ├── Menu_Items  (ITEM_ID)
              │     └── Menu_Categories  (CATEGORY_ID)
              └── Discounts  (ORDER_ITEM_ID)
                    └── Restaurant_Orders  (ORDER_ID)
```

---

### `Restaurant_Tables`
Represents physical tables in the restaurant.

| Column | Type | Notes |
|---|---|---|
| `TABLE_ID` | bigint (PK, identity) | Primary key |
| `TABLE_NUM` | bigint | Table number, default `0` |
| `STATUS` | text | `AVAILABLE` \| `RESERVED` \| `OCCUPIED` \| `HAS_REQUEST` |
| `GUEST_CAPACITY` | bigint | Max guests, default `0` |
| `CURRENT_GUEST_COUNT` | bigint | Active guests, default `0` |
| `RESERVED_SINCE` | timestamp | When the table was reserved |
| `BILL_OUT_REQUESTED` | boolean | Whether bill-out has been requested, default `false` |

---

### `Menu_Categories`
Groups menu items into categories.

| Column | Type | Notes |
|---|---|---|
| `CATEGORY_ID` | bigint (PK, identity) | Primary key |
| `CATEGORY_NAME` | text | Category name (NOT NULL) |

---

### `Menu_Items`
Individual items available for ordering.

| Column | Type | Notes |
|---|---|---|
| `ITEM_ID` | bigint (PK, identity) | Primary key |
| `CATEGORY_ID` | bigint (FK) | → `Menu_Categories.CATEGORY_ID` |
| `ITEM_NAME` | text | Item name |
| `ITEM_DESCRIPTION` | text | Description |
| `ITEM_PRICE` | double precision | Price |
| `ITEM_IMAGE_URL` | text | In-database image (stored directly as Base64 Data URI) |
| `ITEM_STATUS` | text | `AVAILABLE` \| `OUT_OF_STOCK`, default `AVAILABLE` |

---

### `Restaurant_Orders`
An order placed for a specific table.

| Column | Type | Notes |
|---|---|---|
| `ORDER_ID` | bigint (unique) | Logical order identifier |
| `ORDER_ITEMS_ID` | bigint (PK) | Primary key |
| `TABLE_ID` | bigint (FK) | → `Restaurant_Tables.TABLE_ID` |
| `REQUESTED_FROM` | text | `Cashier` \| `Customer`, default `None` |
| `ORDER_TYPE` | text | `DINE-IN` \| `TAKEOUT`, default `Dine-in` |
| `ORDER_STATUS` | text | `REQUESTED` \| `VERIFIED` \| `PREPARING` \| `READY` |
| `SUBTOTAL_BILL` | double precision | Pre-discount subtotal, default `0` |
| `TOTAL_BILL` | double precision | Post-discount total, default `0` |
| `TIME` | timestamp | Order timestamp |

---

### `Order_Items`
Individual line items within an order.

| Column | Type | Notes |
|---|---|---|
| `ORDER_ITEM_ID` | bigint (PK, identity) | Primary key |
| `ORDER_ID` | bigint (FK) | → `Restaurant_Orders.ORDER_ID` |
| `ITEM_ID` | bigint (FK) | → `Menu_Items.ITEM_ID` |
| `DISCOUNT_ID` | bigint | Optional link to a discount |
| `ORDER_ITEM_STATUS` | text | `PENDING` \| `PREPARING` \| `SERVED`, default `PENDING` |

---

### `Discounts`
Discount records applied to an order or a specific order item.

| Column | Type | Notes |
|---|---|---|
| `DISCOUNT_ID` | bigint (PK, identity) | Primary key |
| `ORDER_ID` | bigint (FK) | → `Restaurant_Orders.ORDER_ID` |
| `ORDER_ITEM_ID` | bigint (FK, nullable) | → `Order_Items.ORDER_ITEM_ID` |
| `PWD` | boolean | PWD discount applied, default `false` |
| `PWD_AMOUNT` | bigint | PWD discount amount, default `0` |
| `SENIOR` | boolean | Senior discount applied, default `false` |
| `SENIOR_AMOUNT` | bigint | Senior discount amount, default `0` |
| `CUSTOM_PERCENT` | bigint | Custom percentage discount, default `0` |
| `PESO_DISCOUNT` | double precision | Fixed peso discount, default `0` |

---

### Raw DDL

See [`Context/DBSchema`](file:///c:/Users/vince/Documents/Thesis/monolith-pos/Context/DBSchema) for the complete `CREATE TABLE` statements.

---

## Routes

| Route | Page | Auth |
|---|---|---|
| `/login` | LoginPage | Public |
| `/` | → redirect `/kitchen` | Protected |
| `/kitchen` | KitchenPage | Protected |
| `/cashier` | CashierPage | Protected |
| `/customer` | CustomerPage | Protected |
| `/tables` | TableManagerPage | Protected |
| `/menu` | MenuManagerPage | Protected |
| `/analytics` | AnalyticsPage | Protected |
| `/accounts` | AccountManagerPage | Protected |
| `/order-logs` | OrderLogsPage | Protected |
| `*` | NotFoundPage | Public |

---

## Navigation Structure

Defined **once** in `src/config/navigation.ts`. Three sections:

### Front Ops
- Kitchen Interface → `/kitchen`
- Cashier Interface → `/cashier`
- Customer Interface → `/customer`

### Management
- Table Manager → `/tables`
- Menu Manager → `/menu`
- Analytics → `/analytics`

### Admin
- Account Manager → `/accounts`
- Order Logs → `/order-logs`

Do not define navigation items anywhere other than `src/config/navigation.ts`.

---

## Architecture

```text
src/
├── components/
│   ├── auth/
│   │   └── ProtectedRoute.tsx     # Reads useAuth(); redirects to /login if no user
│   ├── common/
│   │   └── PageLoader.tsx         # Full-screen loading fallback
│   ├── layout/
│   │   ├── AppHeader.tsx          # Top bar: burger, page title, user, logout
│   │   ├── AppSidebar.tsx         # Sidebar: mobile drawer / desktop persistent
│   │   └── NavigationItem.tsx     # Single nav link (icon + title + description)
│   └── ui/
│       ├── Button.tsx             # Variants: primary, secondary, danger, ghost
│       ├── Card.tsx               # Bordered card + CardHeader
│       ├── EmptyState.tsx         # Centered placeholder with icon
│       ├── Input.tsx              # Labeled input with error state
│       └── PageHeader.tsx         # Page h1 + description + optional action
├── config/
│   ├── app.ts                     # APP_NAME, APP_VERSION constants
│   └── navigation.ts              # Single navigation config source of truth
├── contexts/
│   └── AuthContext.tsx            # AuthProvider + useAuthContext
├── hooks/
│   └── useAuth.ts                 # Public hook: useAuth()
├── layouts/
│   ├── AppLayout.tsx              # Authenticated shell (header + sidebar + outlet)
│   └── RootLayout.tsx             # Public shell
├── lib/
│   └── supabase.ts                # Supabase client singleton
├── pages/
│   ├── AccountManager/
│   ├── Analytics/
│   ├── Cashier/
│   ├── Customer/
│   ├── Kitchen/
│   ├── Login/                     # Real Supabase login form
│   ├── MenuManager/
│   ├── NotFound/
│   ├── OrderLogs/
│   └── TableManager/
├── routes/
│   └── index.tsx                  # createBrowserRouter config
├── styles/
│   └── index.css                  # Tailwind v4 + global styles + color theme
├── types/
│   └── index.ts                   # Shared TS types (empty barrel)
├── App.tsx                        # AuthProvider + RouterProvider
└── main.tsx                       # React DOM entry
```

---

## Authentication Architecture

- **Client**: `src/lib/supabase.ts` — single `createClient()` instance
- **Context**: `src/contexts/AuthContext.tsx` — `AuthProvider` wraps the entire app
- **Hook**: `src/hooks/useAuth.ts` — `useAuth()` for all component consumption
- **Guard**: `src/components/auth/ProtectedRoute.tsx` — redirects unauthenticated users
- **Login**: `src/pages/Login/index.tsx` — email/password form, calls `signIn()`
- **Logout**: `AppHeader` calls `signOut()` from `useAuth()`

Auth state is managed via `supabase.auth.onAuthStateChange()`. `loading: true` during session hydration prevents unauthenticated flash on protected routes.

---

## Design System

### Color Palette

| Token | Hex | Usage |
|---|---|---|
| `--color-primary` | `#14274E` | Text, nav, headers |
| `--color-secondary` | `#394867` | Secondary elements, borders |
| `--color-accent` | `#E9C46A` | Accents, focus rings |
| `--color-background` | `#F1F6F9` | Page background |
| `--color-muted` | `#9BA4B4` | Muted text, icons |
| `--color-danger` | `#C94A4A` | Errors, destructive actions |

### Key Components
- `Button` — 4 variants, 3 sizes, loading state
- `Input` — labeled, error state, accessible id
- `Card` / `CardHeader` — bordered white container
- `PageHeader` — page h1 + description + optional action slot
- `EmptyState` — icon + text placeholder

---

## Design Decisions

### Centralized Navigation Config
All 8 interfaces are defined once in `src/config/navigation.ts`. The sidebar, header page title resolver, and any future breadcrumbs all derive from this single array.

### ProtectedRoute via `<Outlet />`
Uses React Router's nested route pattern — `ProtectedRoute` is a layout route, not a HOC. Cleaner than wrapping individual pages.

### AuthProvider at App root
Wraps `RouterProvider` so auth state is available to `ProtectedRoute` and all pages without prop drilling.

### Lazy loading on all pages
Every page is `React.lazy()` + `Suspense`. Code splitting is active from day one.

### AppLayout separate from ProtectedRoute
`ProtectedRoute` handles auth logic; `AppLayout` handles UI shell. Separation of concerns.

---

## Project Constraints

- Performance-first: minimal dependencies, lazy loading, small bundle
- Web-only: no Tauri, Electron, native packaging
- Deployment: Vercel only
- Modification of UI/UX, layouts, and functionalities is explicitly allowed to improve the mobile/POS experience and match design references.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code
- Navigation defined in one place only
- No Supabase logic in presentation components

---

## Test Accounts

| Email | Password | Notes |
|---|---|---|
| `taponakawnt123@gmail.com` | `test1234` | Development test account |

---

## Known Issues

None currently known.

---

## Implementation Status

### Implemented
- [x] React 19 + Vite 6 + TypeScript (strict)
- [x] Tailwind CSS 4 + design color palette
- [x] React Router 7 with centralized config + lazy loading
- [x] Supabase client (`src/lib/supabase.ts`)
- [x] AuthContext + useAuth hook
- [x] ProtectedRoute (redirect to `/login`)
- [x] Login page (email/password, error state, loading state)
- [x] Logout (from AppHeader)
- [x] AppLayout (header + sidebar)
- [x] AppSidebar (mobile drawer + desktop persistent)
- [x] Navigation from centralized config
- [x] All 8 page route skeletons
- [x] UI design system (Button, Input, Card, PageHeader, EmptyState)
- [x] Vercel SPA routing
- [x] ESLint + TypeScript strict

### Not Implemented
- [ ] Kitchen order management
- [ ] Cashier / billing / payments
- [ ] Customer QR ordering
- [ ] Table layout management
- [ ] Menu / category CRUD
- [ ] Analytics data + charts
- [ ] Staff account management
- [ ] Role-based access control
- [ ] Order auditing / logs
- [ ] Supabase database tables / RLS
- [ ] Supabase Realtime subscriptions
- [ ] Supabase Storage

---

## Development History

### 2026-09-05 — Initial Foundation
- Created React/Vite/TypeScript project skeleton
- Configured Tailwind CSS 4, React Router 7, ESLint, Vercel deployment

### 2026-09-05 — Restaurant Management Skeleton + Auth
- Installed `@supabase/supabase-js` and `lucide-react`
- Connected Supabase Auth (email/password)
- Built AuthContext, useAuth, ProtectedRoute
- Built AppLayout, AppHeader, AppSidebar
- Built NavigationItem driven by centralized `navigation.ts`
- Built 8 page skeletons (Kitchen, Cashier, Customer, Tables, Menu, Analytics, Accounts, Order Logs)
- Built UI design system components (Button, Input, Card, PageHeader, EmptyState)
- Updated color palette and focus/scrollbar styles
- Updated routes: protected routes, public login, `/` → `/kitchen` redirect
- Removed old placeholder pages (Home, Dashboard, POS)

---

## Notes for Future Development

1. Read this file before making changes.
2. Inspect actual source before making assumptions — this file may lag behind.
3. Add navigation items in `src/config/navigation.ts` only.
4. Keep Supabase logic out of page components — use services/hooks.
5. Update this file after meaningful changes.
