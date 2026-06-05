-- Migration 07: Per-cell last-write-wins merge
-- Run this in the Supabase SQL Editor before deploying.

-- Step 1: Add cell_timestamps column to projects_hub
ALTER TABLE projects_hub
    ADD COLUMN IF NOT EXISTS cell_timestamps jsonb DEFAULT '{}';

-- Step 2: Replace patch_staging_rows with v2
-- Adds per-cell timestamp merge so concurrent sessions can each win their own cells
-- rather than rejecting the entire save on a version mismatch.
--
-- New parameter: p_cell_ts jsonb
--   Shape: { "<rowId>": { "<field>": <unix_ms> }, ... }
--   When non-empty, version-based optimistic lock is skipped and cell-level timestamps
--   are used instead. A cell is skipped (remote wins) when:
--     stored_ts >= client_ts  (another session saved that cell more recently)
--
-- Return row: (new_version int, skipped jsonb)
--   skipped shape: [{ rowId, field, value }, ...]  — server's winning value per cell
--
-- When p_cell_ts is '{}' (default), behaviour is identical to the original v1:
--   version mismatch → 0 rows → conflict on client.

CREATE OR REPLACE FUNCTION patch_staging_rows(
    p_hash          text,
    p_known_version int,
    p_delta         jsonb,
    p_cell_ts       jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(new_version int, skipped jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_hub_id          uuid;
    v_hub_version     int;
    v_staging         jsonb;
    v_cell_ts_stored  jsonb;
    v_delta_elem      jsonb;
    v_row_id          text;
    v_field           text;
    v_existing_row    jsonb;
    v_updated_row     jsonb;
    v_skipped         jsonb := '[]'::jsonb;
    v_updated_staging jsonb;
    v_row_ts_stored   jsonb;
    v_new_ts_stored   jsonb;
    v_client_ts       bigint;
    v_stored_ts       bigint;
    v_use_cell_ts     boolean;
    v_idx             int;
    v_arr_len         int;
    i                 int;
BEGIN
    SELECT id, version,
           COALESCE(vendor_staging_data, '[]'::jsonb),
           COALESCE(cell_timestamps,     '{}'::jsonb)
    INTO v_hub_id, v_hub_version, v_staging, v_cell_ts_stored
    FROM projects_hub
    WHERE hash = p_hash;

    IF NOT FOUND THEN
        RETURN;  -- 0 rows → client treats as not found / conflict
    END IF;

    -- Use per-cell merge when client supplied timestamps; otherwise version lock
    v_use_cell_ts := (p_cell_ts IS NOT NULL AND p_cell_ts != '{}'::jsonb);

    IF NOT v_use_cell_ts
       AND p_known_version IS NOT NULL
       AND v_hub_version != p_known_version THEN
        RETURN;  -- 0 rows → version conflict
    END IF;

    v_updated_staging := v_staging;
    v_new_ts_stored   := v_cell_ts_stored;

    FOR v_delta_elem IN SELECT value FROM jsonb_array_elements(p_delta) LOOP
        v_row_id       := v_delta_elem->>'id';
        v_existing_row := NULL;
        v_idx          := NULL;
        v_arr_len      := jsonb_array_length(v_staging);

        -- Locate row in the ORIGINAL staging array (indices are stable across iterations)
        FOR i IN 0 .. v_arr_len - 1 LOOP
            IF v_staging->i->>'id' = v_row_id THEN
                v_existing_row := v_staging->i;
                v_idx          := i;
                EXIT;
            END IF;
        END LOOP;

        IF v_existing_row IS NOT NULL THEN
            v_updated_row   := v_existing_row;
            v_row_ts_stored := COALESCE(v_cell_ts_stored->v_row_id, '{}'::jsonb);

            FOR v_field IN SELECT key FROM jsonb_each(v_delta_elem) LOOP
                CONTINUE WHEN v_field = 'id';

                IF v_use_cell_ts THEN
                    v_client_ts := (p_cell_ts->v_row_id->>v_field)::bigint;
                    v_stored_ts := (v_row_ts_stored->>v_field)::bigint;

                    -- Remote value is newer — skip and record for client revert
                    IF v_client_ts IS NOT NULL
                       AND v_stored_ts IS NOT NULL
                       AND v_stored_ts >= v_client_ts THEN
                        v_skipped := v_skipped || jsonb_build_array(
                            jsonb_build_object(
                                'rowId',  v_row_id,
                                'field',  v_field,
                                'value',  v_existing_row->v_field
                            )
                        );
                        CONTINUE;
                    END IF;
                END IF;

                -- Apply client's value
                v_updated_row := jsonb_set(v_updated_row, ARRAY[v_field], v_delta_elem->v_field);

                -- Record the new winning timestamp
                IF v_use_cell_ts THEN
                    v_client_ts := (p_cell_ts->v_row_id->>v_field)::bigint;
                    IF v_client_ts IS NOT NULL THEN
                        v_row_ts_stored := jsonb_set(
                            v_row_ts_stored, ARRAY[v_field], to_jsonb(v_client_ts)
                        );
                    END IF;
                END IF;
            END LOOP;

            IF v_use_cell_ts THEN
                v_new_ts_stored := jsonb_set(
                    v_new_ts_stored, ARRAY[v_row_id], v_row_ts_stored
                );
            END IF;

            -- Replace row in staging using its original index
            v_updated_staging := jsonb_set(
                v_updated_staging, ARRAY[v_idx::text], v_updated_row
            );
        ELSE
            -- New row: append and stamp all its fields
            v_updated_staging := v_updated_staging || jsonb_build_array(v_delta_elem);
            IF v_use_cell_ts AND p_cell_ts->v_row_id IS NOT NULL THEN
                v_new_ts_stored := jsonb_set(
                    v_new_ts_stored, ARRAY[v_row_id], p_cell_ts->v_row_id
                );
            END IF;
        END IF;
    END LOOP;

    UPDATE projects_hub
    SET vendor_staging_data = v_updated_staging,
        cell_timestamps     = CASE WHEN v_use_cell_ts
                                   THEN v_new_ts_stored
                                   ELSE cell_timestamps END,
        version             = v_hub_version + 1
    WHERE id = v_hub_id;

    RETURN QUERY SELECT (v_hub_version + 1)::int AS new_version, v_skipped AS skipped;
END;
$$;
