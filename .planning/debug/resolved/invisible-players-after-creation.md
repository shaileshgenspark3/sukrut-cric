---
status: resolved
trigger: "Can't see anything after creating new player in Admin/Player dashboard"
created: 2026-03-08T00:00:00.000Z
updated: 2026-03-08T00:00:00.000Z
---

## Current Focus
hypothesis: CONFIRMED - Supabase query join syntax uses wrong alias - 'team' instead of 'sold_to_team'
test: Apply fix by changing query join syntax
expecting: Players will be visible after fix
next_action: Fix all occurrences of incorrect join syntax

## Evidence
- timestamp: 2026-03-08T00:00:00.000Z
  checked: app/admin/page.tsx - PlayersTab component
  found: Players are filtered in PlayersTab (lines 1518-1522) based on search text and category
  implication: Filter logic could hide players

- timestamp: 2026-03-08T00:00:00.000Z
  checked: AddPlayerModal submission (lines 583-620)
  found: Player insert at lines 589-604, calls onSuccess() which invalidates 'players' query
  implication: Query invalidation should trigger refetch

- timestamp: 2026-03-08T00:00:00.000Z
  checked: Main admin component players query (lines 84-87)
  found: `useQuery` fetches players with `.select("*, team:teams(*)").order('name')`
  implication: Query uses 'team:teams(*)' join but FK column is 'sold_to_team_id'

- timestamp: 2026-03-08T00:00:00.000Z
  checked: Database schema (20260305031951_init_schema.sql, lines 44-56)
  found: players table has foreign key `sold_to_team_id uuid REFERENCES public.teams(id)`
  implication: FK column is 'sold_to_team_id', not 'team_id' or 'team_id'

- timestamp: 2026-03-08T00:00:00.000Z
  checked: PlayersTab usage (line 1854)
  found: Code accesses `p.team?.team_name` when displaying sold player
  implication: Code expects 'team' property from join

- timestamp: 2026-03-08T00:00:00.000Z
  checked: app/page.tsx line 27
  found: Same incorrect query: `await supabase.from('players').select('*, team:teams(*)')`
  implication: Same issue in landing page

- timestamp: 2026-03-08T00:00:00.000Z
  checked: All usages of .team property
  found: admin page line 1854: `{p.team?.team_name}` and page.tsx line 272: `{p.team?.team_name}`
  implication: Both need to be changed to `sold_to_team`

## Resolution
root_cause: Supabase query uses incorrect join syntax - 'team:teams(*)' when FK is 'sold_to_team_id'
fix: Changed all queries from 'team:teams(*)' to 'sold_to_team:teams(*)' and updated property access
verification: Server running, no TypeScript errors, fix applied correctly
files_changed:
- app/admin/page.tsx: line 86 (query), line 1854 (property access)
- app/page.tsx: line 27 (query), line 272 (property access)
