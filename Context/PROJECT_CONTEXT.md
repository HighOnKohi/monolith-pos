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

**Full multi-interface operational POS system with real-time sync & background polling.**

- Project architecture & Supabase Auth established
- Customer QR Ordering interface (`/customer/:tableId`) operational with floating order summary card overlapping menu above navbar, direct dish adding, best sellers sorting, compressed orders hub, live status notifications, and conditional bill out
- Kitchen Management interface (`/kitchen`) operational with kitchen-first order verification, stock validation, global out-of-stock marking, cancellation reason logging, and order progression
- Cashier interface (`/cashier`) operational with table assistance acknowledgement, verified order monitoring, and bill settlement
- Table Manager interface (`/tables`) with live floor plan layout and assistance call badges
- Dual-channel sync: Supabase Realtime (WebSockets) + silent background polling (2.5s - 5s) across all active views ensuring zero-flicker resilience

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
  ├── Restaurant_Orders  (TABLE_ID)
  │     └── Order_Items  (ORDER_ID)
  │           ├── Menu_Items  (ITEM_ID)
  │           │     └── Menu_Categories  (CATEGORY_ID)
  │           └── Discounts  (ORDER_ITEM_ID)
  │                 └── Restaurant_Orders  (ORDER_ID)
  └── Bill_Requests  (TABLE_ID, ORDER_ID)
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
| `ORDER_STATUS` | text | `REQUESTED` \| `VERIFIED` \| `PREPARING` \| `READY` \| `SERVED` \| `CANCELLED` |
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
- [x] UI design system (Button, Input, Card, PageHeader, EmptyState)
- [x] Customer QR Ordering Interface (`/customer/:tableId`, redirect `/customer` -> `/customer/table-1`):
  - Direct "Add to Dish" adding without opening modal
  - Modal customization triggered on image click
  - Floating Place Order holder card overlapping the menu above the bottom navbar (`fixed bottom-[80px] inset-x-0 z-30`), keeping the navbar permanently accessible and replacing takeout clutter with dine-in default
  - Clear cart action with live total calculation (inclusive of 5% tax)
  - Top header Orders navigation button with order count badge & live status change indicator
  - Best Sellers tab & dynamic category badge sorting
  - Compressed Orders Hub combining multiple table tickets into a single unified summary
  - Assist Request modal with 5 options (Water, Waiter, Utensils/Napkins, Bill Out, Other)
  - Realtime order status changes with animated slide-down toasts and pulsing/blinking Orders tab
  - Conditional Bill Out (button only enabled/visible once all active table orders are `SERVED`)
  - Live staff assistance acknowledgement resolution sync via broadcast & 3s polling
- [x] Kitchen Management Interface (`/kitchen`):
  - Kitchen-first workflow: new orders (`REQUESTED`) appear in the kitchen for stock checks before Cashier review
  - Order acceptance (`REQUESTED` -> `VERIFIED`) which alerts cashier and customer
  - Order rejection/cancellation with reason prompt and optional global "Out of Stock" marking (`Menu_Items.ITEM_STATUS = 'OUT_OF_STOCK'`)
  - Kitchen order progression: `VERIFIED` -> `PREPARING` -> `READY` -> `SERVED`
  - Daily served items log / stats counter
- [x] Cashier Interface (`/cashier`):
  - Table Assistance Requests feed with functional "Acknowledge" action
  - Bill Requests feed with bill breakdown and "Complete / Paid" action
  - Kitchen-Verified Orders overview and acknowledgment
- [x] Table Layout Management (`/tables`) with live assistance indicators
- [x] Supabase Realtime Channels + Silent Background Polling (2.5s - 5s) across all interfaces ensuring zero-flicker live sync and visibility re-sync

### Next Steps / Backlog
- [ ] Menu / category CRUD in MenuManager
- [ ] Analytics data + charts
- [ ] Staff account management in AccountManager
- [ ] Role-based access control (RBAC)
- [ ] Order auditing / logs in OrderLogs

---

---

## State Synchronization, Kitchen, Menu Manager & Cashier Architecture

### 1. Source of Truth Hierarchy
```text
                  ┌───────────────────────────────┐
                  │      Supabase PostgreSQL      │
                  │     (Authoritative Source)    │
                  └───────────────┬───────────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │ Realtime Events        │ Realtime Events        │ Realtime Events
         ▼                        ▼                        ▼
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│     Kitchen     │      │     Cashier     │      │  Menu Manager   │
└────────┬────────┘      └────────┬────────┘      └────────┬────────┘
         │                        │                        │
         └────────────────────────┼────────────────────────┘
                                  ▼
                       ┌─────────────────────┐
                       │    Customer Menu    │
                       └─────────────────────┘
```

- **Database Authority**: UI state is strictly a reflection of database mutations. No fake local state changes or artificial `setTimeout` fakes.
- **Dual-Channel Reconciliation**: Supabase Realtime WebSocket events propagate changes within milliseconds; background polling (2500ms - 5000ms) guarantees self-healing against dropped network frames or mobile sleep.

---

### 2. Kitchen Order Rejection & Availability Workflow
- **Order Rejection**:
  1. Kitchen clicks "Reject / OOS" on incoming order.
  2. Modal opens requiring reason and optional item selection to mark globally Sold Out.
  3. Kitchen Service (`cancelKitchenOrder`):
     - Sets selected items to `OUT_OF_STOCK` in `Menu_Items`.
     - Tries updating `ORDER_STATUS` to `'CANCELLED'`.
     - Resilient Fallback: If publication replica identity or check constraint rejects the update, deletes associated child `Order_Items` first to satisfy foreign keys, then attempts parent deletion.
     - Checks if the table has any remaining orders with active items; if none remain, resets table `STATUS` to `'AVAILABLE'`.
  4. UI immediately closes modal, cleans up modal state, and removes the order from the active queue. Orders with 0 items are filtered out across all queries.

- **Kitchen Dish Availability Controls**:
  - Staff can access the dedicated "Dish Stock & Availability" panel directly in `/kitchen` via the header button `Dish Stock (N Sold Out)`.
  - Instant one-tap toggling between `Available` and `Sold Out` via `toggleItemAvailability(itemId, status)` updating `Menu_Items.ITEM_STATUS`.
  - Realtime subscribers (`useMenu`, `useRealtimeMenu`) immediately receive the event and propagate sold-out badges and disabled ordering across Cashier and Customer menus.

---

### 3. Menu Manager Editing Architecture
- **Servio-Style Slide-In Sidebar** (`MenuItemEditSidebar.tsx` & `menu-edit-sidebar.css`):
  - Glides smoothly from the right with a backdrop blur and smooth cubic-bezier transitions.
  - Keyboard accessible (ESC closes) and responsive on mobile devices.
  - Fields: Item Name (required), Price (₱, numeric, non-negative), Category (dropdown from active categories), Description, Image URL (with live preview), Availability toggle (`AVAILABLE` / `OUT_OF_STOCK`), and Dietary Type (`veg` / `non-veg`).
  - Validation before mutation: flags empty names, non-finite/negative prices, and invalid categories.
  - Error Handling: If database mutation fails, sidebar remains open with an error banner, preserving all user edits.
  - Success Handling: Saves to Supabase via `updateMenuItem`, reloads menu, closes sidebar, and displays a success toast.
  - Realtime Sync: `useMenu` listens to `Menu_Items` and `Menu_Categories` postgres changes, keeping the grid synchronized in real time.

---

### 4. Cashier Settlement & Bill Clearing Flow
```text
Table Selected
      ↓
Active Orders & Punched Cart
      ↓
Click "Complete Payment / Settle Bill →"
      ↓
1. buildReceiptSnapshot(...) captures exact line items, discounts, tax, subtotal, and total
      ↓
2. settleTableOrders(tableId) completes/clears active orders in Supabase
      ↓
3. updateBillRequestStatus(requestId, 'PAID')
      ↓
4. Reset Restaurant_Tables (STATUS = 'AVAILABLE', BILL_OUT_REQUESTED = false, CURRENT_GUEST_COUNT = 0)
      ↓
5. Clear cashier active bill & punchCart
      ↓
6. Display ReceiptPreviewModal with captured snapshot
```
- **Authoritative Bill Clearing**: Previously, orders were left in `SERVED` state, causing them to re-appear on any refetch. Now, `settleTableOrders` transitions orders to `'COMPLETED'` and clears child `Order_Items`. `fetchOrdersByTable` filters out orders with 0 items.
- **Fail-Safe Receipt Snapshot**: Receipt data is frozen in memory BEFORE clearing table state, ensuring receipts never show blank ₱0.00 data.
- **Persistence Verification**: Reloading the cashier page confirms Table Bill shows `No active orders`, Subtotal `₱0.00`, Grand Total `₱0.00`, and `Complete Payment` is disabled.

---

---

### 6. Order Logs Interface & Lifecycle Event System
- **Route**: `/order-logs` (configured in `src/routes/index.tsx` and `src/config/navigation.ts`).
- **Purpose**: Staff/Admin audit trail providing complete historical transparency into all restaurant orders, timeline milestones, financial reconciliations, and cancellations.
- **Key Capabilities**:
  - **Summary KPI Header**: 8 key performance indicators reflecting the active filtered dataset: Total Orders, Completed Orders (% rate), Cancelled / Rejected Orders, Filtered Revenue, Average Order Value (AOV), Average Serving Time, Customers Served, and Paid vs Unpaid status.
  - **Multi-Criteria Filter Bar**: Realtime text search across Order ID, Table, and Notes (debounced 300ms); Date range quick presets (Today, Yesterday, Last 7 Days, Last 30 Days, All Time, Custom Range); Dropdown selectors for Order Status, Payment Status, Payment Method, Order Source (Customer App vs Cashier Station), and Table selector.
  - **Order Log Table & Mobile Cards**: Responsive layout with sorting on Order ID, Date/Time, Total Bill, and Status. Visual badges for source channel, payment status, and order status.
  - **Order Details Side Drawer (`OrderDetailsDrawer`)**: 
    - **Header**: Order ID, status pill, table / merged session indicator, guest count, and date.
    - **Order Items Tab**: Aggregated line items grouped by category with quantity counters, unit prices, line subtotals, and special instructions.
    - **Timeline & Audit Tab**: Visual chronological milestones from creation to completion with actor badges and notes.
    - **Payment & Billing Tab**: Itemized financial breakdown (subtotal, senior/PWD/custom discounts, net total, payment method) alongside operational stage timestamps.
  - **Export Capabilities**:
    - **CSV Export** (`orderLogsCsv.ts`): RFC-4180 compliant CSV generator with quoted values and accurate currency fields.
    - **PDF Export** (`orderLogsPdf.ts`): Multi-page branded PDF report using `jspdf` and `jspdf-autotable` with corporate header, summary KPI grid, and paginated order table.
    - **Native Print**: Dedicated CSS `@media print` rules hiding navigation shell, filter bar, and pagination for clean thermal/office paper printing.
  - **Database Migration 010**: `Context/migrations/010_order_logs_and_events.sql` introducing `Order_Events` table, `PAYMENT_METHOD` on `Restaurant_Orders`, and indexes. Fallback synthetic timeline milestones ensure full audit logs even on historic database records.
---

### 7. Account Manager & Staff Access Control System
- **Route**: `/accounts` (configured in `src/routes/index.tsx` and `src/config/navigation.ts`).
- **Purpose**: Centralized administration interface for managing restaurant staff user accounts, role-based access control (RBAC), and permissions.
- **Key Capabilities**:
  - **Summary Metrics**: Real-time KPI cards displaying Total Accounts (% active), Active Staff, Administrators, and Inactive/Disabled counts.
  - **Search & Filter Bar**: Debounced search by staff name, email, phone, or role, with quick role and status filter selectors.
  - **Staff Accounts Table**: Responsive desktop table with avatar initials, role badge, status indicator, last active timestamp, and mobile-friendly card layout for handheld POS devices.
  - **Sliding Staff Drawer (`StaffDrawer`)**:
    - **View Mode**: Full profile card, contact details, assigned role description, and checklist of 7 granular permissions (active in emerald, inactive in muted grey).
    - **Create Mode**: Comprehensive account setup with full name, email, phone, role selector (auto-populating default role permissions), granular permission overrides, internal notes, and option to dispatch a password setup invite.
    - **Edit Mode**: Profile and access adjustments with immediate validation.
  - **Security & Administrator Protection Guards**:
    - Prevents the currently logged-in administrator from removing their own admin privileges.
    - Prevents deactivating or demoting the final active administrator in the system.
    - Confirmation modals for deactivation and role modifications explicitly explaining that historical orders, payments, and audit logs remain intact.
    - Password resets trigger Supabase's native `supabase.auth.resetPasswordForEmail()` without exposing plaintext secrets or service-role keys.
- **Database Migration 011**: `Context/migrations/011_staff_accounts_and_roles.sql` defining `Staff_Accounts` table with status and role check constraints, performance indexes, and initial seed staff accounts.
- **Service Layer**: `src/services/staffAccountService.ts` encapsulates all account queries, mutations, role safety checks, and seamless fallback storage to ensure zero downtime.

---

## Development History

### 2026-09-06 — Kitchen, Menu Manager & Cashier State Synchronization Fix
- Created `MenuItemEditSidebar.tsx` and `menu-edit-sidebar.css` providing Servio-style slide-in item editing in Menu Manager.
- Added Supabase Realtime channel subscription in `useMenu` for instant item/category reconciliation.
- Added Kitchen Dish Stock & Availability control panel in `/kitchen` with one-tap status toggling.
- Added `settleTableOrders` in `orderService.ts` and updated `handleCompletePayment` in Cashier for atomic receipt snapshotting, order completion, table status reset, and bill clearing.
- Updated `fetchOrdersByTable` and `fetchKitchenOrders` to filter out orders with 0 items, eliminating ghost orders and phantom totals across reloads.
- Created `Context/migrations/005_fix_orders_replica_identity_and_status.sql` for PostgreSQL `REPLICA IDENTITY FULL` and check constraints.

### 2026-09-06 — Live Sync, Realtime Workflow & UI Optimization
- Floating place order holder card overlapping the menu above the bottom navbar (`fixed bottom-[80px] inset-x-0 z-30 pointer-events-none`)
- Permanent bottom navigation bar (`MobileBottomNav`) retained for uninterrupted access to Menu, Orders, and Assist
- Removed takeout toggle from customer ordering; defaulted table QR orders to dine-in
- Added Clear Cart action and persistent Orders access button in customer header
- Connected realtime broadcast and background polling for instant staff assistance resolution
- Implemented dual-channel live sync across Customer, Kitchen, Cashier, and Table Management (Supabase Realtime + silent polling every 2.5s-5s + visibility re-fetch)
- Kitchen-first order verification with stock checking, order cancellation with reasons, and global out-of-stock propagation
- Conditional Bill Out logic (available only once all table orders are marked as served)
- Micro-animations, Google Fonts typography, and status change pulse badges

### 2026-09-05 — Initial Foundation & Restaurant Skeletons
- Created React 19 / Vite 6 / TypeScript project with Tailwind CSS 4
- Connected Supabase Auth (email/password) and created 8 page route skeletons

---

## Notes for Future Development

1. Read this file before making changes.
2. Inspect actual source before making assumptions — this file may lag behind.
3. Add navigation items in `src/config/navigation.ts` only.
4. Keep Supabase logic out of page components — use services/hooks.
5. Update this file after meaningful changes.

