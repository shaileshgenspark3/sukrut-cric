# Project State: Sukrut Premier League Auction System

**Last updated:** 2026-03-06
**Current Phase:** Phase 1 (Foundation & Data Management)
**Status:** Planning

## Project Reference

**Core Value:** Transparent, fair, and rule-compliant cricket auction where every bid respects team purse limits, category restrictions, and ensures all teams can complete a balanced roster.

**Tech Stack:**
- Next.js 16.1.6
- React 19.2.3
- Supabase (PostgreSQL + Realtime)
- Tailwind CSS 4
- Framer Motion 12.35.0
- TanStack Query 5.90.21
- TypeScript 5

**Key Constraints:**
- Real-time via Supabase Realtime for bid/price updates
- Base purse: ₹30,00,000 (₹30 lakhs)
- Category limits: 1 captain + 8 players total (Male max 7, Female max 2)
- Single admin type (Core Admin only)
- Maintain existing schema compatibility (additions only)

## Current Position

**Phase:** Phase 1 - Foundation & Data Management
**Plan:** TBD (not yet planned)
**Status:** Not started
**Progress Bar:** █████░░░░░░░░ 20%

**Current Phase Goal:** Fix critical bugs and establish reliable player data management with admin control capabilities

**Phase Requirements:** BUG-01, BUG-02, BUG-03, DATA-01, DATA-02, DATA-03, ADMIN-01 (7 requirements)

## Performance Metrics

**Roadmap:**
- Total Phases: 5
- Requirements: 60/60 mapped ✓
- Current Phase: 1/5

**Requirements Breakdown:**
- v1 requirements: 60 (100% mapped)
- v2 requirements: 9 (deferred)
- Out of scope: 8 features

## Accumulated Context

### Decisions Made

| Decision | Rationale | Status |
|----------|-----------|--------|
| Use max of actual price or base price for calculations | Safer to prevent overspending based on real spending | Pending implementation |
| Both auto-alert + manual ban for team restrictions | System prevents most violations, admin has override for edge cases | Pending implementation |
| Auto-add captains to roster | Captains are part of team, should be visible | Pending implementation |
| CSV upload all player fields | Flexibility for data entry, matches database schema | Pending implementation |
| Strict vs Override mode for manual sales | Admin has control while maintaining safety checks | Pending implementation |
| Single admin type | Simplify permission model, reduce complexity | Pending implementation |

### Key Technical Decisions (from Research)

**Timer Management:**
- Server-side timer_expiry stored in database (TIMESTAMPTZ)
- react-timer-hook 4.0.4 for client-side display
- Client-server sync pattern to prevent desynchronization

**Bid Validation:**
- Server-side `SELECT FOR UPDATE` locking for race condition prevention
- Database-level validation before bid acceptance
- Materialized view for roster counts

**Data Import/Export:**
- Zod 4 for CSV validation (TypeScript-first schema validation)
- SheetJS for Excel export (json_to_sheet and writeFile API)
- PapaParse for CSV import (streaming, error handling)

**State Synchronization:**
- Supabase Realtime Postgres Changes (not Broadcast)
- TanStack Query with optimistic updates
- PostgreSQL as single source of truth

### Pitfalls to Avoid

1. **Race condition on simultaneous bids** - Implement `SELECT FOR UPDATE` with optimistic concurrency
2. **Timer desynchronization during pause/resume** - Store timer expiry timestamp in database
3. **Incorrect max bid calculation** - Database-level validation before bid acceptance
4. **Reverse sale doesn't restore purse correctly** - Use immutable auction_log table
5. **Sold player reappears in auction** - Database constraint preventing UPDATE if player is sold
6. **CSV import corrupts data** - Validate all rows before insertion with Zod schema
7. **Bid cooldown bypass via rapid clicks** - Enforce server-side throttling with `last_bid_time`

### Todos

**Phase 1 (Next):**
- [ ] Plan Phase 1: Foundation & Data Management
- [ ] Implement BUG-01: Edit and Delete buttons in Admin Overview tab
- [ ] Implement BUG-02: Edit and Delete buttons in Admin Players tab
- [ ] Implement BUG-03: Purse amount update (30,000 to 30,00,000)
- [ ] Implement DATA-01: CSV upload for bulk player import
- [ ] Implement DATA-02: Erase All Players button with confirmation
- [ ] Implement DATA-03: Max 9 players per team enforcement
- [ ] Implement ADMIN-01: Search functionality in Live Controller

**Phase 2:**
- [ ] Plan Phase 2: Captain System & Rules Configuration
- [ ] Implement captain assignment workflow
- [ ] Implement category-wise purse deduction
- [ ] Implement team composition restrictions
- [ ] Configure base prices and bid increments

**Phase 3:**
- [ ] Plan Phase 3: Live Auction Core
- [ ] Implement timer management system
- [ ] Implement auction flow orchestration
- [ ] Implement player detail display
- [ ] Implement top 3 bids and bid history display

**Phase 4:**
- [ ] Plan Phase 4: Bid Validation & Enforcement
- [ ] Implement max bid calculation logic
- [ ] Implement category restriction enforcement
- [ ] Implement 3-second bid cooldown
- [ ] Implement team eligibility checks

**Phase 5:**
- [ ] Plan Phase 5: Logging, Manual Sales & Data Integrity
- [ ] Implement auction logging system
- [ ] Implement reverse sale functionality
- [ ] Implement CSV export
- [ ] Implement manual sales (strict/override modes)

### Blockers

**Current Blockers:** None

**Potential Risks:**
- Timer synchronization edge cases (pause exactly at 0.1 seconds, resume after hours-long pause, clock drift) - validate during Phase 2
- Supabase Realtime performance under load (1,000+ concurrent users) - may require load testing
- Postgres Changes RLS behavior - verify channel-level authorization during Phase 3

### Notes

**Research Status:** HIGH confidence

**Research Flags (needing deeper planning):**
- Phase 2: Timer synchronization edge cases
- Phase 3: Supabase Realtime performance under load

**Validated Features (Existing):**
- Tournament settings configuration ✓
- Player catalog with categories (A+, A, B, C, F) ✓
- Team and captain management ✓
- Live auction bidding with real-time updates ✓
- Role-based access (Admin/Captain) ✓
- Auction rules and purse management ✓
- Player roster tracking ✓
- Real-time Supabase subscriptions ✓
- Landing page with auction status ✓
- Admin dashboard with Overview, Players, Rules, Live Controller tabs ✓
- Captain dashboard with purse visualization and bidding interface ✓

## Session Continuity

**Last Action:** Created ROADMAP.md with 5 phases covering all 60 v1 requirements

**Next Actions:**
1. User reviews and approves roadmap
2. Plan Phase 1 using `/gsd-plan-phase 1`
3. Execute Phase 1 plans
4. Validate Phase 1 success criteria
5. Advance to Phase 2

**Context Preservation:**
- All requirements mapped to phases in ROADMAP.md
- Traceability table in REQUIREMENTS.md updated
- STATE.md captures all decisions, todos, and blockers
- Research findings preserved in research/SUMMARY.md

---
*State initialized: 2026-03-06*
