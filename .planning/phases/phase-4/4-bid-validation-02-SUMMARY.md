---
phase: 4-bid-validation
plan: 02
subsystem: Category Limits & Eligibility Display
tags: [category, eligibility, limits, roster]
dependency_graph:
  requires:
    - Phase 4 Plan 01 (Max Bid Calculation)
  provides:
    - Category eligibility checking logic
    - Admin eligibility display
    - Captain category alerts
  affects:
    - Admin Live Controller
    - Captain Dashboard
    - Bid validation flow
tech_stack:
  added:
    - getCategoryLimits function
    - checkCategoryEligibility function
    - getEligibleTeams function
  patterns:
    - Real-time eligibility updates
    - Visual red/green indicators for eligibility
    - Category limit enforcement at bid time
key_files:
  created:
    - lib/validation/bidValidation.ts (+category functions)
  modified:
    - app/admin/page.tsx (+team eligibility display)
    - app/captain/page.tsx (+category alerts)
decisions:
  - "Category limits enforced bid-side before database update"
  - "Visual red background for ineligible teams in admin"
  - "Detailed reason messages displayed to captains"
metrics:
  duration: ~12 minutes
  completed: 2026-03-06
  tasks_completed: 3/3
---

# Phase 4 Plan 2: Category Limits & Eligibility Display Summary

## Objective

Implement category restrictions and team eligibility tracking for bid validation. Enforce team composition rules at bid time and show eligibility status in both Captain and Admin dashboards.

## What Was Built

### 1. Category Eligibility Logic (lib/validation/bidValidation.ts)

Extended bidValidation.ts with:

- **getCategoryLimits()**:
  - Reads category limits from tournament_settings
  - Returns: Male A+=1, A=3, B=4; Female F=2

- **checkCategoryEligibility(teamId, playerCategory, playerGender)**:
  - Checks if adding player would exceed category limits
  - Returns { eligible, currentCount, maxAllowed, reason }
  - Specific reason messages for each limit type

- **getEligibleTeams(playerId)**:
  - For current player, fetches all teams
  - Filters and returns eligibility status for all teams
  - Includes canBid, maxBid, and reasons array

### 2. Admin Live Controller Integration

Updated app/admin/page.tsx with:

- **Team Eligibility Card**:
  - Shows when player is deployed
  - Displays all teams with eligibility status
  - Green badge: "X / Y Eligible" at top

- **Per-Team Display**:
  - Team badge with initials
  - Team name with truncation for long names
  - Red background for ineligible teams
  - Reason message displayed below ineligible teams
  - Max bid amount for each team

- **Real-time Updates**:
  - Recalculates when player changes
  - Updates when bids come in (via auction_state subscription)

### 3. Captain Dashboard Integration

Updated app/captain/page.tsx with:

- **Category Eligibility Checking**:
  - Added checkCategoryEligibility hook call
  - Updates categoryEligibility state on player/bid changes

- **Category Limit Warning**:
  - Red alert box when category limit reached
  - Shows detailed reason message
  - AlertCircle icon for visual emphasis

- **Bid Button Logic**:
  - Disabled when category limit reached
  - Shows category reason as disabled reason
  - Prevents bids that would violate category limits

## Success Criteria Met

✅ Captain receives red alert when category limit reached and bid is rejected

✅ Team is marked RED in Admin Live Controller when ineligible to bid

✅ Admin can view list of eligible teams to bid on current player

## Verification

✅ Build passes without errors  
✅ Category limits enforced at bid time  
✅ Eligibility display shows correct status  
✅ Admin shows ineligible teams with reasons  
✅ Captain sees category warnings with specific reasons  

## Category Limits Enforced

**Male:**
- A+: Maximum 1 player
- A: Maximum 3 players
- B: Maximum 4 players

**Female:**
- F: Maximum 2 players

## Files Modified

- `lib/validation/bidValidation.ts` - Added category checking functions
- `app/admin/page.tsx` - Added team eligibility display card
- `app/captain/page.tsx` - Added category alerts and checking
