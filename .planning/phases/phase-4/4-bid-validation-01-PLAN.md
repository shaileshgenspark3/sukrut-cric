---
phase: 4-bid-validation
plan: 01
type: execute
wave: 1
depends_on: ["3-live-auction-core-03"]
files_modified:
  - lib/validation/bidValidation.ts
  - lib/actions/bids.ts
  - hooks/useBids.ts
  - app/captain/page.tsx
autonomous: true
requirements: [RULE-05, VALID-01, VALID-02, VALID-06, ADMIN-02]
must_haves:
  truths:
    - "Max bid calculated using formula: Remaining purse - (Category base prices for unfilled roster slots) + Current player category base price"
    - "Captain receives red alert when bid exceeds max bid"
    - "Bids are rejected server-side if max bid exceeded or purse insufficient"
  artifacts:
    - path: "lib/validation/bidValidation.ts"
      provides: "Max bid calculation and validation logic"
      contains: "calculateMaxBid|validateBid"
    - path: "lib/actions/bids.ts"
      provides: "Server action for placing bids with validation"
      exports: ["placeBidWithValidation"]
---

<objective>
Implement max bid calculation and server-side bid validation to prevent invalid bids.

Purpose: Calculate the maximum amount a team can bid based on their remaining purse and unfilled roster slots. Validate all bids server-side before accepting.

Output: bidValidation.ts with calculation logic, updated bid placement with validation, captain UI showing max bid alerts.
</objective>

<tasks>

<task type="auto">
  <name>task 1: Create bid validation logic</name>
  <files>lib/validation/bidValidation.ts</files>
  <action>
Create lib/validation/bidValidation.ts:

1. calculateMaxBid(teamId, playerCategory, roster, settings):
   - Get team's current purse from auction_rules
   - Count current roster by gender and category
   - Calculate remaining slots: max_male_players - current_male, max_female_players - current_female
   - Calculate required purse for unfilled slots:
     - For each unfilled male slot: use max of (actual purchase price or category base price)
     - For each unfilled female slot: use F category base price (50000)
   - Formula: maxBid = currentPurse - requiredPurseForUnfilled + playerCategoryBasePrice
   - Return maxBid (can be negative if insufficient)

2. validateBid(teamId, playerId, bidAmount):
   - Get team info and player info
   - Calculate max bid using calculateMaxBid
   - Check if bidAmount <= maxBid
   - Check if team has sufficient purse
   - Return { valid: boolean, maxBid: number, reason?: string }

3. getCategoryBasePrices():
   - Return: A+=500000, A=200000, B=100000, F=50000

4. getRosterStatus(teamId):
   - Return current counts: male_count, female_count, category_breakdown
   - Return available slots per category
</action>
  <verify>
grep -r "calculateMaxBid\|validateBid" lib/validation/bidValidation.ts
</verify>
  <done>Bid validation logic created</done>
</task>

<task type="auto">
  <name>task 2: Create bid placement action with validation</name>
  <files>lib/actions/bids.ts</files>
  <action>
Create lib/actions/bids.ts:

1. placeBidWithValidation(playerId, teamId, bidAmount):
   - Call validateBid(teamId, playerId, bidAmount)
   - If invalid, throw error with reason
   - Check 3-second cooldown (from VALID-06)
   - Insert bid into bids table
   - Update auction_state: current_bid, current_bidder_team_id
   - Return success or error

2. checkCooldown(teamId):
   - Get last bid for this player by team
   - If created_at > now - 3 seconds, reject

3. getTeamEligibility(teamId, playerId):
   - Return { canBid: boolean, maxBid: number, reasons: string[] }
</action>
  <verify>
grep -r "placeBidWithValidation\|checkCooldown" lib/actions/bids.ts
</verify>
  <done>Bid placement with validation created</done>
</task>

<task type="auto">
  <name>task 3: Update Captain Dashboard with max bid display</name>
  <files>app/captain/page.tsx</files>
  <action>
Update Captain Dashboard:

1. Fetch max bid calculation on each player:
   - Use calculateMaxBid to get team's max bid
   - Display "Max Bid: ₹X" prominently

2. Show red alert when bid would exceed max:
   - If nextBid > maxBid, show warning
   - Disable bid button
   - Show "Insufficient funds for this bid" message

3. Show category limit warnings:
   - If team at max for player's gender, show warning

4. Real-time update of max bid as other teams bid:
   - Recalculate when bids change
</action>
  <verify>
grep -r "maxBid\|calculateMaxBid" app/captain/page.tsx
</verify>
  <done>Captain dashboard updated with max bid display</done>
</task>

</tasks>

<verification>
1. Max bid formula correctly calculated
2. Captain sees max bid limit
3. Bid rejected when exceeds max
4. Bid rejected when purse insufficient
</verification>

<success_criteria>
1. Max bid calculated using formula: Remaining purse - (Category base prices for unfilled roster slots) + Current player category base price
2. Captain receives red alert when bid exceeds max bid and bid is rejected
3. Bids rejected server-side if max bid exceeded or purse insufficient
</success_criteria>
