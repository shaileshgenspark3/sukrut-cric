---
phase: 4-bid-validation
plan: 03
type: execute
wave: 3
depends_on: ["4-bid-validation-02"]
files_modified:
  - lib/actions/bids.ts
  - lib/actions/admin.ts
  - app/admin/page.tsx
  - supabase/migrations/
autonomous: true
requirements: [VALID-06, ADMIN-04]
must_haves:
  truths:
    - "3-second cooldown enforced server-side after each bid"
    - "Admin can ban specific teams from bidding on current player"
    - "Ban clears after player sold/unsold"
  artifacts:
    - path: "lib/actions/admin.ts"
      provides: "Team ban management"
      exports: ["banTeamFromBidding|unbanTeam|getBannedTeams"]
    - path: "app/admin/page.tsx"
      provides: "Ban team UI controls"
      contains: "ban.*team|unban"
---

<objective>
Implement bid cooldown enforcement and admin team banning functionality.

Purpose: Prevent bid spam with 3-second cooldown server-side. Allow admins to temporarily ban teams from bidding on the current player.

Output: Updated bid actions with cooldown, admin UI for banning teams, ban clearing on player sale/unsold.
</objective>

<context>
@.planning/ROADMAP.md
@.planning/STATE.md
# Cooldown: 3 seconds between bids by same team on same player
# Ban: Temporary, clears when player sold or unsold
</context>

<tasks>

<task type="auto">
  <name>task 1: Add server-side cooldown enforcement</name>
  <files>lib/actions/bids.ts</files>
  <action>
Extend lib/actions/bids.ts:

1. checkCooldown(teamId, playerId):
   - Query bids table for last bid by team on player
   - If bid exists within last 3 seconds, return false
   - Otherwise return true

2. validateBid (update):
   - Add cooldown check
   - If on cooldown, throw: "Please wait X seconds before bidding again"

3. PlaceBidWithValidation (update):
   - Check cooldown first
   - Reject if on cooldown
</action>
  <verify>
grep -r "cooldown\|3.*second" lib/actions/bids.ts
</verify>
  <done>Cooldown enforcement added</done>
</task>

<task type="auto">
  <name>task 2: Create ban team functionality</name>
  <files>lib/actions/admin.ts</files>
  <action>
Create lib/actions/admin.ts:

1. banTeamFromBidding(teamId, playerId, reason?):
   - Add row to auction_state.banned_teams array
   - Or create separate banned_teams table
   - Store: team_id, player_id, banned_at, reason

2. unbanTeam(teamId, playerId):
   - Remove from banned list

3. getBannedTeams(playerId?):
   - Get all banned teams for current player
   - Return team details

4. clearBansForPlayer(playerId):
   - Called when player sold/unsold
   - Clear all bans for that player

5. isTeamBanned(teamId, playerId):
   - Check if team is banned for player
   - Return boolean
</action>
  <verify>
grep -r "banTeam\|unbanTeam\|isTeamBanned" lib/actions/admin.ts
</verify>
  <done>Ban team functionality created</done>
</task>

<task type="auto">
  <name>task 3: Add ban UI to Admin Live Controller</name>
  <files>app/admin/page.tsx</files>
  <action>
Update Admin Live Controller:

1. Team list panel:
   - Show ban button next to each team
   - Click to toggle ban

2. Banned teams indicator:
   - Show icon/styling for banned teams
   - "BANNED" label

3. Ban modal:
   - Confirm before banning
   - Optional reason field

4. Auto-clear bans:
   - When player marked sold/unsold
   - Clear all bans for that player
</action>
  <verify>
grep -r "banTeam\|unbanTeam" app/admin/page.tsx
</verify>
  <done>Ban UI added to Admin</done>
</task>

<task type="auto">
  <name>task 4: Ensure bans clear on sale/unsold</name>
  <files>lib/actions/auction.ts</files>
  <action>
Update auction.ts finalizeSale and markPlayerUnsold:

1. finalizeSale (update):
   - After recording sale, call clearBansForPlayer(playerId)

2. markPlayerUnsold (update):
   - After marking unsold, call clearBansForPlayer(playerId)
</action>
  <verify>
grep -r "clearBansForPlayer" lib/actions/auction.ts
</verify>
  <done>Bans auto-clear implemented</done>
</task>

</tasks>

<verification>
1. 3-second cooldown blocks rapid bids
2. Admin can ban teams
3. Bans clear when player sold/unsold
4. Captain sees cooldown message
</verification>

<success_criteria>
1. 3-second cooldown enforced server-side after each bid, captain cannot bid again for 3 seconds
2. Admin can ban specific teams from bidding on current player, ban is temporary (clears after player sold/unsold)
</success_criteria>
