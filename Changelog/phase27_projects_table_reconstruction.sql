-- Phase 27: Projects Table JSONB Reconstruction
-- Run this ONCE in Supabase SQL Editor
-- Step 0: Ensure the FK constraint exists so PostgREST can do projects → projects_hub joins
-- (This is idempotent — it only adds it if missing)
DO $$ BEGIN IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
        AND table_name = 'projects_hub'
        AND constraint_name = 'projects_hub_project_id_fkey'
) THEN
ALTER TABLE projects_hub
ADD CONSTRAINT projects_hub_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
END IF;
-- Step 0.5: Also ensure placements has its formal FK constraint
IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_type = 'FOREIGN KEY'
        AND table_name = 'placements'
        AND constraint_name = 'placements_project_id_fkey'
) THEN
ALTER TABLE placements
ADD CONSTRAINT placements_project_id_fkey FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE;
END IF;
END $$;
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS "user" TEXT,
    ADD COLUMN IF NOT EXISTS created_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS complete_date TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS project_details JSONB DEFAULT '[]'::jsonb;
-- Step 2: Populate project_details from existing flat columns
UPDATE projects
SET "user" = owner,
    created_date = created_at,
    project_details = jsonb_build_array(
        jsonb_build_object(
            'project_name',
            project_name,
            'owner',
            owner,
            'start_date',
            start_date,
            'deadline',
            deadline,
            'vendor_name',
            vendor_name,
            'remarks',
            remarks,
            'backlinks_category',
            backlinks_category,
            'created_at',
            created_at,
            'updated_at',
            updated_at,
            'quantity',
            quantity::text,
            'status',
            status,
            'country',
            country,
            'dripfeed_enabled',
            dripfeed_enabled,
            'dripfeed_period',
            dripfeed_period::text,
            'urls_per_day',
            urls_per_day::text,
            'sheet_name',
            sheet_name,
            'languages-ratio',
            COALESCE(
                (
                    SELECT jsonb_agg(
                            jsonb_build_object(
                                'lang-code',
                                elem->>'code',
                                'ratio',
                                elem->>'ratio'
                            )
                        )
                    FROM jsonb_array_elements(COALESCE(projects.languages, '[]'::jsonb)) AS elem
                ),
                '[]'::jsonb
            ),
            'url_entry_enabled',
            url_entry_enabled,
            'price',
            price::text,
            'price_type',
            price_type,
            'is_approved',
            is_approved,
            'randomize_language',
            randomize_languages
        )
    );
-- Step 3: Drop old flat columns (preserve id, user, created_date, complete_date, project_details)
ALTER TABLE projects DROP COLUMN IF EXISTS project_name,
    DROP COLUMN IF EXISTS owner,
    DROP COLUMN IF EXISTS start_date,
    DROP COLUMN IF EXISTS deadline,
    DROP COLUMN IF EXISTS vendor_name,
    DROP COLUMN IF EXISTS remarks,
    DROP COLUMN IF EXISTS backlinks_category,
    DROP COLUMN IF EXISTS created_at,
    DROP COLUMN IF EXISTS updated_at,
    DROP COLUMN IF EXISTS quantity,
    DROP COLUMN IF EXISTS status,
    DROP COLUMN IF EXISTS country,
    DROP COLUMN IF EXISTS language,
    DROP COLUMN IF EXISTS dripfeed_enabled,
    DROP COLUMN IF EXISTS dripfeed_period,
    DROP COLUMN IF EXISTS urls_per_day,
    DROP COLUMN IF EXISTS sheet_name,
    DROP COLUMN IF EXISTS languages,
    DROP COLUMN IF EXISTS url_entry_enabled,
    DROP COLUMN IF EXISTS price,
    DROP COLUMN IF EXISTS price_type,
    DROP COLUMN IF EXISTS is_approved,
    DROP COLUMN IF EXISTS randomize_languages;