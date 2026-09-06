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
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage) |

---

## Current Development Stage

**Full multi-interface operational POS system with real-time sync & background polling.**

Core restaurant operational workflows are fully connected to Supabase:
- **Customer QR Ordering Interface (`/customer/:tableId`)**:
  - Direct 1-tap "Add to Dish" adding without modal disruption
  - Image tap opens item detail modal for cooking notes
  - Floating Place Order holder card overlapping the menu above the bottom navbar (`fixed bottom-[80px] inset-x-0 z-30 pointer-events-none`)
  - Takeout toggle removed; table QR orders default to dine-in
  - Clear Cart action with live total calculation (inclusive of 5% tax)
  - Top header Orders navigation button with order count badge & live status change indicator
  - Best Sellers tab & dynamic category badge sorting
  - Compressed Orders Hub combining multiple table tickets into a single unified summary
  - Assist Request modal with 5 options (Water, Waiter, Utensils/Napkins, Bill Out, Other)
  - Realtime order status changes with animated slide-down toasts and pulsing/blinking Orders tab
  - Conditional Bill Out (button only enabled/visible once all active table orders are `SERVED`)
  - Live staff assistance acknowledgement resolution sync via broadcast & 3s polling
- **Kitchen Management Interface (`/kitchen`)**:
  - Kitchen-first workflow: new orders (`REQUESTED`) appear in the kitchen for stock checks before Cashier review
  - Order acceptance (`REQUESTED` -> `VERIFIED`) which alerts cashier and customer
  - Order rejection/cancellation with reason prompt and optional global "Out of Stock" marking (`Menu_Items.ITEM_STATUS = 'OUT_OF_STOCK'`)
  - Kitchen order progression: `VERIFIED` -> `PREPARING` -> `READY` -> `SERVED`
  - Daily served items log / stats counter
- **Cashier Interface (`/cashier`)**:
  - Table Assistance Requests feed with functional "Acknowledge" action
  - Bill Requests feed with bill breakdown and "Complete / Paid" action
  - Kitchen-Verified Orders overview and acknowledgment
- **Table Layout Management (`/tables`)**:
  - Live floor plan layout with capacity indicators and assistance call badges
- **Dual-Channel Synchronization**:
  - Supabase Realtime Channels (WebSockets) for instant UI reactions
  - Silent Background Polling (2.5s - 5s intervals) across all active views to ensure zero-flicker resilience against dropped or delayed socket events
  - Visibility change re-sync when tabs regain focus

---

## Technology Stack

### Frontend
- **React** 19
- **TypeScript** 5 (strict)
- **Vite** 6
- **React Router** 7 (`createBrowserRouter`, Data API)
- **Tailwind CSS** 4 (CSS-first, `@tailwindcss/vite` plugin)
- **Lucide React** — icons
- **Google Fonts** — Plus Jakarta Sans

### Auth / Backend
- **Supabase** (`@supabase/supabase-js`) — Auth connected (email/password), PostgreSQL, Realtime

### Hosting
- **Vercel** — SPA rewrite configured in `vercel.json`

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
| `Bill_Requests` | Customer bill checkout requests | `REQUEST_ID`, `TABLE_ID`, `ORDER_ID`, `PAYMENT_METHOD`, `STATUS`, `REQUESTED_AT` |

### Status Enums (enforced via CHECK constraints)

| Table | Column | Values |
|---|---|---|
| `Restaurant_Tables` | `STATUS` | `AVAILABLE`, `RESERVED`, `OCCUPIED`, `HAS_REQUEST` |
| `Menu_Items` | `ITEM_STATUS` | `AVAILABLE`, `OUT_OF_STOCK` |
| `Restaurant_Orders` | `ORDER_STATUS` | `REQUESTED`, `VERIFIED`, `PREPARING`, `READY`, `SERVED`, `CANCELLED` |
| `Restaurant_Orders` | `ORDER_TYPE` | `DINE-IN`, `TAKEOUT` |
| `Restaurant_Orders` | `REQUESTED_FROM` | `Cashier`, `Customer` |
| `Order_Items` | `ORDER_ITEM_STATUS` | `PENDING`, `PREPARING`, `SERVED` |
| `Bill_Requests` | `PAYMENT_METHOD` | `CASH`, `CREDIT_CARD`, `INSTAPAY_QR` |
| `Bill_Requests` | `STATUS` | `REQUESTED`, `PROCESSING`, `PAID`, `CANCELLED` |

---

## Architecture

```text
monolith-pos/
├── public/
├── src/
│   ├── assets/              # Static assets & logos
│   ├── components/
│   │   ├── auth/            # ProtectedRoute
│   │   ├── common/          # PageLoader
│   │   ├── customer/        # Mobile customer ordering components
│   │   ├── layout/          # AppHeader, AppSidebar, NavigationItem
│   │   └── ui/              # Button, Card, Input, EmptyState, PageHeader
│   ├── config/              # app.ts, navigation.ts
│   ├── contexts/            # AuthContext.tsx
│   ├── hooks/               # useAuth, useMenu, useCart, useOrders, useBillRequest, useRealtimeMenu
│   ├── layouts/             # AppLayout.tsx, RootLayout.tsx
│   ├── lib/                 # supabase.ts singleton
│   ├── pages/
│   │   ├── AccountManager/
│   │   ├── Analytics/
│   │   ├── Cashier/         # Acknowledge assistance, bills, orders
│   │   ├── Customer/        # Mobile table QR ordering
│   │   ├── Kitchen/         # Kitchen-first stock verification & queue
│   │   ├── Login/           # Real Supabase login
│   │   ├── MenuManager/
│   │   ├── NotFound/
│   │   ├── OrderLogs/
│   │   └── TableManager/    # Live table map & service alerts
│   ├── routes/              # Centralized createBrowserRouter config
│   ├── services/            # orderService, menuService, billService, assistanceService
│   ├── styles/              # index.css (Tailwind v4 + custom micro-animations)
│   ├── types/               # TypeScript interfaces
│   ├── App.tsx              # Root component
│   └── main.tsx             # Entry point
├── Context/                 # Database schema & migrations
└── ...
```

---

## Implemented

- [x] React 19 + Vite 6 + TypeScript (strict)
- [x] React Router 7 with `createBrowserRouter` + lazy loading
- [x] Tailwind CSS 4 (CSS-first via `@tailwindcss/vite`)
- [x] Google Fonts (Plus Jakarta Sans) & micro-animations
- [x] Supabase Auth (email/password login/logout)
- [x] AppLayout with mobile drawer + desktop persistent navigation
- [x] Customer QR Ordering Interface (`/customer/:tableId`):
  - Direct 1-tap dish add to cart
  - Image-only popup for detail customization
  - Floating Place Order holder card overlapping the menu above the bottom navbar (`fixed bottom-[80px] inset-x-0 z-30`)
  - Takeout toggle removed; clean dine-in default
  - Clear cart action with live total calculation
  - Top header Orders access button with unread change badge
  - Best sellers category & badge sorting
  - Compressed unified table orders hub
  - 5-option Assistance Request modal
  - Live animated order status notifications
  - Conditional Bill Out button
  - Instant assistance resolution sync
- [x] Kitchen Management Interface (`/kitchen`):
  - Kitchen-first stock checking for new orders
  - Order accept (`VERIFIED`) or cancel with reasons
  - Global item out-of-stock toggle
  - Live cooking queue progression (`PREPARING` -> `READY` -> `SERVED`)
- [x] Cashier Interface (`/cashier`):
  - Live table assistance acknowledge button
  - Bill settlement workflow with payment methods
  - Kitchen-verified order monitoring
- [x] Table Manager Interface (`/tables`):
  - Real-time floor plan layout with service alert badges
- [x] Dual-channel sync (Supabase Realtime + silent polling every 2.5s-5s + visibility sync)
- [x] Vercel SPA routing (`vercel.json` rewrite rule)
- [x] Environment variable configuration (`.env`)
- [x] ESLint flat config passing with 0 errors

## Not Implemented / Backlog

- [ ] Menu / category CRUD in MenuManager
- [ ] Analytics charts & reports
- [ ] Staff account creation / role management in AccountManager
- [ ] Order historical audit logs in OrderLogs
- [ ] External hardware integrations (receipt printers, barcode scanners)

---

## Architectural Decisions

### Dual-Channel Realtime + Silent Background Polling
To achieve 100% data reliability across tablets and smartphones in noisy restaurant environments, the application uses Supabase Postgres changes and broadcast channels for immediate reactions, paired with a non-intrusive 2.5s-5s silent background poll. Background polling never resets page load spinners, preventing any screen flickering.

### Floating Customer Checkout Bar
The Place Order card floats directly above the bottom navigation bar (`fixed bottom-[80px] inset-x-0 z-30`), overlapping the scrolling menu content. This ensures the bottom navigation bar (`MobileBottomNav`) remains permanently accessible at all times, without taking up permanent full-bleed screen space or hiding essential table navigation.

### Kitchen-First Verification Workflow
Orders submitted by customers enter `REQUESTED` status and are routed to the Kitchen display first. The kitchen verifies ingredients before accepting the order (`VERIFIED`), which then notifies the Cashier and Customer. If ingredients are missing, the kitchen can cancel the order with a reason and mark the item globally out of stock.

---

## Environment Variables

| Variable | Description | Status |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | ✅ Connected |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | ✅ Connected |

> Never expose `SUPABASE_SERVICE_ROLE_KEY` or any privileged key to browser code.

---

## Test Accounts

| Email | Password | Role |
|---|---|---|
| `taponakawnt123@gmail.com` | `test1234` | Development test account |

---

## Development History

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

### 2026-09-05 — Foundation & Authentication
- Project initialized with React 19, Vite 6, Tailwind CSS 4, and TypeScript
- Connected Supabase Auth and built navigation shell with 8 page skeletons
