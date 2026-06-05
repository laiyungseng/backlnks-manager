-- Migration 08: Campaign-grouped bulk staging save
-- Run in Supabase SQL Editor before deploying v2.1.6.
--
-- Adds patch_staging_rows_bulk — wraps patch_staging_rows in a loop so
-- all plans in a campaign flush in a single DB transaction.
--
-- p_campaign_id  — passed for context; not used internally by this function.
-- p_plans shape  — jsonb array: [{ "hash": "...", "delta": [...], "cell_ts": {...}, "known_version": N }]
--
-- Returns jsonb array — one entry per plan:
--   success: { "hash": "...", "new_version": N, "skipped": [...] }
--   conflict: { "hash": "...", "conflict": true, "skipped": [] }

CREATE OR REPLACE FUNCTION patch_staging_rows_bulk(
    p_campaign_id  uuid,
    p_plans        jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_plan      jsonb;
    v_hash      text;
    v_delta     jsonb;
    v_cell_ts   jsonb;
    v_known_ver int;
    v_row       record;
    v_results   jsonb := '[]'::jsonb;
BEGIN
    FOR v_plan IN SELECT value FROM jsonb_array_elements(p_plans) LOOP
        v_hash      := v_plan->>'hash';
        v_delta     := v_plan->'delta';
        v_cell_ts   := COALESCE(v_plan->'cell_ts', '{}'::jsonb);
        v_known_ver := NULLIF(v_plan->>'known_version', '')::int;

        SELECT * INTO v_row
        FROM patch_staging_rows(v_hash, v_known_ver, v_delta, v_cell_ts)
        LIMIT 1;

        IF FOUND THEN
            v_results := v_results || jsonb_build_array(
                jsonb_build_object(
                    'hash',        v_hash,
                    'new_version', v_row.new_version,
                    'skipped',     v_row.skipped
                )
            );
        ELSE
            v_results := v_results || jsonb_build_array(
                jsonb_build_object(
                    'hash',     v_hash,
                    'conflict', true,
                    'skipped',  '[]'::jsonb
                )
            );
        END IF;
    END LOOP;

    RETURN v_results;
END;
$$;
