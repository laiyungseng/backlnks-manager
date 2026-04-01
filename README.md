# Drive-Future — SEO Backlink Campaign Manager

> A production-grade, full-stack web application for managing end-to-end SEO backlink campaigns — from project kickoff to vendor delivery and placement finalization.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?logo=tailwind-css)](https://tailwindcss.com)
[![Zod](https://img.shields.io/badge/Zod-Validated-3068B7)](https://zod.dev)

---

## Overview

Drive-Future is a **multi-role SaaS-style backlink tracking platform** designed to streamline the full lifecycle of SEO link-building campaigns. It coordinates three stakeholders — admins, vendors, and clients — through a secure, role-gated interface backed by a normalized PostgreSQL database.

The system handles everything from campaign kickoff (target URLs, anchor texts, language splits, drip-feed scheduling) to vendor fulfillment (URL submissions, indexing status tracking) and final placement archiving — all without a single spreadsheet.

---

## Key Features

### 🔒 Admin Portal (`/admin`)
- **Performance Metrics Dashboard** — Real-time KPIs: Index Rate, Submission Speed, Error Rate, Total Vendor Cost, and fulfilment completion aggregated across all active projects.
- **Project Kickoff Engine** — Create campaigns with nested target groups (anchor text + URL), absolute quantity distribution, multi-language splits (EN/MY/ZH etc.), automatic quantity balancing, drip-feed scheduling, and per-URL pricing.
- **Sequential Distribution Logic** — Targets and languages are stamped sequentially in order (Target 1 × N repeats, then Target 2 × M repeats, then language blocks EN first, then MY) — never randomly interleaved by default.
- **Active Placements Dashboard** — Vendor-grouped card UI showing per-project fulfillment bars, portal access links, and finalization triggers.
- **Completed Placements Archive** — Finalized placement records with lock/unlock access control and SVG icon-based status indicators.
- **Project Details Grid** — Glide Data Grid table with inline Category editing, scrollable with sticky headers.
- **Vendor Manager** — Full CRUD for vendor profiles with spreadsheet-style inline editing, trailing-row data entry, and auto-expanding paste from Excel/CSV.
- **Domains Manager** — Full CRUD for SEO domain inventory with foreign key vendor linking, domain metrics (DR, traffic, spam score, age), and bulk CSV uploads with shorthand number parsing (`1.5K`, `2M`).
- **Schema Builder** — Visual SQL table designer with real-time Postgres `CREATE TABLE` preview and one-click execution via the Supabase Management API.
- **Settings Page** — Live Supabase credential configuration written server-side to `.env` without browser exposure.

### 🧑‍💼 Vendor Portal (`/vendor/[vendor_name]/[hash]`)
- **Passwordless, hash-secured access** — Vendors receive a unique cryptographic URL per project; no login required.
- **Glide Data Grid submission form** — High-performance spreadsheet for submitting domain URLs, published URLs, published dates, and indexing status across 100+ rows.
- **Bulk paste support** — Multi-cell clipboard paste from Excel maps directly into the correct grid columns.
- **URL Entry toggle** — Admin-controlled toggle enables or disables the domain URL column per project.
- **Auto-save pipeline** — Changes are debounced and persisted to Supabase staging data without manual save clicks.
- **In Progress / Completed sub-pages** — Vendors see only their assigned and relevant projects.

### ⚙️ Architecture & Engineering

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Server Actions) |
| Database | Supabase (PostgreSQL) |
| Validation | Zod (strict schema parsing, `superRefine` cross-field checks) |
| Data Grid | `@glideapps/glide-data-grid` (canvas-rendered, 100k+ row capable) |
| Real-time | Server-Sent Events (SSE) via `/api/realtime/dashboard` — zero credentials in browser |
| Auth | Cookie-based session + `middleware.js` route guard on all `/admin/*` routes |
| Security | AES-256-GCM hashing for vendor portal tokens; Supabase API keys server-only (never exposed to browser bundle) |
| Styling | Tailwind CSS |

---

## Security Design

- **No credentials in the browser.** Supabase keys use server-only env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) — no `NEXT_PUBLIC_` prefix.
- **SSE replaces WebSocket realtime** to eliminate the need for any client-side Supabase subscription (which required credentials).
- **Vendor portals are cryptographically isolated.** Each portal URL contains a SHA-256 hash derived from project metadata + timestamp + entropy. Guessing a valid hash is computationally infeasible.
- **Admin middleware** intercepts every `/admin/*` request and redirects to `/login` if the session cookie is absent.
- **Input validation at every layer.** Zod schemas guard all Server Actions. Client-side real-time validation (URL format checks, quantity sum assertions) blocks form submission before any network call.

---

## Database Schema

```
projects                  → Master project rows (name, owner, vendor_id, dates, pricing, flags)
project_languages         → 1:M language-quantity rows per project
project_targets           → 1:M anchor text / target URL rows per project
projects_hub              → 1:1 per project; stores vendor hash, JSONB staging data, lock state
placements                → Finalized placement records (published_url, indexed_status ENUM)
vendors                   → Vendor profiles (name, email, DR ratings, payment terms)
domains                   → SEO domain inventory (URL, DR, traffic, spam score, age)
admin_users               → Admin credentials + last_login tracking
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project with the schema applied

### Environment Variables

Create a `.env` file in the project root:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
ENCRYPTION_SECRET=your_aes_secret_key
```

> `.env` is never committed. The Settings page (`/admin/settings`) can write these values at runtime.

### Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/login`.

### Default Admin Access

Admin credentials are stored in the `admin_users` Supabase table. Insert a row manually on first setup.

---

## Project Structure

```
src/
├── middleware.js                    # Route guard — redirects /admin/* if no session cookie
├── lib/
│   ├── supabase.js                  # Server-only Supabase client (returns null if env missing)
│   ├── placementProcessor.js        # Finalization engine — resolves vendor staging → placements
│   └── crypto.js                    # AES-256-GCM helpers for vendor token generation
├── schemas/
│   ├── projectSchema.js             # Zod schema — project kickoff with quantity superRefine
│   ├── vendorSchema.js              # Zod schema — vendor entity
│   ├── domainSchema.js              # Zod schema — domain metrics with CSV shorthand parsing
│   └── backlinkSchema.js            # Zod schema — placement row validation
└── app/
    ├── admin/                       # Admin portal (dashboard, kickoff, placements, managers)
    ├── vendor/[vendor_name]/[hash]/ # Vendor portal (hash-secured, no login)
    ├── api/realtime/dashboard/      # SSE endpoint — streams live project state to browser
    └── login/                       # Admin authentication
```

---

## Technical Highlights for Reviewers

- **Fully normalized relational schema** — migrated through 47 development phases from flat JSONB blobs to strict 1:M relational tables with FK constraints and RLS policies.
- **No ORM** — raw Supabase query builder used throughout; explicit JOIN selects, upsert conflict resolution, and cascading deletes all hand-authored.
- **Schema-as-source-of-truth** — Zod schemas generate Postgres `CREATE TABLE` SQL via the `/api/schema-sql` route, keeping application types and DB schema in sync.
- **Glide Data Grid** — canvas-rendered spreadsheet handles high row counts (100k+) with SSR-safe hydration, custom cell editors, multi-cell selection delete, and clipboard paste mapping.
- **Optimistic UI** — Dashboard approve/delete actions use `startTransition` + local state to reflect changes instantly before server revalidation completes.
- **Enum sanitization** — Free-text vendor `indexed_status` input is normalized at both the finalization engine and auto-save layers to valid Postgres ENUM values (`page_indexed` / `page_not_indexed`) before any DB write.

---

## Roadmap

- [ ] Email notification triggers on project approval and vendor completion
- [ ] Client-facing read-only reporting portal
- [ ] Bulk project import via CSV
- [ ] Automated indexing status checker via Google Search API

---

## License

Private repository. All rights reserved.
