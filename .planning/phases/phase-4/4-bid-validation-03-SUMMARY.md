---
phase: 4-bid-validation
plan: 03
subsystem: Cooldown & Admin Ban Controls
tags: [cooldown, ban, team-control, auction-flow]
dependency_graph:
  requires:
    - Phase 4 Plan 02 (Category Limits)
  provides:
    - 3-second bid cooldown enforcement
    - Team ban management
    - Auto-clear bans on sale/unsold
  affects:
    - Bid placement flow
    - Admin Live Controller
    - Auction state management
tech_stack:
  added:
    - lib/actions/admin.ts (new)
    - supabase/migrations/20260306_banned_teams.sql
  patterns:
    - Server-side cooldown check
    - JSONB column for banned teams storage
    - Auto-clear bans on state transitions
key_files:
  created:
    - lib/actions/admin.ts (200+ lines)
    - supabase/migrations/20260306_banned_teams.sql
  modified:
    - lib/actions/bids.ts (+ban check)
    - lib/actions/auction.ts (+clear bans)
    - app/admin/page.tsx (+ban UI)
decisions:
  - "Using JSONB banned_teams column in auction_state"
  - "Cooldown enforced before ban check"
  - "Bans auto-clear when player sold or unsold"
  - "Shield icon for ban/unban toggle"
metrics:
  duration: ~15 minutes
  completed: 2026-03-06
  tasks_completed: 4/4
---

# Phase 4 Plan 3: Cooldown & Admin Ban Controls Summary

## Objective

Implement bid cooldown enforcement and admin team banning functionality. Prevent bid spam with 3-second cooldown server-side and allow admins to temporarily ban teams from bidding on current player.

## What Was Built

### 1. Server-Side Cooldown Enforcement

Already implemented in Plan 01 (lib/actions/bids.ts):

- **checkCooldown(teamId, playerId)**:
  - Queries bids table for last bid by team on player
  - Returns false if bid within last 3 seconds
  - Returns remaining seconds if on cooldown

- **Cooldown in placeBidWithValidation**:
  - Called first in validation chain
  - Blocks rapid bids with descriptive message
  - "Please wait X second(s) before placing another bid"

### 2. Team Ban Functionality (lib/actions/admin.ts)

Created comprehensive ban management:

- **banTeamFromBidding(teamId, playerId, reason?)**:
  - Adds team to banned_teams array in auction_state
  - Stores teamId, playerId, reason, and bannedAt timestamp
  - Checks if already banned to prevent duplicates
  - Returns success/error message

- **unbanTeam(teamId, playerId)**:
  - Removes team from banned_teams array
  - Returns success/error message

- **getBannedTeams(playerId?)**:
  - Gets all banned teams or filtered by playerId
  - Joins with teams table to get team names
  - Returns array with teamId, teamName, reason, bannedAt

- **clearBansForPlayer(playerId)**:
  - Removes all bans for specific player
  - Called automatically on sale/unsold

- **isTeamBanned(teamId, playerId)**:
  - Checks if team is currently banned for player
  - Used in bid validation

### 3. Database Migration

Created supabase/migrations/20260306_banned_teams.sql:

- Added `banned_teams JSONB` column to auction_state
- Default value: empty array `[]::jsonb`
- Comment: "Array of banned team IDs with reasons for current player"
- Format: `[{teamId, playerId, reason, bannedAt}]`

### 4. Admin Live Controller UI Updates

Updated app/admin/page.tsx with ban controls:

- **Banned Teams State**:
  - Fetches banned teams for current player
  - Updates when player changes

- **Ban/Unban Buttons**:
  - Shield icon button next to each team
  - Confirmation dialog before banning
  - Instant unban (no confirmation)

- **Banned Team Indicators**:
  - Red background for banned teams
  - "BANNED" badge displayed
  - Team shows ineligible status

- **Ban Checking**:
  - `isTeamBanned(teamId)` helper function
  - Used in team list rendering

### 5. Auto-Clear Bans on Sale/Unsold

Updated lib/actions/auction.ts:

- **finalizeSale (updated)**:
  - After recording sale, calls `clearBansForPlayer(playerId)`
  - Bans cleared before state reset

- **markPlayerUnsold (updated)**:
  - After marking unsold, calls `clearBansForPlayer(playerId)`
  - Bans cleared before state reset

### 6. Bid Validation with Ban Check

Updated lib/actions/bids.ts:

- **placeBidWithValidation (updated)**:
  - Checks cooldown first
  - **NEW**: Checks if team is banned
  - Returns error if banned: "Your team has been temporarily banned from bidding on this player"

## Success Criteria Met

✅ 3-second cooldown enforced server-side after each bid, captain cannot bid again for 3 seconds

✅ Admin can ban specific teams from bidding on current player, ban is temporary (clears after player sold/unsold)

## Verification

✅ Build passes without errors  
✅ Cooldown blocks rapid bids  
✅ Admin can ban teams with confirmation  
✅ Ban status displayed clearly  
✅ Teams can be unbanned instantly  
✅ Bans auto-clear on sale/unsold  
✅ Bid validation includes ban check  

## Files Created

- `lib/actions/admin.ts` - Ban/unban team functionality
- `supabase/migrations/20260306_banned_teams.sql` - Database schema for banned teams

## Files Modified

- `lib/actions/bids.ts` - Added ban check to bid validation
- `lib/actions/auction.ts` - Added clearBansForPlayer calls
- `app/admin/page.tsx` - Added ban UI controls
