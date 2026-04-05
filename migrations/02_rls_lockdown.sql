-- Migration: RLS deny-by-default lockdown
-- Run this in your Supabase SQL Editor.
-- After this runs, ALL sensitive tables reject anonymous and public access.
-- Only service-role requests (from your Next.js server) bypass RLS.

-- ── admin_users ───────────────────────────────────────────────────────────────
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Drop any existing broad policies
DROP POLICY IF EXISTS "Allow public read" ON public.admin_users;
DROP POLICY IF EXISTS "Allow public update" ON public.admin_users;
DROP POLICY IF EXISTS "Allow anon read" ON public.admin_users;
DROP POLICY IF EXISTS "Allow anon update" ON public.admin_users;

-- No policies = deny all non-service-role access (service_role bypasses RLS)

-- ── projects ──────────────────────────────────────────────────────────────────
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.projects;
DROP POLICY IF EXISTS "Allow anon read" ON public.projects;
DROP POLICY IF EXISTS "Allow anon insert" ON public.projects;
DROP POLICY IF EXISTS "Allow anon update" ON public.projects;

-- ── projects_hub ──────────────────────────────────────────────────────────────
ALTER TABLE public.projects_hub ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.projects_hub;
DROP POLICY IF EXISTS "Allow anon read" ON public.projects_hub;
DROP POLICY IF EXISTS "Allow anon insert" ON public.projects_hub;
DROP POLICY IF EXISTS "Allow anon update" ON public.projects_hub;

-- ── placements ────────────────────────────────────────────────────────────────
ALTER TABLE public.placements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.placements;
DROP POLICY IF EXISTS "Allow anon read" ON public.placements;
DROP POLICY IF EXISTS "Allow anon insert" ON public.placements;
DROP POLICY IF EXISTS "Allow anon update" ON public.placements;

-- ── vendors ───────────────────────────────────────────────────────────────────
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.vendors;
DROP POLICY IF EXISTS "Allow anon read" ON public.vendors;
DROP POLICY IF EXISTS "Allow anon insert" ON public.vendors;
DROP POLICY IF EXISTS "Allow anon update" ON public.vendors;

-- ── domains ───────────────────────────────────────────────────────────────────
ALTER TABLE public.domains ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.domains;
DROP POLICY IF EXISTS "Allow anon read" ON public.domains;
DROP POLICY IF EXISTS "Allow anon insert" ON public.domains;
DROP POLICY IF EXISTS "Allow anon update" ON public.domains;

-- ── project_languages ─────────────────────────────────────────────────────────
ALTER TABLE public.project_languages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.project_languages;
DROP POLICY IF EXISTS "Allow anon read" ON public.project_languages;
DROP POLICY IF EXISTS "Allow anon insert" ON public.project_languages;

-- ── project_targets ───────────────────────────────────────────────────────────
ALTER TABLE public.project_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read" ON public.project_targets;
DROP POLICY IF EXISTS "Allow anon read" ON public.project_targets;
DROP POLICY IF EXISTS "Allow anon insert" ON public.project_targets;

-- ── Verification ──────────────────────────────────────────────────────────────
-- After running, test with the anon key from your client. These should all
-- return empty arrays or 403, not data:
--   SELECT * FROM admin_users;         → 0 rows (or error)
--   SELECT * FROM projects;            → 0 rows (or error)
--   SELECT * FROM projects_hub;        → 0 rows (or error)
