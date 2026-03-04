# Phase 23 — API Key Security (No NEXT_PUBLIC_ Exposure)
**Date:** 2026-03-04

## Problem
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` were embedded in the browser JS bundle by Next.js (by design of the NEXT_PUBLIC_ prefix), making the keys visible in DevTools.

## Solution

### Phase 23-A — Env Var Rename
Removed `NEXT_PUBLIC_` prefix from all Supabase credential env vars:

| Old | New |
|-----|-----|
| `NEXT_PUBLIC_SUPABASE_URL` | `SUPABASE_URL` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `SUPABASE_ANON_KEY` |

**Files modified:**
- `.env` — keys renamed
- `src/lib/supabase.js` — reads `SUPABASE_URL` / `SUPABASE_ANON_KEY`
- `src/app/admin/settings/actions.js` — `persistToEnvFile()` + `checkConnectionAction()` updated
- `src/app/api/settings/route.js` — GET/POST updated
- `src/app/admin/vendor-manager/actions.js` — inline client updated
- `src/app/admin/domains-manager/actions.js` — inline client updated

**Bonus fix:** `src/app/admin/schema-builder/actions.js` — corrected mismatched JSON credential field names from `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` to the correct DB-stored field names `supabase_url`/`supabase_published_key` (matching `settings/actions.js`).

### Phase 23-B — SSE Route (Replaces Client-Side Supabase Realtime)

The Dashboard previously opened a Supabase WebSocket from the browser, requiring credentials in the client bundle.

**New file:** `src/app/api/realtime/dashboard/route.js`
- SSE (`text/event-stream`) route powered by a `ReadableStream`
- Polls Supabase every **4 seconds** server-side using private env vars
- Emits named `projects` events with the full project array JSON
- Auto heartbeat to prevent proxy timeouts

**Modified:** `src/app/admin/DashboardClient.jsx`
- Removed `import { supabase }` (no more client-held credentials)
- Removed `supabase.channel().subscribe()` Realtime block
- Added `new EventSource('/api/realtime/dashboard')` with `projects` event listener
- `EventSource` auto-reconnects on network errors

## Security Result
- No Supabase credentials reach the browser in any form
- `src/lib/supabase.js` is server-only (only imported by Server Actions / API Routes)
- `DashboardClient.jsx` no longer carries any credential import
