# Requirements: Sukrut Premier League Auction System

**Defined:** 2026-03-06
**Core Value:** Transparent, fair, and rule-compliant cricket auction where every bid respects team purse limits, category restrictions, and ensures all teams can complete a balanced roster.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Bug Fixes

- [x] **BUG-01**: Edit and Delete buttons work in Admin Overview tab (team editing, captain editing)
- [x] **BUG-02**: Edit and Delete buttons work in Admin Players tab (player editing, player deletion)
- [x] **BUG-03**: Purse amount update works (change from 30,000 to 30,00,000, "apply global" button persists to database)

### Data Management

- [x] **DATA-01**: CSV upload for bulk player import supports all fields (name, category, age, height, handy, type, earlier_seasons, achievements, special_remarks, playing_role, gender, base_price)
- [x] **DATA-02**: "Erase All Players" button in Players tab with confirmation dialog
- [x] **DATA-03**: System enforces max 9 players per team during player addition (shows error if team roster full)
- [ ] **DATA-04**: CSV export of auction logs in Log Entries tab (all fields, downloadable as .xlsx and .csv)

### Admin Controls

- [x] **ADMIN-01**: Search functionality in Live Controller for selecting players to deploy (search by player name, filters by category/role/gender)

### Captain System

- [ ] **CAPT-01**: Captain Selection tab lists all teams with dropdown to select captain from available players
- [ ] **CAPT-02**: Captains marked with `is_captain=true` in database and linked to team via `captain_player_id`
- [ ] **CAPT-03**: Selected captains are forbidden from auction (not selectable in Live Controller, error if attempted)
- [ ] **CAPT-04**: Captains auto-added to team roster with `sold_price=0` and visible in captain dashboard
- [ ] **CAPT-05**: Admin can manually deduct team purse in Auction Rules tab (input amount, select team, reason field)
- [ ] **CAPT-06**: Category-wise purse deduction automatically applied (A+=5,00,000, A=2,00,000, B=0, F=0)

### Auction Rules

- [ ] **RULE-01**: Category-wise base prices configured (A+=5,00,000, A=2,00,000, B=1,00,000, F=50,000)
- [ ] **RULE-02**: Bid increment set to 25,000 per bid
- [ ] **RULE-03**: First bid timer configurable (default 30 seconds)
- [ ] **RULE-04**: Subsequent bid timer configurable (default 15 seconds)
- [ ] **RULE-05**: 3-second cooldown after each bid (captain cannot bid again for 3 seconds)
- [ ] **RULE-06**: Team composition restrictions enforced (Male: A+=1, A=3, B=4; Female: F=1; Total: 1 captain + 8 players)

### Auction Flow

- [ ] **FLOW-01**: Admin deploys player to auction (current player shown in Live Controller and captain dashboard)
- [ ] **FLOW-02**: Player details displayed to captains (Name, Height, Handy, Type, Earlier Seasons, Achievements, Age, Category prominently)
- [ ] **FLOW-03**: Countdown timer visible in Admin Live Controller and Captain Dashboard (seconds remaining)
- [ ] **FLOW-04**: Timer expires with no bids: admin prompted to "keep unsold" or "re-auction player"
- [ ] **FLOW-05**: Timer expires with bids: admin prompted to "confirm sale" or "modify bid/team before finalizing"
- [ ] **FLOW-06**: Pause button stops bidding and freezes timers; Resume button continues from paused state
- [ ] **FLOW-07**: Timer settings configurable during live auction (inputs for first timer and subsequent timer, save button)

### Bid Validation

- [ ] **VALID-01**: Max bid calculated per player: `Remaining purse - (Category base prices for unfilled roster slots) + Current player category base price`, using max of actual purchase price or base price
- [ ] **VALID-02**: Captain receives red alert when bid exceeds max bid: "You can max bid this much only"
- [ ] **VALID-03**: Captain receives red alert when category limit reached: "You are not eligible to bid in this player as you have X number of X category player"
- [ ] **VALID-04**: Team marked RED in Admin Live Controller when ineligible to bid (category limit or max bid exceeded)
- [ ] **VALID-05**: Bids rejected server-side if captain category limit reached or max bid exceeded
- [ ] **VALID-06**: Bids rejected server-side if team purse insufficient after considering unfilled roster requirements

### Live Auction Display

- [ ] **DISPLAY-01**: Top 3 bids shown prominently with team name, team logo, captain image, bid amount
- [ ] **DISPLAY-02**: Bid history from 4th bid onwards displayed (team name and amount only)
- [ ] **DISPLAY-03**: Captain dashboard clears screen when player sold/unsold (shows purchase details: player name, category, sold price)
- [ ] **DISPLAY-04**: Captain dashboard blank between players until next player deployed (no player data or bid history)
- [ ] **DISPLAY-05**: Base price of current player visible to all (starting bid amount)

### Auction Logging

- [ ] **LOG-01**: Log Entries tab in Admin shows all sold/unsold records (player name, details, sold to team, price, sold/unsold status, timestamp)
- [ ] **LOG-02**: Delete Entry button in Log Entries prompts admin to confirm reversal
- [ ] **LOG-03**: Delete Entry reverses sale (player becomes available again, team purse restored by sold amount, bid history cleared)
- [ ] **LOG-04**: Deleted entries recorded in audit trail (what was reversed, by whom, when, reason)

### Manual Sales

- [ ] **MANUAL-01**: Manual Sale button in Admin prompts for player selection, team selection, amount input, mode selection
- [ ] **MANUAL-02**: Strict mode enforces all validation rules (category limits, max bid, purse sufficiency)
- [ ] **MANUAL-03**: Override mode bypasses validation with warning
- [ ] **MANUAL-04**: Manual sale recorded in Log Entries with "Manual" tag
- [ ] **MANUAL-05**: Manual sale validation shows error to admin if rules would be violated (category limits, max bid, purse calculation)

### Player Lifecycle

- [ ] **LIFE-01**: Sold players cannot be deployed to auction again (not selectable in Live Controller)
- [ ] **LIFE-02**: Unsold players can be deployed to auction again (selectable in Live Controller)
- [ ] **LIFE-03**: Captains cannot be selected for auction (excluded from dropdown, error if attempted)
- [ ] **LIFE-04**: Deleted Log Entry restores player to available status and team to previous state

### Admin Features

- [ ] **ADMIN-02**: Admin can ban specific teams from bidding on current player (temporary restriction, clears after player sold/unsold)
- [ ] **ADMIN-03**: Core Admin only role (simplified from current core_admin/regular admin split)
- [ ] **ADMIN-04**: Admin can view list of eligible teams to bid on current player (excluding banned teams and ineligible teams)

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Performance & Scalability

- **PERF-01**: Load testing for 10+ teams bidding simultaneously (verify no race conditions)
- **PERF-02**: Database optimization for roster COUNT queries vs materialized views
- **PERF-03**: Supabase Realtime performance under 1,000+ concurrent users

### Advanced Features

- **ADV-01**: Video streaming integration for auction display
- **ADV-02**: Multiple concurrent auctions support
- **ADV-03**: Native mobile applications (iOS/Android)
- **ADV-04**: Automatic bid escalation (bot bidding with max bid settings)
- **ADV-05**: Real-time chat/annotation during auction
- **ADV-06**: Anonymous bidding (hide bidder identity)
- **ADV-07**: Progressive Web App (PWA with offline support)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Video streaming | Bandwidth-heavy, complex to host, not core auction functionality |
| Native mobile apps | Web app already mobile-responsive, doubles development cost |
| Multiple concurrent auctions | Database complexity, admin confusion, user overload |
| Automatic bid escalation (bot bidding) | Removes human element, defeats real-time excitement |
| Anonymous bidding | Transparency is critical in cricket auctions |
| Real-time chat/annotation | Distraction, potential collusion, administrative burden |
| Player performance statistics | Post-auction feature, out of scope for v1 |
| Team formation builder | Post-auction feature, out of scope for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| BUG-01 | Phase 1 | Complete |
| BUG-02 | Phase 1 | Complete |
| BUG-03 | Phase 1 | Complete |
| DATA-01 | Phase 1 | Complete |
| DATA-02 | Phase 1 | Complete |
| DATA-03 | Phase 1 | Complete |
| DATA-04 | Phase 5 | Pending |
| ADMIN-01 | Phase 1 | Complete |
| CAPT-01 | Phase 2 | Pending |
| CAPT-02 | Phase 2 | Pending |
| CAPT-03 | Phase 2 | Pending |
| CAPT-04 | Phase 2 | Pending |
| CAPT-05 | Phase 2 | Pending |
| CAPT-06 | Phase 2 | Pending |
| RULE-01 | Phase 2 | Pending |
| RULE-02 | Phase 3 | Pending |
| RULE-03 | Phase 3 | Pending |
| RULE-04 | Phase 3 | Pending |
| RULE-05 | Phase 4 | Pending |
| RULE-06 | Phase 2 | Pending |
| FLOW-01 | Phase 3 | Pending |
| FLOW-02 | Phase 3 | Pending |
| FLOW-03 | Phase 3 | Pending |
| FLOW-04 | Phase 3 | Pending |
| FLOW-05 | Phase 3 | Pending |
| FLOW-06 | Phase 3 | Pending |
| FLOW-07 | Phase 3 | Pending |
| VALID-01 | Phase 4 | Pending |
| VALID-02 | Phase 4 | Pending |
| VALID-03 | Phase 4 | Pending |
| VALID-04 | Phase 4 | Pending |
| VALID-05 | Phase 4 | Pending |
| VALID-06 | Phase 4 | Pending |
| DISPLAY-01 | Phase 3 | Pending |
| DISPLAY-02 | Phase 3 | Pending |
| DISPLAY-03 | Phase 3 | Pending |
| DISPLAY-04 | Phase 3 | Pending |
| DISPLAY-05 | Phase 3 | Pending |
| LOG-01 | Phase 5 | Pending |
| LOG-02 | Phase 5 | Pending |
| LOG-03 | Phase 5 | Pending |
| LOG-04 | Phase 5 | Pending |
| MANUAL-01 | Phase 5 | Pending |
| MANUAL-02 | Phase 5 | Pending |
| MANUAL-03 | Phase 5 | Pending |
| MANUAL-04 | Phase 5 | Pending |
| MANUAL-05 | Phase 5 | Pending |
| LIFE-01 | Phase 2 | Pending |
| LIFE-02 | Phase 2 | Pending |
| LIFE-03 | Phase 2 | Pending |
| LIFE-04 | Phase 5 | Pending |
| ADMIN-02 | Phase 4 | Pending |
| ADMIN-03 | Phase 2 | Pending |
| ADMIN-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 60 total
- Mapped to phases: 60
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-06*
*Last updated: 2026-03-06 after initial definition*
