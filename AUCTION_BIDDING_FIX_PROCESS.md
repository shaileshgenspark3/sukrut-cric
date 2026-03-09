# Auction Bidding Fix Process

Date: 2026-03-09
Project: `sukrut-cric`

## 1) Original issue reported
The reported production issue was:
- Deploying a player from Admin Live Controller worked.
- The deployed player appeared on the dashboard.
- But when a captain placed a bid, that bid did not appear in the dashboard Top 3.
- The live bidding process also did not advance as expected.

## 2) Investigation summary
I traced the auction flow through these areas:
- Admin deploy flow
- Captain bidding flow
- Dashboard Top 3 rendering flow
- Bid history / realtime hooks
- Auction timer flow
- Sale / re-auction flow

Primary files inspected during analysis included:
- `app/admin/page.tsx`
- `app/captain/page.tsx`
- `app/dashboard/page.tsx`
- `app/page.tsx`
- `hooks/useBids.ts`
- `hooks/useRealtime.ts`
- `hooks/useTimer.ts`
- `lib/actions/auction.ts`
- `lib/actions/bids.ts`
- `lib/actions/timer.ts`
- `lib/validation/bidValidation.ts`
- `components/admin/PlayerCard.tsx`
- `components/admin/BidHistory.tsx`
- `supabase/migrations/20260305031951_init_schema.sql`
- `supabase/migrations/20260306000005_timer_management.sql`

## 3) End-to-end auction flow understood from code
### Deploy flow
1. Admin Live Controller calls `deployPlayer(...)`.
2. `auction_state` is updated with the current player and live auction fields.
3. Timer is started.
4. Captain/Admin/Dashboard pages react through React Query + Supabase Realtime.

### Bid flow
1. Captain page reads the current auction state.
2. Captain UI computes the next bid and calls `placeBidWithValidation(...)`.
3. Server validates the bid amount and auction state.
4. On success:
   - a row is inserted into `bids`
   - `auction_state` is updated with current bidder / current bid / status / bid_count
   - the UI updates through invalidation and realtime subscriptions

### Dashboard Top 3 flow
1. Dashboard derives current player id from `auction_state`.
2. `useBids(playerId)` loads bids for that player.
3. `topBids = bids.slice(0, 3)` is rendered in the dashboard.

## 4) Root cause diagnosis
The primary root cause was a **partial migration of bid-state logic**.

### Main mismatch
The captain UI was using a legacy calculation pattern:
- `current_bid`
- `bid_increment`

But server validation had moved to the newer live-auction model:
- `current_bid_amount`
- `current_base_price`
- `+ 25000`

This meant the captain UI could send a bid amount different from what the server expected.
When that happened:
- the server rejected the bid
- no row was inserted into `bids`
- dashboard Top 3 stayed empty
- auction state did not advance

### Secondary gap
Even once a bid was accepted, the timer logic was incomplete:
- accepted bids were not resetting the timer to `subsequent_bid_timer_seconds`

### Source-of-truth drift
Timer settings were also split across different places:
- some code paths used `tournament_settings`
- timer management logic used `auction_state`

## 5) Architect recommendations / executor handoff
The implementation handoff given to the executor was:
1. Unify bid calculation everywhere.
2. Fix captain first-bid submission.
3. Reset timer after accepted bids using `subsequent_bid_timer_seconds`.
4. Align deploy/re-auction timer settings with the same timer source used by live timer management.
5. Show visible captain-facing errors on failed bids.
6. Verify the flow.

## 6) Implementation summary
An executor agent completed the main fix.

### Files changed
- `lib/services/auction/bidMath.ts` (new)
- `lib/actions/bids.ts`
- `lib/actions/auction.ts`
- `app/captain/page.tsx`
- `app/admin/page.tsx`
- `components/admin/PlayerCard.tsx`
- `app/page.tsx`

### Main implementation changes
#### A. Shared bid helper added
New shared helper file:
- `lib/services/auction/bidMath.ts`

It introduced a single canonical live-bid calculation:
- current live amount = `current_bid_amount ?? current_base_price ?? current_bid ?? 0`
- next bid = live amount + `₹25,000`

#### B. Captain UI aligned with server validation
The captain page now uses the shared helper for:
- current live amount
- next bid amount

This removed the stale `current_bid + bid_increment` path.

#### C. Server bid validation aligned with shared math
`lib/actions/bids.ts` now validates against the same helper the captain UI uses.

#### D. Accepted bids now reset the timer
Successful bids now also update the timer so bidding continues properly with the subsequent-bid timer.

#### E. Deploy and re-auction now use `auction_state` timer settings
Timer source-of-truth was aligned around `auction_state`, matching the existing timer management hook and timer actions.

#### F. Captain error feedback added
Captain page now shows a visible error if a bid fails instead of silently doing nothing.

#### G. Public/admin live bid displays aligned
Relevant live bid displays were updated to use the same live-bid math.

## 7) Verification summary
### Static verification completed
- TypeScript / diagnostics on modified files: passed with 0 errors
- Project diagnostics: 0 errors / 0 warnings

### Limitations of verification environment
- No app-level automated tests were present in the repo
- Full `next build` could not be run in the shell because `node` / `npx` were missing in the environment

## 8) Manual testing checklist
### Setup
Open these simultaneously:
- `/admin`
- `/dashboard`
- `/captain` for at least 2 captains
- optional: `/`

Pick a player with a known base price.

### Test 1 — Deploy flow
1. Deploy a player from Admin Live Controller.
2. Verify:
   - Admin shows the player on block
   - Dashboard shows the same player
   - Captain page shows current valuation = base price
   - Captain page shows next bid = base price + ₹25,000
   - Public landing page shows the live bid = base price

### Test 2 — First bid flow
1. From Captain A, place the first bid.
2. Verify:
   - current valuation updates
   - Admin Live Bids updates
   - Dashboard Top 3 updates
   - `current_bidder` changes to Captain A’s team
   - `bid_count` becomes 1
   - status becomes `bidding`

### Test 3 — Subsequent bid flow
1. From Captain B, place the next bid.
2. Verify:
   - bid increases by another ₹25,000
   - highest bidder changes
   - Top 3 reorders correctly
   - Admin bid history updates correctly

### Test 4 — Timer behavior
1. In Admin, set:
   - first bid timer = e.g. 20 sec
   - subsequent bid timer = e.g. 10 sec
2. Deploy a fresh player.
3. Verify the first countdown starts around 20 sec.
4. Place a bid.
5. Verify timer resets to around 10 sec.
6. Place another bid.
7. Verify timer resets again to around 10 sec.

### Test 5 — Error feedback
Try a failing case and confirm the captain sees a visible error message.
Easy check:
- open 2 tabs for the same captain
- bid from one tab
- then bid from the stale tab
Expected:
- a visible failure message near the bid button

### Test 6 — Re-auction flow
1. Get bids on a player.
2. Re-auction the same player.
3. Verify:
   - current bidder is cleared
   - bid count resets to 0
   - current bid resets to base price
   - first-bid timer starts again

### Test 7 — Public page consistency
On `/`, verify:
- after deploy: live bid = base price
- after bids: live bid updates to current highest bid

### Test 8 — Simultaneous bid smoke test
Optional but important:
- have 2 captains click bid nearly simultaneously
- watch for duplicate same-step bids or wrong highest bidder

## 9) Post-implementation code review findings
A follow-up code review found the main requested feature to be implemented, but identified several remaining risks.

### [HIGH] Simultaneous bid race risk remains
`lib/actions/bids.ts` still performs:
1. read auction_state
2. compute expected bid
3. insert bid
4. update auction_state

Two near-simultaneous requests can still validate against the same old state before the update lands.

Recommended fix:
- move validation + insert + auction_state update + timer reset into a single DB transaction / RPC
- ideally lock the `auction_state` row during bid acceptance

### [MEDIUM] Admin timer modal can overwrite typed edits
The admin timer settings modal syncs local form state from live `auction_state` updates.
If realtime refresh happens while the admin is editing, typed values may be overwritten.

Recommended fix:
- only initialize timer modal state when the modal opens
- or avoid syncing while the modal is actively being edited

### [LOW] Base price may be labeled as “Current Bid” before first bid
Because deploy now initializes current bid fields to the base price, some UI labels can show “Current Bid” before any actual bid has been placed.

Recommended fix:
- base the label on `bid_count > 0` or `current_bidder_team_id != null`

### Additional follow-up risk noted during architect review
There is also a re-auction / stale-history concern:
- re-auction resets live auction state
- but bid history is still keyed by `player_id`
- older bids may bleed into a re-auctioned player’s Top 3/history flow unless auction attempts are separated or bids are cleared/archived per round

## 10) Remaining risks / follow-up recommendations
### Recommended Phase 2 work
1. **Fix simultaneous bid race condition**
   - highest priority
   - should be handled at DB transaction / RPC level

2. **Handle re-auction bid-history isolation**
   - separate auction attempts / rounds
   - or archive/clear old bids when re-auctioning the same player

3. **Stabilize Admin timer settings modal UX**
   - prevent realtime refresh from overwriting in-progress edits

4. **Tidy pre-bid labeling**
   - show “Base Price” until the first actual bid exists

## 11) Final status
### Implemented
- primary auction bidding bug fixed
- captain/server bid math aligned
- accepted bids now advance state and reset timer
- visible captain error feedback added
- timer source-of-truth aligned around `auction_state`

### Still recommended before fully trusting live auction at scale
- race-condition hardening
- re-auction / stale-bid isolation

