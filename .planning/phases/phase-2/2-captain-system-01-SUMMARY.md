---
phase: 2-captain-system
plan: 01
subsystem: database
tags: [sql, supabase, migrations, postgres, rls]

# Dependency graph
requires:
  - phase: 1-foundation
    provides: init schema, teams table, players table, auction_rules table
provides:
  - captain system database schema (is_captain, captain_team_id, captain_player_id columns)
  - base price configuration columns (base_price_A_plus, base_price_A, base_price_B, base_price_F)
  - current purse tracking (current_purse column)
  - simplified admin role system (core_admin, captain only)
affects: [2-captain-system-02, 2-captain-system-03, 2-captain-system-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent migrations with ADD COLUMN IF NOT EXISTS"
    - "ENUM type recreation with DROP/RENAME pattern"
    - "Foreign key references with ON DELETE behavior"
    - "Index creation for performance optimization"

key-files:
  created:
    - supabase/migrations/20260306000000_add_captain_system_columns.sql
    - supabase/migrations/20260306000001_add_base_prices_and_current_purse.sql
  modified: []

key-decisions:
  - "Simplified admin role ENUM to only core_admin and captain (removed admin)"
  - "Used ADD COLUMN IF NOT EXISTS for safe idempotent migrations"
  - "Initialize current_purse from starting_purse to maintain data integrity"

patterns-established:
  - "Pattern 1: Migration files use ISO timestamp prefix for ordering"
  - "Pattern 2: Indexes created for all foreign key and frequently queried columns"
  - "Pattern 3: COMMENT ON COLUMN for documentation of all new columns"
  - "Pattern 4: ENUM type changes require recreate with DROP/RENAME pattern"

requirements-completed: [CAPT-02, RULE-01, RULE-06, ADMIN-03]

# Metrics
duration: 5min
completed: 2026-03-06T05:03:00Z
---

# Phase 2: Plan 01 Summary

**Captain system database schema with captain assignment columns, base price configuration, current purse tracking, and simplified admin role ENUM**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T04:58:57Z
- **Completed:** 2026-03-06T05:03:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Database schema foundation for captain assignment system
- Captain-related columns added to players and teams tables
- Base price configuration columns added to tournament_settings
- Current purse tracking added to auction_rules
- Admin role simplified to core_admin and captain only
- All RLS policies updated to use simplified role system

## Task Commits

Each task was committed atomically:

1. **task 1: Add captain system columns and simplify admin roles** - `2c562bc` (feat)
2. **task 2: Add base prices and current purse tracking** - `2c3addd` (feat)

## Files Created/Modified

- `supabase/migrations/20260306000000_add_captain_system_columns.sql` - Captain system columns and admin role simplification
- `supabase/migrations/20260306000001_add_base_prices_and_current_purse.sql` - Base prices and current purse tracking

## Decisions Made

- Simplified app_role ENUM from (core_admin, admin, captain) to (core_admin, captain) to reduce complexity
- Initialize current_purse from starting_purse to maintain backward compatibility
- Used ADD COLUMN IF NOT EXISTS for safe idempotent migrations
- Created indexes for all new foreign key columns for query performance

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required. Database migrations will be applied via Supabase CLI.

## Next Phase Readiness

- Captain system database schema complete
- Base price columns ready for configuration UI
- Current purse tracking ready for manual deduction feature
- Simplified admin role system ready for RLS policy enforcement
- Ready for Wave 2: Captain Selection UI and Rules tab enhancements

---
*Phase: 2-captain-system-01*
*Completed: 2026-03-06*
