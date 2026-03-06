---
phase: 3-live-auction-core
plan: 02
type: execute
wave: 2
depends_on: ["3-live-auction-core-01"]
files_modified:
  - src/actions/auction.ts
  - src/components/admin/LiveAuctionController.tsx
  - src/components/captain/page.tsx
  - src/components/admin/PlayerCard.tsx
autonomous: true
requirements: [RULE-02, FLOW-01, FLOW-02, FLOW-03, FLOW-04, FLOW-05, DISPLAY-03, DISPLAY-04, DISPLAY-05]
must_haves:
  truths:
    - "Admin can deploy player to auction and player details displayed to captains"
    - "Player details (name, height, handy, type, earlier seasons, achievements, age, category) displayed prominently"
    - "Base price of current player visible to all participants"
    - "When timer expires with no bids, admin can choose to 'keep unsold' or 're-auction player'"
    - "When timer expires with bids, admin can 'confirm sale' or 'modify bid/team before finalizing'"
    - "Bid increments of 25,000 are applied correctly"
    - "Captain dashboard clears screen between players and shows purchase details when sold/unsold"
  artifacts:
    - path: "src/components/admin/LiveAuctionController.tsx"
      provides: "Admin auction flow controls (deploy, expiry handling, sale confirmation)"
      contains: "deployPlayer|keepUnsold|confirmSale"
    - path: "src/components/admin/PlayerCard.tsx"
      provides: "Player detail display component"
      contains: "PlayerCard"
    - path: "src/actions/auction.ts"
      provides: "Server actions for auction flow operations"
      exports: ["deployPlayer", "markPlayerUnsold", "finalizeSale"]
  key_links:
    - from: "src/components/admin/LiveAuctionController.tsx"
      to: "src/actions/auction.ts"
      via: "Server action calls for deploy/sale operations"
      pattern: "deployPlayer|keepUnsold|confirmSale"
    - from: "src/components/admin/LiveAuctionController.tsx"
      to: "src/components/admin/PlayerCard.tsx"
      via: "Component import for player display"
      pattern: "PlayerCard"
    - from: "src/components/captain/page.tsx"
      to: "auction_state table"
      via: "Realtime subscription for current player"
      pattern: "useRealtime.*auction_state"
---

<objective>
Implement auction flow orchestration including player deployment, timer expiry handling, and sale confirmation with bid increment enforcement.

Purpose: Enable complete auction lifecycle from player deployment to sale finalization, with proper state transitions and visual feedback to both admin and captains.

Output: Updated auction actions with deploy/unsold/sale logic, enhanced Admin Live Controller with flow controls, PlayerCard component for detail display, Captain dashboard with auction state visibility.
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/research/ARCHITECTURE.md

# Existing auction state table with timer columns from Plan 01
# Bid increment of 25,000 per bid (RULE-02)
# Player details to display: name, height, handy, type, earlier seasons, achievements, age, category
</context>

<tasks>

<task type="auto">
  <name>task 1: Create auction flow server actions</name>
  <files>src/actions/auction.ts</files>
  <action>
Extend src/actions/auction.ts with auction flow operations:

deployPlayer(playerId: string):
- Validate player exists and is eligible (not sold, not captain)
- Update auction_state table:
  - current_player_id = playerId
  - current_base_price = player.base_price
  - current_bid_amount = player.base_price
  - bid_count = 0
  - status = 'waiting_for_first_bid'
- Call start_auction_timer RPC with first_bid_timer_seconds
- Revalidate admin and captain pages

markPlayerUnsold(playerId: string):
- Update players table: is_sold = FALSE (explicitly set)
- Update auction_state: status = 'idle', current_player_id = NULL, current_bid_amount = NULL
- Clear current player's bid history (optional or keep in separate logs table)
- Revalidate admin and captain pages

finalizeSale(playerId: string, teamId: string, bidAmount: number):
- Validate bid amount matches current_bid_amount from auction_state
- Update players table:
  - is_sold = TRUE
  - sold_to_team_id = teamId
  - sold_price = bidAmount
- Update auction_rules table:
  - current_purse = current_purse - bidAmount for teamId
- Update auction_state:
  - status = 'idle'
  - current_player_id = NULL
  - current_bid_amount = NULL
- Create auction_log entry (deferred to Phase 5 for full logging)
- Revalidate admin and captain pages

All actions should use Zod validation and handle errors with descriptive messages.
</action>
  <verify>
grep -r "export.*deployPlayer\|export.*markPlayerUnsold\|export.*finalizeSale" src/actions/auction.ts
</verify>
  <done>Server actions for deploy, unsold, and sale finalization created</done>
</task>

<task type="auto">
  <name>task 2: Create PlayerCard component for detailed display</name>
  <files>src/components/admin/PlayerCard.tsx</files>
  <action>
Create src/components/admin/PlayerCard.tsx component:

Props:
- player: Player object with all fields
- basePrice: number (current base price from auction_state)

Display layout (prominent, large text for captains):
- Player Name (largest, bold)
- Category badge (A+, A, B, C, F with color coding)
- Base Price (large, highlighted)
- Age (in years)
- Height (cm)
- Handy (Left/Right)
- Type (Bowler, Batsman, All-rounder, Wicket-keeper)
- Earlier Seasons (list of years or teams)
- Achievements (bullet list or comma-separated)
- Special Remarks (if any)

Styling:
- Use Tailwind for responsive grid layout
- Category badges: A+ (red), A (orange), B (yellow), C (green), F (purple)
- Large, readable fonts for mobile captain view
- Card with subtle shadow and hover effect

This component will be used in both:
1. Admin Live Controller (full details visible)
2. Captain Dashboard (full details visible via Realtime subscription)

Reference existing player display patterns from Phase 1 and 2.
</action>
  <verify>
grep -r "export.*PlayerCard" src/components/admin/PlayerCard.tsx
grep -r "name\|category\|age\|height\|handy\|type\|achievements" src/components/admin/PlayerCard.tsx
</verify>
  <done>PlayerCard component created with all player details displayed prominently</done>
</task>

<task type="auto">
  <name>task 3: Update Admin Live Controller with auction flow controls</name>
  <files>src/components/admin/LiveAuctionController.tsx</files>
  <action>
Update src/components/admin/LiveAuctionController.tsx:

1. Player Deployment:
   - Add "Deploy Player" button in existing player search section
   - On click, call deployPlayer(playerId) action
   - Show confirmation dialog before deployment
   - After deployment, show PlayerCard with current player details
   - Start timer automatically via startTimer() from Plan 01

2. Timer Expiry Handling (detect when totalSeconds reaches 0):
   - Fetch current bids for player
   - If bid_count = 0 (no bids):
     - Show modal/dialog: "No bids received. Keep player unsold or Re-auction?"
     - Buttons: "Keep Unsold" (calls markPlayerUnsold), "Re-auction" (restarts timer with same player)
   - If bid_count > 0 (bids exist):
     - Show modal/dialog: "Auction completed. Current top bid: ₹X by Team Y"
     - Display top bidder info and amount
     - Buttons: "Confirm Sale" (calls finalizeSale), "Modify Bid/Team" (opens edit modal for admin to adjust)

3. Sale Confirmation (from modify flow):
   - Allow admin to change team or adjust bid amount
   - Show warning if bid amount modified from actual bid
   - On confirm, call finalizeSale with modified values

4. Auction Status Display:
   - Show current state: "Idle", "Waiting for first bid", "Bidding", "Paused"
   - Show base price prominently: "Base Price: ₹X,XX,XXX"
   - Enforce bid increment: Display "Next valid bid: ₹{current_bid + 25000}"

5. Captain Dashboard Integration:
   - Ensure current_player_id is published via Realtime
   - Captain dashboard subscribes and shows PlayerCard when current_player_id exists
   - When status = 'idle', captain dashboard shows blank screen (DISPLAY-04)
   - When player sold/unsold, show purchase details briefly (DISPLAY-03)

Timer expiry detection:
- Use useEffect to monitor totalSeconds from useTimer hook
- When totalSeconds === 0, trigger expiry handling logic
- Show appropriate modal based on bid presence
</action>
  <verify>
grep -r "deployPlayer\|markPlayerUnsold\|finalizeSale" src/components/admin/LiveAuctionController.tsx
grep -r "PlayerCard" src/components/admin/LiveAuctionController.tsx
grep -r "totalSeconds === 0\|timer.*expiry" src/components/admin/LiveAuctionController.tsx
</verify>
  <done>Admin Live Controller updated with full auction flow controls and expiry handling</done>
</task>

<task type="auto">
  <name>task 4: Update Captain Dashboard with auction state display</name>
  <files>src/components/captain/page.tsx</files>
  <action>
Update src/components/captain/page.tsx:

1. Subscribe to auction_state table via Supabase Realtime:
   - Watch for changes to current_player_id, current_bid_amount, base_price, status
   - Update local state on changes

2. Display Logic:
   - If status = 'idle' or current_player_id is NULL:
     - Show blank screen (DISPLAY-04)
     - Display "Waiting for player to be deployed..."
   - If current_player_id exists:
     - Fetch player details via Supabase query
     - Render PlayerCard component with all details (DISPLAY-02)
     - Show base price prominently (DISPLAY-05)

3. Sold/Unsold Feedback (DISPLAY-03):
   - Watch for status change from 'bidding' to 'idle'
   - If previous player had bids and now idle (sold):
     - Show "SOLD to [Team Name] for ₹X,XX,XXX" message prominently
     - Keep display for 3 seconds, then clear screen
   - If previous player had no bids and now idle (unsold):
     - Show "UNSOLD - [Player Name]" message prominently
     - Keep display for 3 seconds, then clear screen

4. Timer Display:
   - Show countdown timer synced from auction_state
   - Format as "Time remaining: MM:SS"
   - Red color when < 10 seconds, orange when < 20 seconds, green otherwise

5. Bid Increment Info:
   - Display "Next bid: ₹{current_bid + 25000}" if bids exist
   - Display "Starting bid: ₹{base_price}" if no bids yet

Ensure captain dashboard is read-only for auction state (only admin can deploy/sell).
</action>
  <verify>
grep -r "auction_state\|current_player_id\|PlayerCard" src/components/captain/page.tsx
grep -r "SOLD\|UNSOLD" src/components/captain/page.tsx
</verify>
  <done>Captain dashboard updated with auction state display and feedback</done>
</task>

</tasks>

<verification>
1. deployPlayer action sets current_player_id and starts timer correctly
2. markPlayerUnsold action clears current player and resets state
3. finalizeSale action updates player and team correctly
4. PlayerCard displays all player details prominently
5. Timer expiry shows correct modal (unsold options if no bids, sale confirmation if bids exist)
6. Captain dashboard shows PlayerCard when player deployed
7. Captain dashboard clears screen when idle and shows purchase details after sale/unsold
8. Base price displayed prominently to all participants
9. Bid increment of 25,000 enforced and displayed correctly
</verification>

<success_criteria>
1. Admin can deploy players to auction and player details (name, height, handy, type, earlier seasons, achievements, age, category) are displayed prominently to captains
2. Base price of current player is visible to all participants, and bid increments of 25,000 are applied correctly
3. When first timer expires with no bids, admin can choose to "keep unsold" or "re-auction player", and action is executed correctly
4. When timer expires with bids, admin can "confirm sale" or "modify bid/team before finalizing", and sale is recorded correctly
5. Captain dashboard clears screen between players, shows purchase details when sold/unsold, and remains blank until next player deployed
</success_criteria>

<output>
After completion, create `.planning/phases/phase-3/3-live-auction-core-02-SUMMARY.md`
</output>
