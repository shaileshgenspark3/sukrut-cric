# Pitfalls Research

**Domain:** Real-time Cricket Auction System
**Researched:** 2026-03-06
**Confidence:** MEDIUM

## Critical Pitfalls

### Pitfall 1: Race Condition on Simultaneous Bids

**What goes wrong:**
Multiple captains submit bids within milliseconds of each other, causing the database to accept multiple bids for the same auction state. Two or more teams think they're the highest bidder, leading to disputes when the system only honors the first commit.

**Why it happens:**
Supabase Postgres Changes has inherent latency. The `useRealtimeSubscription` hook invalidates queries on ANY change, but there's no transactional guarantee between reading current state and submitting a bid. Network delays + database transaction processing time = race window.

**How to avoid:**
Implement server-side bid validation with `SELECT FOR UPDATE` locking on the auction_state row. Require bid transactions to include the current_bid as an optimistic concurrency token. Only accept bid if `current_bid == provided_current_bid`.

**Warning signs:**
- Captains report "I won the bid but the system showed someone else"
- Bid history shows two bids with the same timestamp
- Auction state shows inconsistent current_bid vs actual bid records
- Multiple teams receive "You are highest bidder" notification simultaneously

**Phase to address:**
Phase: Live Auction Core - Real-time synchronization

---

### Pitfall 2: Timer Desynchronization During Pause/Resume

**What goes wrong:**
Admin pauses the auction (e.g., for dispute), but some clients continue counting down their local timer. When auction resumes, different clients show different remaining times, causing confusion about when bidding ends. Some captains place bids after the "real" timer expired, leading to disputes.

**Why it happens:**
Timer logic is implemented client-side using `setInterval` that doesn't account for pause/resume state. Supabase realtime updates for `is_auction_live` arrive at different times on different clients due to network latency. Local clock drift exacerbates the issue.

**How to avoid:**
Store timer expiration timestamp (server time) in the `auction_state` table, not just duration. Use `timer_expiry` timestamp that clients sync to, then calculate local countdown. Pause functionality should update `timer_expiry` by adding elapsed time, not just toggle a boolean flag.

**Warning signs:**
- Captains report "My timer said 5 seconds but the player was sold"
- Admin and captain screens show different remaining times
- Timer jumps ahead/back after pause/resume
- Bids accepted after timer visually expires on some clients

**Phase to address:**
Phase: Timer & State Management

---

### Pitfall 3: Incorrect Max Bid Calculation With Category Limits

**What goes wrong:**
Max bid formula doesn't account for category restrictions correctly. A captain can bid more than their available purse minus required base prices for remaining slots, OR the formula doesn't check if adding this player would exceed category limits (e.g., Male: A+=1, A=3, B=4). Captain places bid thinking they can afford it, but later the system rejects or causes inconsistency.

**Why it happens:**
Complex formula: `Funds available - (Category base prices for remaining roster slots) + Current player category base price` requires joining multiple tables in real-time. Category limits check requires counting current roster by category for each validation. Database joins for validation happen AFTER bid acceptance rather than BEFORE, leading to invalid states.

**How to avoid:**
Implement database-level check constraint or trigger that validates category limits BEFORE accepting a bid. Create materialized view or cached count for team rosters by category to avoid expensive COUNT queries on every bid validation. Calculate max bid server-side via edge function or database function, not client-side.

**Warning signs:**
- Captains can bid on players even after reaching category limits
- System shows "You can bid X" but bid fails with "Max players reached"
- Teams end up with more category players than allowed
- Purse goes negative after sale completes

**Phase to address:**
Phase: Bid Validation & Rules Enforcement

---

### Pitfall 4: Reverse Sale Doesn't Restore Purse Correctly

**What goes wrong:**
Admin reverses a sale (deletes log entry), but purse restoration uses the WRONG base price instead of actual sale price. Or worse, doesn't restore the captain deduction that was applied when captain was assigned. Team's effective purse becomes incorrect, and they can't bid correctly in future auctions.

**Why it happens:**
Reverse logic queries `players.base_price` instead of `players.sold_price` or `bids.bid_amount`. Captain assignment logic is separate from sale logic, so reverse sale doesn't account for the `captain_deduction` that reduced the team's starting purse. No audit trail to verify original sale amount vs restoration amount.

**How to avoid:**
Create a comprehensive `auction_log` table that stores ALL transactions with immutable records: initial purse, captain deduction, each sale (player_id, team_id, amount, timestamp), each reverse (log_entry_id, reason, timestamp). Purse restoration should query the immutable log entry, not current player state. Implement database function `reverse_sale(log_entry_id)` that atomically reverses all related transactions.

**Warning signs:**
- After reverse, team purse doesn't match expected value
- Team roster count is correct but purse seems off
- Manual audit of sales doesn't match team's effective purse
- Teams report "I had X tokens before, reverse sale, now have Y tokens"

**Phase to address:**
Phase: Auction Logging & Data Integrity

---

### Pitfall 5: Sold Player Reappears in Live Auction

**What goes wrong:**
Player is sold and marked `is_sold = true`, but due to race condition or missing validation, the same player can be deployed to auction again. Admin sees "unsold players" but the sold player appears in the list. Multiple teams bid, creating confusion. Or worse, the player is sold twice to different teams.

**Why it happens:**
Live Controller's "available players" query doesn't filter `is_sold = true` AND `sold_to_team_id IS NULL`. Or the `is_sold` flag update and player deployment happen in separate transactions without proper locking. Supabase realtime subscription invalidation timing causes stale player list on admin's screen.

**How to avoid:**
Add database constraint: `CHECK (is_sold = false OR sold_to_team_id IS NULL)` to prevent inconsistency. Create a database trigger that prevents UPDATE on `auction_state.current_player_id` if the player is already sold. Always filter available players with `WHERE is_sold = false AND (sold_to_team_id IS NULL)`.

**Warning signs:**
- Player appears in unsold list but has team assigned
- Same player shows in two different team rosters
- Admin sees duplicate player entries in deploy list
- Bidding on already-sold player succeeds (should fail)

**Phase to address:**
Phase: Player Management & State Consistency

---

### Pitfall 6: CSV Import Corrupts Player Data

**What goes wrong:**
Admin uploads CSV to bulk import players. CSV parsing fails silently on malformed rows (e.g., quoted fields with internal quotes), or wrong column mapping causes data loss (e.g., category column mapped to type field). Some players have missing required fields, others have corrupted category values (A+ becomes A_Plus), breaking auction logic.

**Why it happens:**
PapaParse (library used) has default error handling that skips bad rows without notification. No schema validation before CSV insert. Column mapping is implicit (order-based) rather than explicit (header-based). CSV doesn't define required vs optional fields, so validation is after-the-fact.

**How to avoid:**
Implement CSV validation BEFORE insertion: validate all rows have required columns, parse values against schema types, check enum constraints (category, gender, playing_role). Return preview of parsed data with errors highlighted. Use explicit column mapping by header name, not index. Create CSV template with headers and example data.

**Warning signs:**
- Player count increases after import but some players are missing data
- Category dropdown shows unexpected values (e.g., "A_Plus" instead of "A+")
- Players show "undefined" or empty values in dashboard
- Auction breaks when trying to sell players with invalid category

**Phase to address:**
Phase: Data Import/Export

---

### Pitfall 7: Bid Cooldown Bypass via Rapid Clicks

**What goes wrong:**
System enforces 3-second cooldown between bids to prevent spam. Captain spams the bid button rapidly, and multiple bids get accepted within the cooldown period. Network lag or race condition allows multiple bid submissions before the cooldown enforcement kicks in.

**Why it happens:**
Cooldown is enforced client-side (UI disabled) but not server-side. Multiple bid mutations are fired before the first completes and updates the auction state. Supabase realtime lag means UI doesn't re-enable/disable in time. No database-level rate limiting per team.

**How to avoid:**
Implement server-side bid throttling in database: track `last_bid_time` per team in auction_rules or separate table. Reject bids if `now() - last_bid_time < 3000ms`. Use database trigger to update `last_bid_time` on successful bid. Client-side UI is nice, but server-side is mandatory.

**Warning signs:**
- Bid history shows 2+ bids from same team within 3 seconds
- Timer resets multiple times rapidly from same team
- Captains exploit to flood bids in last seconds
- Bid counter shows inconsistent count vs bid records

**Phase to address:**
Phase: Bid Validation & Rules Enforcement

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Client-side timer countdown only | No server coordination, simple | Desync, race conditions, disputes | Never - this is a core feature |
| Client-side max bid calculation | No database overhead, fast | Inconsistent enforcement, exploits | Never - financial accuracy critical |
| Simple bid table without audit trail | Easy to query, minimal storage | Can't debug disputes, no reverse capability | MVP only, must add audit before production |
| CSV import without preview | Fast bulk import | Data corruption, no rollback | Never - data integrity critical |
| Pause/resume as boolean flag only | Simple state management | Timer drift, client desync | Never - auction fairness depends on accurate timing |
| No database constraints for sold players | Flexible player movement | Sold players can be re-auctioned | Never - auction integrity critical |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase Realtime (Postgres Changes) | Assuming all clients receive updates simultaneously | Realtime has delivery latency; design for eventual consistency. Always validate state server-side before accepting bids |
| Supabase RLS with realtime | Forgetting RLS doesn't apply to realtime subscriptions | Realtime bypasses RLS; implement channel-level authorization or filter client-side |
| TanStack Query invalidation | Invalidating all queries on any change | Be specific: invalidate only relevant query keys (e.g., ['auction_state'] not all keys) |
| PapaParse CSV import | Skipping error handling for malformed rows | Always use complete error handling; validate every row before insertion; show preview with errors |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| COUNT queries on every bid validation | Slow bid acceptance, timeouts during intense bidding | Use materialized view or cached count for team rosters; update triggers instead of COUNT | 10+ teams with active bidding; 5+ seconds per bid validation |
| N+1 query for player details in admin dashboard | Slow page load, lag when switching players | Use Supabase joins (`select('*, team:teams(*)')`) instead of separate queries | 50+ players in catalog; admin dashboard takes >3 seconds |
| Realtime subscription to all tables | High egress quota usage, latency | Subscribe only to tables with frequent changes; query less-changed data periodically | 24 teams × 6 tables = 144 concurrent subscriptions at 60s ping |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Admin can reverse sale without logging | No audit trail for disputes, potential fraud | Require admin to enter reason; store in immutable log table; require confirmation dialog |
| Captain can place bid for other teams | Financial fraud, bid manipulation | Always validate `auth.uid() == teams.captain_user_id` in RLS policy for bid insertion |
| No rate limiting on bid endpoints | Spamming bids, DoS, unfair advantage | Implement database-level throttle using `last_bid_time` per team |
| CSV import bypasses validation | Malicious data injection, system corruption | Validate all rows against schema; reject entire batch if any row fails |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Bid button disabled with no reason | Captain frustrated, doesn't know why can't bid | Show specific reason: "Insufficient tokens", "Max male players reached", "You are highest bidder" |
| Timer countdown but no visual urgency | Captains miss auction end, don't bid in time | Add color change (green → yellow → red) and animation as timer approaches zero |
| Sold player disappears from roster without confirmation | Captain thinks player disappeared due to bug | Show toast: "Player sold to [Team] for ₹X" with undo (if within time window) |
| No warning before approaching category limit | Captain accidentally exceeds limit, causing dispute | Show red alert when at limit-1: "You can only add 1 more [Category] player" |
| Purse updates without clear breakdown | Captain doesn't understand why tokens decreased | Show breakdown: "Starting: 30L - Captain: 5L = 25L - Player: 2L = 23L" |

## "Looks Done But Isn't" Checklist

- [ ] **Bid Cooldown**: Client UI disabled but no server-side validation — Verify database trigger checks `last_bid_time`
- [ ] **Timer Sync**: Client countdown but no server `timer_expiry` timestamp — Verify auction_state has timer_expiry field and clients sync to it
- [ ] **Max Bid Calculation**: Client calculates max bid — Verify server-side function calculates and validates before accepting bid
- [ ] **Category Limits**: UI shows alert but bid still accepted — Verify database constraint rejects bids exceeding limits
- [ ] **Reverse Sale**: UI deletes log entry but no purse restoration — Verify `reverse_sale()` function restores correct amount
- [ ] **CSV Import**: Uploads without preview — Verify parsing shows errors before insertion
- [ ] **Sold Player Filter**: Admin sees all players — Verify available players query filters `is_sold = false`

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Race condition on simultaneous bids | HIGH | 1. Identify disputed bid records 2. Reconstruct timeline from bid timestamps 3. Use server logs to determine actual first commit 4. Manual override auction_state if needed 5. Issue apology to affected captain |
| Timer desynchronization | MEDIUM | 1. Pause auction immediately 2. Force all clients to reload from server state 3. Reset timer using server `timer_expiry` 4. Resume auction 5. Monitor for further drift |
| Incorrect max bid calculation | HIGH | 1. Identify team with incorrect purse 2. Audit all their transactions via log table 3. Calculate correct purse manually 4. Manually adjust via admin panel (with log entry) 5. Communicate to all teams |
| Reverse sale doesn't restore purse | MEDIUM | 1. Identify incorrect log entry 2. Calculate correct restoration amount (use original bid record, not current player state) 3. Manually adjust team purse via admin panel 4. Add audit log entry explaining correction |
| Sold player reappears in auction | HIGH | 1. Immediately pause auction 2. Identify duplicate deployment 3. Manually mark player as sold with correct team 4. If double-sold, work with teams to resolve (prefer later sale) 5. Reverse one sale and restore purse |
| CSV import corrupts data | MEDIUM | 1. Identify corrupted players (unexpected category, missing fields) 2. Delete corrupted records 3. Re-import with corrected CSV using validation preview 4. Verify all players have correct data |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Race condition on simultaneous bids | Phase: Live Auction Core - Server-side bid validation | Load test with 10+ captains bidding simultaneously; verify only one winner |
| Timer desynchronization | Phase: Timer & State Management | Pause auction, resume, verify all clients show same countdown |
| Incorrect max bid calculation | Phase: Bid Validation & Rules Enforcement | Test max bid with various purse states; verify bid rejection at limit |
| Reverse sale doesn't restore purse | Phase: Auction Logging & Data Integrity | Sell player, reverse sale, verify purse matches original |
| Sold player reappears in auction | Phase: Player Management & State Consistency | After sale, attempt to deploy same player; verify it's not available |
| CSV import corrupts data | Phase: Data Import/Export | Upload malformed CSV; verify error preview and rejection |
| Bid cooldown bypass | Phase: Bid Validation & Rules Enforcement | Test rapid clicking; verify only one bid accepted per 3 seconds |

## Sources

- **Supabase Realtime Documentation** - https://supabase.com/docs/guides/realtime (HIGH confidence - official docs)
- **Supabase Realtime Architecture** - https://supabase.com/docs/guides/realtime/architecture (HIGH confidence - official docs)
- **Supabase Postgres Changes** - https://supabase.com/docs/guides/realtime/postgres-changes (HIGH confidence - official docs)
- **Supabase Realtime Limitations** - https://supabase.com/docs/guides/realtime/limits (HIGH confidence - official docs - notes RLS doesn't apply to realtime)
- **Known Issue: Postgres Changes performance** - Single-threaded processing can cause delays at high subscription counts (MEDIUM confidence - from docs)
- **Domain knowledge: Race conditions in auction systems** - Based on analysis of current codebase and common patterns in real-time systems (LOW confidence - no external source, expert inference)
- **Domain knowledge: Timer synchronization challenges** - Based on client-server time sync best practices (LOW confidence - no external source, expert inference)

---
*Pitfalls research for: Real-time Cricket Auction System*
*Researched: 2026-03-06*
