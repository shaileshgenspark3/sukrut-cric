# Project State: Sukrut Premier League Auction System

**Last updated:** 2026-03-06
**Current Phase:** Phase 3 (Live Auction Core)
**Status:** Executing plan 3-live-auction-core-01

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

**Phase:** Phase 3 - Live Auction Core
**Plan:** 3-live-auction-core-01 (Timer Management System)
**Status:** In Progress
**Progress Bar:** ████░░░░░░░░ 20%

**Current Phase Goal:** Implement timer system, auction flow orchestration, and live display of auction information

**Phase Requirements:** RULE-03, RULE-04, FLOW-01, FLOW-06, FLOW-07 (requirements for timer management)

## Performance Metrics

**Roadmap:**
- Total Phases: 5
- Requirements: 60/60 mapped ✓
- Current Phase: 2/5 (Phase 2 Complete)

**Requirements Breakdown:**
- v1 requirements: 60 (100% mapped)
- v2 requirements: 9 (deferred)
- Out of scope: 8 features

## Accumulated Context

### Decisions Made

| Decision | Rationale | Status |
|----------|-----------|--------|
| Use max of actual price or base price for calculations | Safer to prevent overspending based on real spending | Pending implementation |
| Both auto-alert + manual ban for team restrictions | System prevents most violations, admin has override for edge cases | Implemented (2-captain-system-04) |
| Auto-add captains to roster | Captains are part of team, should be visible | Implemented (2-captain-system-02) |
| CSV upload all player fields | Flexibility for data entry, matches database schema | Implemented (1-foundation-02) |
| Strict vs Override mode for manual sales | Admin has control while maintaining safety checks | Pending implementation |
| Single admin type | Simplify permission model, reduce complexity | Implemented (2-captain-system-01) |
| Auth users are not deleted when teams are deleted | Security consideration - keep auth records | Implemented (1-foundation-01) |
| Modal state passed via modalProps object pattern | Cleaner API for passing modal handlers | Implemented (1-foundation-01) |
| Zod schema for comprehensive player field validation | Better than manual checks, TypeScript-first | Implemented (1-foundation-02) |
| Global purse propagates to tournament_settings and all auction_rules | Ensure all teams have consistent starting purse | Implemented (1-foundation-02) |
| Roster check happens before database update | Prevents partial transactions | Implemented (1-foundation-03) |
| Logical AND operators for conditional JSX rendering | Better readability than ternary | Implemented (1-foundation-03) |
| Captains automatically added to roster with sold_price=0 | Captains are part of team, should be counted toward roster | Implemented (2-captain-system-02) |
| Category-based captain deduction | A+=₹5L, A=₹2L, B/F=₹0 based on player category | Implemented (2-captain-system-02) |
| Manual purse deduction with reason tracking | Audit trail for manual deductions, deferred logging to Phase 5 | Implemented (2-captain-system-03) |
| Base prices configurable per category | Flexibility for future tournament changes | Implemented (2-captain-system-03) |
| Team composition limits enforced (Male 7, Female 2, Total 8+1) | Ensure all teams can complete balanced roster | Implemented (2-captain-system-04) |
| Auction eligibility filtering (no captains, no sold players) | Prevent ineligible players from being deployed | Implemented (2-captain-system-04) |
| Server-side database functions for validation | Server-side validation prevents invalid database states | Implemented (2-captain-system-04) |

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

**Phase 1 (Completed):**
- [x] Plan Phase 1: Foundation & Data Management
- [x] Implement BUG-01: Edit and Delete buttons in Admin Overview tab
- [x] Implement BUG-02: Edit and Delete buttons in Admin Players tab
- [x] Implement BUG-03: Purse amount update (30,000 to 30,00,000)
- [x] Implement DATA-01: CSV upload for bulk player import
- [x] Implement DATA-02: Erase All Players button with confirmation
- [x] Implement DATA-03: Max 9 players per team enforcement
- [x] Implement ADMIN-01: Search functionality in Live Controller

**Phase 2 (Completed):**
- [x] Plan Phase 2: Captain System & Rules Configuration
- [x] Implement CAPT-02: Add captain system database schema
- [x] Implement CAPT-01: Create Captain Selection UI
- [x] Implement CAPT-04: Automatic roster addition for captains
- [x] Implement RULE-01: Manual purse deduction functionality
- [x] Implement RULE-06: Team composition enforcement
- [x] Implement LIFE-01: Auction eligibility filtering (captains)
- [x] Implement LIFE-02: Auction eligibility filtering (sold players)
- [x] Implement LIFE-03: Auction eligibility filtering (unsold only)
- [x] Implement ADMIN-03: Simplified admin role system

**Phase 3 (Next):**
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
- Edit and delete functionality for teams and players ✓
- CSV bulk import for players with Zod validation ✓
- Erase all players with confirmation ✓
- Global purse propagation to all teams ✓
- Roster limit enforcement (max 9 players per team) ✓
- Search and filter functionality in Live Controller ✓

## Session Continuity

**Last Action:** Completed Phase 2 with all 4 plans (Captain System, Rules Configuration, Team Composition)

**Next Actions:**
1. Validate Phase 2 success criteria
2. Plan Phase 3 using `/gsd-plan-phase 3`
3. Execute Phase 3 plans
4. Advance to Phase 4

**Context Preservation:**
- All requirements mapped to phases in ROADMAP.md
- Traceability table in REQUIREMENTS.md updated
- STATE.md captures all decisions, todos, and blockers
- Research findings preserved in research/SUMMARY.md

---

*Last session:* 2026-03-06T05:58:00Z (Phase 2 completed)
*State initialized: 2026-03-06*
