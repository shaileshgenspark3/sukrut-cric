# Sukrut Premier League Auction System - Roadmap

**Created:** 2026-03-06
**Depth:** Standard (5 phases)
**Coverage:** 60/60 requirements mapped ✓

## Phases

- [x] **Phase 1: Foundation & Data Management** - Bug fixes, player data management, admin controls ✓
- [x] **Phase 2: Captain System & Rules Configuration** - Captain assignment, team composition rules, purse management ✓
- [ ] **Phase 3: Live Auction Core** - Timer system, auction flow, player display, bid history
- [ ] **Phase 4: Bid Validation & Enforcement** - Max bid calculations, category restrictions, eligibility checks
- [ ] **Phase 5: Logging, Manual Sales & Data Integrity** - Auction logs, reverse sales, CSV operations, admin workflows

## Phase Details

### Phase 1: Foundation & Data Management

**Goal:** Fix critical bugs and establish reliable player data management with admin control capabilities

**Depends on:** Nothing (first phase)

**Requirements:** BUG-01, BUG-02, BUG-03, DATA-01, DATA-02, DATA-03, ADMIN-01

**Success Criteria** (what must be TRUE):
1. Admin can edit and delete teams from the Overview tab, and edit/delete players from the Players tab without errors
2. Admin can upload CSV files to bulk import players, and all player fields are correctly imported with validation
3. Admin can erase all players with confirmation, and all players are removed from database
4. System prevents adding more than 9 players to any team roster and shows clear error message
5. Admin can search for players in Live Controller by name, category, role, or gender to select for auction

**Plans:** 3 plans (all in Wave 1)
- [x] 1-foundation-01-PLAN.md — Fix Edit/Delete functionality for teams and players (BUG-01, BUG-02) ✓
- [x] 1-foundation-02-PLAN.md — Implement CSV import, erase all players, and fix global purse update (DATA-01, DATA-02, BUG-03) ✓
- [x] 1-foundation-03-PLAN.md — Enforce roster limit and add Live Controller search (DATA-03, ADMIN-01) ✓

---

### Phase 2: Captain System & Rules Configuration

**Goal:** Enable captain assignment, enforce team composition rules, and configure auction pricing rules

**Depends on:** Phase 1

**Requirements:** CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, CAPT-06, RULE-01, RULE-06, LIFE-01, LIFE-02, LIFE-03, ADMIN-03

**Success Criteria** (what must be TRUE):
1. Admin can assign captains to teams from Captain Selection tab, and captains are automatically added to team roster with sold_price=0
2. Captains are marked with is_captain=true, linked to teams via captain_player_id, and cannot be deployed to auction or bid on
3. System automatically deducts captain category-wise amounts from team purse (A+=5,00,000, A=2,00,000, B=0, F=0) upon assignment
4. Admin can manually deduct team purse amounts with reason field, and deductions persist to database
5. Category-wise base prices are configured (A+=5,00,000, A=2,00,000, B=1,00,000, F=50,000) and enforced in auction calculations
6. Team composition restrictions are enforced (Male: A+=1, A=3, B=4; Female: F=1; Total: 1 captain + 8 players)
7. System uses simplified Core Admin role only, and all admin operations work correctly

**Plans:** 4 plans (Wave 1: 1 plan, Wave 2: 2 plans, Wave 3: 1 plan)
- [x] 2-captain-system-01-PLAN.md — Add database schema for captain system, base prices, and simplified admin roles (CAPT-02, RULE-01, RULE-06, ADMIN-03) ✓
- [x] 2-captain-system-02-PLAN.md — Create Captain Selection UI with dropdown assignment and automatic roster addition (CAPT-01, CAPT-02, CAPT-04, LIFE-03) ✓
- [x] 2-captain-system-03-PLAN.md — Add manual purse deduction and base price configuration to Rules tab (CAPT-05, RULE-01) ✓
- [x] 2-captain-system-04-PLAN.md — Enforce team composition rules and prevent ineligible players from auction deployment (RULE-06, LIFE-01, LIFE-02, LIFE-03) ✓

---

### Phase 3: Live Auction Core

**Goal:** Implement timer system, auction flow orchestration, and live display of auction information

**Depends on:** Phase 2

**Requirements:** RULE-02, RULE-03, RULE-04, FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, FLOW-06, FLOW-07, DISPLAY-01, DISPLAY-02, DISPLAY-03, DISPLAY-04, DISPLAY-05

**Success Criteria** (what must be TRUE):
1. Admin can deploy players to auction, and player details (name, height, handy, type, earlier seasons, achievements, age, category) are displayed prominently to captains
2. Countdown timer is visible in Admin Live Controller and Captain Dashboard, and timer correctly shows seconds remaining
3. When first timer expires with no bids, admin can choose to "keep unsold" or "re-auction player", and action is executed correctly
4. When timer expires with bids, admin can "confirm sale" or "modify bid/team before finalizing", and sale is recorded correctly
5. Admin can pause and resume auction, and timer stops/continues from correct state
6. Admin can configure timer settings during live auction (first bid timer, subsequent bid timer), and changes apply immediately
7. Top 3 bids are displayed prominently with team name, logo, captain image, and bid amount to all captains
8. Bid history from 4th bid onwards is displayed with team name and amount only
9. Captain dashboard clears screen between players, shows purchase details when sold/unsold, and remains blank until next player deployed
10. Base price of current player is visible to all participants, and bid increments of 25,000 are applied correctly

**Plans:** 3 plans (Wave 1: 1 plan, Wave 2: 1 plan, Wave 3: 1 plan)
- [ ] 3-live-auction-core-01-PLAN.md — Implement timer management system with pause/resume and configurable settings (RULE-03, RULE-04, FLOW-01, FLOW-06, FLOW-07)
- [ ] 3-live-auction-core-02-PLAN.md — Implement auction flow orchestration: player deployment, timer expiry handling, sale confirmation (RULE-02, FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, DISPLAY-03, DISPLAY-04, DISPLAY-05)
- [ ] 3-live-auction-core-03-PLAN.md — Implement real-time bid display: top 3 bids prominently, history from 4th onwards (DISPLAY-01, DISPLAY-02)

---

### Phase 4: Bid Validation & Enforcement

**Goal:** Calculate max bid limits, enforce category restrictions, and validate all bids server-side

**Depends on:** Phase 3

**Requirements:** RULE-05, VALID-01, VALID-02, VALID-03, VALID-04, VALID-05, VALID-06, ADMIN-02, ADMIN-04

**Success Criteria** (what must be TRUE):
1. System calculates max bid per player using formula: `Remaining purse - (Category base prices for unfilled roster slots) + Current player category base price`, using max of actual purchase price or base price
2. Captain receives red alert when bid exceeds max bid: "You can max bid this much only", and bid is rejected if exceeded
3. Captain receives red alert when category limit reached: "You are not eligible to bid in this player as you have X number of X category player", and bid is rejected
4. Team is marked RED in Admin Live Controller when ineligible to bid (category limit or max bid exceeded)
5. Bids are rejected server-side if captain category limit reached, max bid exceeded, or purse insufficient after considering unfilled roster requirements
6. 3-second cooldown is enforced after each bid, and captain cannot bid again for 3 seconds server-side
7. Admin can ban specific teams from bidding on current player, and ban is temporary (clears after player sold/unsold)
8. Admin can view list of eligible teams to bid on current player (excluding banned and ineligible teams)

**Plans:** TBD

---

### Phase 5: Logging, Manual Sales & Data Integrity

**Goal:** Implement comprehensive auction logging, reverse sale capability, CSV operations, and manual sale workflows

**Depends on:** Phase 4

**Requirements:** DATA-04, LOG-01, LOG-02, LOG-03, LOG-04, MANUAL-01, MANUAL-02, MANUAL-03, MANUAL-04, MANUAL-05, LIFE-04

**Success Criteria** (what must be TRUE):
1. Log Entries tab in Admin shows all sold/unsold records with player name, details, sold to team, price, status, and timestamp
2. Admin can delete entries from Log Entries with confirmation, and deletion reverses sale (player becomes available, team purse restored, bid history cleared)
3. Deleted entries are recorded in audit trail with what was reversed, by whom, when, and reason
4. Admin can download auction logs as CSV or Excel files, and all fields are included in export
5. Admin can create manual sales by selecting player, team, amount, and mode
6. Strict mode enforces all validation rules (category limits, max bid, purse sufficiency) for manual sales
7. Override mode bypasses validation with warning for manual sales
8. Manual sale validation shows error to admin if rules would be violated
9. Manual sales are recorded in Log Entries with "Manual" tag
10. Deleted Log Entry restores player to available status and team to previous state (sold price refunded to purse)

**Plans:** TBD

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Data Management | 0/3 | Planned | - |
| 2. Captain System & Rules Configuration | 0/4 | Planned | - |
| 3. Live Auction Core | 0/3 | Planned | - |
| 4. Bid Validation & Enforcement | 0/2 | Not started | - |
| 5. Logging, Manual Sales & Data Integrity | 0/3 | Not started | - |

## Dependency Graph

```
Phase 1: Foundation & Data Management
    ↓
Phase 2: Captain System & Rules Configuration
    ↓
Phase 3: Live Auction Core
    ↓
Phase 4: Bid Validation & Enforcement
    ↓
Phase 5: Logging, Manual Sales & Data Integrity
```

## Phase Ordering Rationale

- **Foundation first (Phase 1):** Bug fixes and data management are prerequisites for all other phases. Without reliable player data and admin controls, advanced features cannot be built.

- **Rules before flows (Phase 2):** Captain assignment and rule configuration must be established before implementing auction flow. Auction behavior depends on correctly configured rules.

- **Core before validation (Phase 3):** Live auction timer and flow must work correctly before adding bid validation. Need baseline auction behavior to validate against.

- **Flow before enforcement (Phase 4):** Auction display and timer orchestration must be complete before adding bid restrictions. Complex validation logic needs live context to test.

- **Logging last (Phase 5):** Comprehensive logging, reverse sales, and manual workflows depend on all core auction functionality working correctly.

---
*Roadmap created: 2026-03-06*
