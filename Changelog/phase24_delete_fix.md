# Phase 24 Delete Fix

**Date:** 2026-03-04

## Issue
Deleting a project through the Admin Dashboard (`DashboardClient.jsx`) was failing silently because the legacy tables `project_targets` and `project_list` from before Phase 24 were still attached to the project via foreign key constraints. 

## Resolution
Modified `src/app/admin/actions.js`:
- Added explicit `delete()` sweeps for `project_targets` and `project_list` using the `project_id`.
- Safely placed before the `projects` table deletion to avoid constraint violations.
- Included error tolerance for these explicit deletes so that when the old tables are finally dropped (as defined in Phase 24 SQL migration step 5), the app will simply ignore the missing table errors and cleanly delete everything else.
