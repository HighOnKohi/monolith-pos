# Monolith

A web-based Point-of-Sale (POS) system built with React, TypeScript, Vite, and Tailwind CSS.

> **Current Stage:** Project skeleton / foundation. No POS features have been implemented yet.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | React 19 |
| Language | TypeScript 5 (strict) |
| Build Tool | Vite 6 |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 |
| Hosting | Vercel |
| Backend *(planned)* | Supabase (PostgreSQL, Auth, Realtime, Storage) |

---

## Project Structure

```text
monolith-pos/
├── public/
│   └── favicon.svg
├── src/
│   ├── assets/              # Static assets (images, fonts, etc.)
│   ├── components/
│   │   ├── ui/              # Primitive UI components
│   │   ├── layout/          # Layout components
│   │   └── common/          # Shared general components
│   ├── config/              # Non-secret app configuration
│   ├── contexts/            # React Context providers
│   ├── hooks/               # Custom React hooks
│   ├── layouts/             # Page-level layout shells
│   ├── lib/                 # External library initialization
│   ├── pages/               # Top-level routed pages
│   │   ├── Home/
│   │   ├── Login/
│   │   ├── Dashboard/
│   │   ├── POS/
│   │   └── NotFound/
│   ├── routes/              # Centralized React Router config
│   ├── services/            # Business logic / service layer
│   ├── styles/              # Global CSS
│   ├── types/               # Shared TypeScript types
│   ├── utils/               # Pure utility functions
│   ├── App.tsx
│   └── main.tsx
├── .env.example
├── .gitignore
├── CONTEXT.md
├── README.md
├── index.html
├── eslint.config.js
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── vercel.json
```

---

## Requirements

- **Node.js** ≥ 20
- **npm** ≥ 10

---

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd monolith-pos

# Install dependencies
npm install
```

---

## Local Development

```bash
npm run dev
```

The development server starts at `http://localhost:5173`.

Available routes:

| Route | Description |
|---|---|
| `/` | Home (placeholder) |
| `/login` | Login (placeholder) |
| `/dashboard` | Dashboard (placeholder) |
| `/pos` | Point of Sale (placeholder) |
| `/*` | 404 Not Found |

---

## Production Build

```bash
npm run build
```

Output is written to `dist/`.

Preview the production build locally:

```bash
npm run preview
```

---

## Linting

```bash
npm run lint
```

---

## Vercel Deployment

The project is configured for Vercel deployment.

- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Framework Preset:** Vite

SPA client-side routing is configured in `vercel.json` so all routes resolve correctly when opened directly.

**Do not create Vercel Functions or API routes** unless explicitly required.

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values when ready:

```bash
cp .env.example .env.local
```

| Variable | Description | Status |
|---|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL | Planned |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key | Planned |

> ⚠️ Never commit `.env.local` or any file containing real credentials.
> Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.

---

## Planned: Supabase Integration

Supabase will eventually provide:

- PostgreSQL database
- Authentication (Supabase Auth)
- Row Level Security (RLS)
- Realtime subscriptions
- File storage (Supabase Storage)

Supabase is **not connected** during the current foundation stage.

When Supabase is integrated, the client will be initialized in `src/lib/`.

---

## Implemented

- [x] React 19 + Vite 6 + TypeScript (strict)
- [x] React Router 7 with `createBrowserRouter`
- [x] Route-level lazy loading (code splitting)
- [x] Tailwind CSS 4
- [x] Centralized route configuration
- [x] Placeholder pages (`/`, `/login`, `/dashboard`, `/pos`, `404`)
- [x] Vercel SPA routing (`vercel.json`)
- [x] Environment variable template (`.env.example`)
- [x] ESLint (flat config)
- [x] Git configuration (`.gitignore`)
- [x] `CONTEXT.md` — persistent project context
- [x] `README.md`

## Not Implemented

- [ ] Supabase integration
- [ ] Authentication
- [ ] Database
- [ ] POS functionality
- [ ] Business logic
- [ ] External integrations
