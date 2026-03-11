-- =========================================================================
-- PHASE 3 MIGRATION: JSONB -> FLATTENED COLUMNS
-- Run this script in the Supabase SQL Editor.
-- Backup your database before running this!
-- =========================================================================
-- 1. ADD NEW NORMALIZED COLUMNS --
-- VENDORS
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS vendor_name TEXT NOT NULL DEFAULT 'Unknown',
    ADD COLUMN IF NOT EXISTS contact TEXT,
    ADD COLUMN IF NOT EXISTS product_types TEXT,
    ADD COLUMN IF NOT EXISTS performance NUMERIC,
    ADD COLUMN IF NOT EXISTS price NUMERIC,
    ADD COLUMN IF NOT EXISTS quality NUMERIC,
    ADD COLUMN IF NOT EXISTS option_stock INTEGER,
    ADD COLUMN IF NOT EXISTS max_discount_pct NUMERIC;
-- DOMAINS
ALTER TABLE public.domains
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id),
    ADD COLUMN IF NOT EXISTS domain_url TEXT NOT NULL DEFAULT 'http://unknown.com',
    ADD COLUMN IF NOT EXISTS dr NUMERIC,
    ADD COLUMN IF NOT EXISTS traffic INTEGER,
    ADD COLUMN IF NOT EXISTS domain_age NUMERIC,
    ADD COLUMN IF NOT EXISTS spam_score NUMERIC,
    ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMPTZ;
-- PROJECTS
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT 'Untitled Project',
    ADD COLUMN IF NOT EXISTS organization_id UUID,
    ADD COLUMN IF NOT EXISTS owner TEXT NOT NULL DEFAULT 'Unknown Owner',
    ADD COLUMN IF NOT EXISTS start_date DATE,
    ADD COLUMN IF NOT EXISTS deadline DATE,
    ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id),
    ADD COLUMN IF NOT EXISTS country VARCHAR(3),
    ADD COLUMN IF NOT EXISTS language VARCHAR(5),
    ADD COLUMN IF NOT EXISTS total_quantity INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS remarks TEXT,
    ADD COLUMN IF NOT EXISTS dripfeed_enabled BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS dripfeed_period INTEGER,
    ADD COLUMN IF NOT EXISTS urls_per_day INTEGER,
    ADD COLUMN IF NOT EXISTS url_entry_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS price NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS price_type VARCHAR(20) DEFAULT 'per_url',
    ADD COLUMN IF NOT EXISTS randomize_languages BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';
-- 2. MIGRATE EXISTING JSONB DATA INTO COLUMNS --
-- Unwrap Vendors (Assuming vendor_details is an array of 1 object)
UPDATE public.vendors
SET vendor_name = COALESCE(vendor_details->0->>'vendor_name', 'Unknown'),
    contact = vendor_details->0->>'contact',
    product_types = vendor_details->0->>'product_types',
    performance = NULLIF(vendor_details->0->>'performance', '')::NUMERIC,
    price = NULLIF(vendor_details->0->>'price', '')::NUMERIC,
    quality = NULLIF(vendor_details->0->>'quality', '')::NUMERIC,
    option_stock = NULLIF(vendor_details->0->>'option_stock', '')::INTEGER,
    max_discount_pct = NULLIF(vendor_details->0->>'max_discount_pct', '')::NUMERIC
WHERE vendor_details IS NOT NULL;
-- Unwrap Domains
UPDATE public.domains
SET domain_url = COALESCE(
        domain_details->0->>'domain_url',
        'http://unknown.com'
    ),
    dr = NULLIF(domain_details->0->>'DR', '')::NUMERIC,
    traffic = NULLIF(domain_details->0->>'Traffic', '')::INTEGER,
    domain_age = NULLIF(domain_details->0->>'Domain_age', '')::NUMERIC,
    spam_score = NULLIF(domain_details->0->>'Spam_Score', '')::NUMERIC,
    last_checked_at = NULLIF(domain_details->0->>'Last_checked_at', '')::TIMESTAMPTZ
WHERE domain_details IS NOT NULL;
-- Unwrap Projects
UPDATE public.projects
SET project_name = COALESCE(
        project_details->0->>'project_name',
        'Untitled Project'
    ),
    owner = COALESCE(project_details->0->>'owner', 'Unknown Owner'),
    start_date = NULLIF(project_details->0->>'start_date', '')::DATE,
    deadline = NULLIF(project_details->0->>'deadline', '')::DATE,
    country = project_details->0->>'country',
    language = project_details->0->>'language',
    total_quantity = NULLIF(project_details->0->>'quantity', '')::INTEGER,
    remarks = project_details->0->>'remarks',
    dripfeed_enabled = COALESCE(
        (project_details->0->>'dripfeed_enabled')::BOOLEAN,
        TRUE
    ),
    dripfeed_period = NULLIF(project_details->0->>'dripfeed_period', '')::INTEGER,
    urls_per_day = NULLIF(project_details->0->>'urls_per_day', '')::INTEGER,
    price = NULLIF(project_details->0->>'price', '')::NUMERIC,
    status = COALESCE(project_details->0->>'status', 'Active')
WHERE project_details IS NOT NULL;
-- NOTE: Nested arrays like languages-ratio and project_info will require custom 
-- INSERT statements into the new project_languages and project_targets tables 
-- handled programmatically via the new logic refactor.
-- 3. CREATE NEW CHILD TABLES --
CREATE TABLE IF NOT EXISTS public.project_languages (
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    lang_code VARCHAR(5) NOT NULL,
    ratio INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS public.project_targets (
    id SERIAL PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    anchor_text TEXT NOT NULL,
    target_url TEXT NOT NULL,
    quantity_requested INTEGER NOT NULL,
    sheet_name VARCHAR(255)
);
CREATE TABLE IF NOT EXISTS public.placements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES public.projects(id),
    vendor_id UUID NOT NULL REFERENCES public.vendors(id),
    domain_id UUID REFERENCES public.domains(id),
    project_target_id INTEGER REFERENCES public.project_targets(id),
    sheet_name VARCHAR(255),
    category VARCHAR(50),
    language VARCHAR(5),
    anchor_text TEXT,
    target_url TEXT,
    published_url TEXT,
    published_date DATE,
    status VARCHAR(50) DEFAULT 'published',
    indexed_status VARCHAR(50),
    indexed_checked_at TIMESTAMPTZ,
    last_vendor_update_at TIMESTAMPTZ,
    notes TEXT,
    country VARCHAR(3),
    vendor_token VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);