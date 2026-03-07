-- 1. Vendors Table: Add vendor_details and migrate
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS vendor_details JSONB DEFAULT '[]'::jsonb;
DO $$ BEGIN -- Only migrate if vendor_details is empty or null
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'vendors'
        AND table_schema = 'public'
        AND column_name = 'vendor_name'
) THEN
UPDATE vendors
SET vendor_details = jsonb_build_array(
        jsonb_strip_nulls(
            jsonb_build_object(
                'vendor_name',
                vendor_name,
                'contact',
                contact,
                'product_types',
                product_types,
                'performance',
                performance,
                'price',
                price,
                'quality',
                quality,
                'option_stock',
                option_stock,
                'max_discount_pct',
                max_discount_pct
            )
        )
    )
WHERE (
        vendor_details = '[]'::jsonb
        OR vendor_details IS NULL
    );
END IF;
END $$;
-- 2. Domains Table: Add domain_details and migrate
ALTER TABLE domains
ADD COLUMN IF NOT EXISTS domain_details JSONB DEFAULT '[]'::jsonb;
DO $$ BEGIN -- Only migrate if domain_details is empty or null
IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'domains'
        AND table_schema = 'public'
        AND column_name = 'domain_url'
) THEN
UPDATE domains
SET domain_details = jsonb_build_array(
        jsonb_strip_nulls(
            jsonb_build_object(
                'domain_url',
                domain_url,
                'DR',
                domain_rating,
                'Traffic',
                traffic,
                'Domain_age',
                domain_age,
                'Spam_Score',
                spam_score,
                'Last_checked_at',
                last_checked_at
            )
        )
    )
WHERE (
        domain_details = '[]'::jsonb
        OR domain_details IS NULL
    );
END IF;
END $$;
-- 3. CLEANUP: Drop legacy columns
-- As requested: "id will be individual columns and the rest will be merged into jsonb"
DO $$
DECLARE col_to_drop RECORD;
BEGIN -- Clean up vendors
FOR col_to_drop IN
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'vendors'
    AND table_schema = 'public'
    AND column_name NOT IN (
        'id',
        'vendor_details',
        'created_at',
        'updated_at'
    ) LOOP EXECUTE 'ALTER TABLE vendors DROP COLUMN IF EXISTS ' || quote_ident(col_to_drop.column_name) || ' CASCADE';
END LOOP;
-- Clean up domains
FOR col_to_drop IN
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'domains'
    AND table_schema = 'public'
    AND column_name NOT IN (
        'id',
        'vendor_id',
        'domain_details',
        'created_at',
        'updated_at'
    ) LOOP EXECUTE 'ALTER TABLE domains DROP COLUMN IF EXISTS ' || quote_ident(col_to_drop.column_name) || ' CASCADE';
END LOOP;
END $$;
-- 4. Projects Table: Add completed_at column
ALTER TABLE projects
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;