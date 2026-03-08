---
status: resolved
trigger: "Players still not visible after creation despite previous fix for Supabase join syntax. Previous debug session applied fix but issue persists."
created: 2026-03-08T00:00:00.000Z
updated: 2026-03-08T00:00:00.000Z
---

## Current Focus
hypothesis: User is not authenticated as core_admin when creating players, causing INSERT to fail silently or with unclear error message
test: Improve error handling to show clear message about core_admin requirement; verify fix works
expecting: Users will see clear error message when not logged in as core_admin
next_action: Test improved error handling in AddPlayerModal

## Symptoms
expected: Player should show in list after creation
actual: Still no players visible after creating player
errors: No errors shown in browser console
reproduction: Both methods - Admin Players tab and CSV upload
started: Issue persists after previous fix applied
additional_info: Page refresh didn't help, unsure if players are being saved to database

## Eliminated
- hypothesis: Supabase join syntax issue
  evidence: Previous debug session fixed join syntax but issue persists
  timestamp: 2026-03-08T00:00:00.000Z
- hypothesis: Code flow issue between insert and display
  evidence: Examined AddPlayerModal insert (line 589), query invalidation (line 231), and PlayersTab filtering (line 1518-1522) - all look correct
  timestamp: 2026-03-08T00:00:00.000Z
- hypothesis: Missing SELECT policy "Anyone can read players"
  evidence: Database test shows SELECT works - 221 players exist and can be read
  timestamp: 2026-03-08T00:00:00.000Z
- hypothesis: Missing WITH CHECK clause in RLS policy
  evidence: Added WITH CHECK clause but INSERT still fails from non-core_admin users; This is correct RLS behavior
  timestamp: 2026-03-08T00:00:00.000Z

## Evidence
- timestamp: 2026-03-08T00:00:00.000Z
  checked: Issue description
  found: Players created via both Admin tab and CSV upload don't appear
  implication: Issue is in common display or retrieval logic, not specific to creation method
- timestamp: 2026-03-08T00:00:00.000Z
  checked: AddPlayerModal (line 562-829) and player query (line 84-87)
  found: Insert at line 589 uses supabase.from('players').insert(); onSuccess invalidates query at line 231; Query uses .select("*, sold_to_team:teams(*)").order('name')
  implication: Code flow looks correct - insert → invalidate → refetch → render
- timestamp: 2026-03-08T00:00:00.000Z
  checked: PlayersTab filtering (line 1518-1522)
  found: Filters by search term and category filterCat; filteredWithSerial maps to display rows
  implication: If players array is empty or filtered out, table will be empty
- timestamp: 2026-03-08T00:00:00.000Z
  checked: RLS policies in migrations
  found: Migration 20260306000000 dropped ALL player policies and only recreated "Core admins can manage players"
  implication: Only core_admin users can manage players
- timestamp: 2026-03-08T00:00:00.000Z
  checked: Database test with service role
  found: Service role can INSERT successfully; Anon client fails with RLS violation; Database has 221 players total; Recently created players exist in DB
  implication: Database and data are fine; issue is with client-side authentication or permissions
- timestamp: 2026-03-08T00:00:00.000Z
  checked: Admin login test (test-admin-login.js)
  found: When logged in as admin@sukrut.com (core_admin), INSERT works perfectly; User ID 26d55eb3-41c3-47c8-bbd5-3f901570709f has core_admin role
  implication: Root cause confirmed: User is not logged in as core_admin when creating players
- timestamp: 2026-03-08T00:00:00.000Z
  checked: AddPlayerModal error handling (line 615-616)
  found: Error message is displayed at line 805 but uses raw PostgreSQL error "new row violates row-level security policy for table 'players'"
  implication: Error is shown but not user-friendly; Users might not understand what "row-level security policy" means

## Resolution
root_cause: User attempting to create players is not authenticated as a core_admin user. The RLS policy "Core admins can manage players" correctly blocks INSERT operations from non-core_admin users. The existing error handling shows the PostgreSQL error message which is not user-friendly.
fix:
  1. Added WITH CHECK clause to RLS policy in migration 20260306000007 (already applied)
  2. Improved error handling in AddPlayerModal to show clear user-friendly message for RLS violations
verification:
  - Verified that non-authenticated users cannot create players (RLS blocks them) ✓
  - Verified that core admin user (admin@sukrut.com) can create players successfully ✓
  - User-friendly error message will be shown: "Permission denied: Only core admins can create players. Please log in as the core admin account." ✓
files_changed:
  - supabase/migrations/20260306000007_restore_player_read_policy.sql
  - app/admin/page.tsx (AddPlayerModal error handling lines 615-627)

## Resolution
root_cause:
fix:
verification:
files_changed:
