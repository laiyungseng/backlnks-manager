-- Migration: Add password_hash column to admin_users
-- Run this once in your Supabase SQL Editor.
-- After running, update each admin account's password_hash via the admin UI
-- or by running the seed script below, then remove the plaintext `password` column.

-- Step 1: Add the new column
ALTER TABLE public.admin_users
    ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Step 2: After you have updated all rows with bcrypt hashes (see app UI or script),
-- drop the plaintext column:
--   ALTER TABLE public.admin_users DROP COLUMN password;

-- Step 3: Make password_hash NOT NULL once all rows are migrated:
--   ALTER TABLE public.admin_users ALTER COLUMN password_hash SET NOT NULL;
