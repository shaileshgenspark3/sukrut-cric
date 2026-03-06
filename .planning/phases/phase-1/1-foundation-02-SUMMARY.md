---
phase: 1-foundation
plan: 02
subsystem: [admin-ui, data-import, validation]
tags: [csv, zod, validation, erase-all, global-purse, supabase]

# Dependency graph
requires:
  - phase: None
    provides: []
provides:
  - CSV bulk import for players with Zod validation
  - Erase all players functionality
  - Global purse propagation to all teams
affects: [1-foundation-03]

# Tech tracking
tech-stack:
  added: [zod, papaparse]
  patterns: [csv-validation, error-reporting, bulk-import]

key-files:
  created: [lib/csv/playerSchema.ts]
  modified: [app/admin/page.tsx]

key-decisions:
  - "Zod schema for comprehensive player field validation"
  - "Detailed error reporting (success/skip/error counts)"
  - "Global purse propagates to tournament_settings and all auction_rules"

patterns-established:
  - "CSV import pattern: Papa.parse → Zod.validate → Supabase.insert"
  - "Error reporting pattern: show counts and first 5 error details"

requirements-completed: [DATA-01, DATA-02, BUG-03]

# Metrics
duration: 5min
completed: 2026-03-06
---

# Phase 1: Plan 2 - Implement CSV import, erase all players, and fix global purse update

**CSV bulk import with Zod validation, erase all players with confirmation, and global purse propagation to all teams**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-06T04:40:31Z
- **Completed:** 2026-03-06T04:45:31Z
- **Tasks:** 1
- **Files modified:** 2

## Accomplishments
- Created Zod schema for player CSV validation with all 12 player fields
- Added eraseAllPlayers state and handler with confirmation modal
- Enhanced CSV import with detailed error reporting (success/skip/error counts)
- Fixed updateGlobalPurse to propagate to tournament_settings and all auction_rules
- Added "Erase All" button with destructive styling in Players tab

## task Commits

Each task was committed atomically:

1. **task 1: Add erase all players, enhanced CSV import, fix global purse update** - `e9ae92c` (feat)

**Plan metadata:** (to be added in final commit)

## Files Created/Modified
- `lib/csv/playerSchema.ts` - Zod schema for player CSV validation with all fields (Name, Classifications, Age, Height, Handy, Type, Earlier Seasons, Achievements, Special Remarks, Combat Role, Variant, Market Base)
- `app/admin/page.tsx` - Added eraseAllPlayers function, EraseAllConfirmationModal, enhanced importPlayersCSV with Zod validation, fixed updateGlobalPurse

## Decisions Made
- Zod schema for comprehensive player field validation (better than manual checks)
- Detailed error reporting shows success count, skip count, and error count
- Error details limited to first 5 errors to avoid overwhelming UI
- Global purse propagates to both tournament_settings and all auction_rules rows

## Deviations from Plan

None - plan executed exactly as written

## Issues Encountered
None

## User Setup Required
None - no external service configuration required

## Next Phase Readiness
- CSV import working with full validation
- Erase all players working with confirmation
- Global purse update working for all teams
- Ready for roster limit enforcement and Live Controller search

---
*Phase: 1-foundation*
*Completed: 2026-03-06*
