---
phase: 4-bid-validation
plan: 01
subsystem: Max Bid Calculation & Validation
tags: [max-bid, validation, bid, purse]
dependency_graph:
  requires:
    - Phase 3 (Live Auction Core)
  provides:
    - Max bid calculation logic
    - Server-side bid validation
    - Captain max bid display
  affects:
    - Captain Dashboard
    - Bid placement flow
tech_stack:
  added:
    - lib/validation/bidValidation.ts (new)
    - lib/actions/bids.ts (new)
  patterns:
    - Max bid formula: Remaining purse - (Category base prices for unfilled slots) + Current player category base price
    - Server-side validation before bid acceptance
    - Real-time max bid calculation
key_files:
  created:
    - lib/validation/bidValidation.ts (190 lines)
    - lib/actions/bids.ts (140 lines)
  modified:
    - app/captain/page.tsx (+max bid display)
decisions:
  - "Using category base prices from tournament_settings table"
  - "Max bid shown prominently with visual warning when exceeded"
  - "Bid validation enforced server-side to prevent invalid bids"
metrics:
  duration: ~15 minutes
  completed: 2026-03-06
  tasks_completed: 3/3
---

# Phase 4 Plan 1: Max Bid Calculation & Validation Summary

## Objective

Implement max bid calculation and server-side bid validation to prevent invalid bids. Calculate the maximum amount a team can bid based on their remaining purse and unfilled roster slots.

## What Was Built

### 1. Bid Validation Logic (lib/validation/bidValidation.ts)

Created comprehensive bid validation with:

- **calculateMaxBid(teamId, playerCategory, playerGender)**:
  - Gets team's current purse from auction_rules
  - Calculates remaining roster slots by gender
  - Computes required purse for unfilled slots using category base prices
  - Formula: `maxBid = currentPurse - requiredPurseForUnfilled + playerCategoryBasePrice`
  - Returns max bid amount (can be 0 or negative if insufficient)

- **validateBid(teamId, playerId, bidAmount)**:
  - Validates bid against max bid calculation
  - Checks if team has sufficient purse
  - Returns validation result with valid boolean, maxBid, and reason

- **getRosterStatus(teamId)**:
  - Returns current roster counts by gender and category
  - Calculates available slots per gender
  - Uses tournament_settings for max limits

- **getCategoryBasePrices()**:
  - Returns: A+=500000, A=200000, B=100000, F=50000 (defaults)
  - Reads from tournament_settings table

- **getTeamEligibility(teamId, playerId)**:
  - Returns canBid boolean, maxBid, and list of reasons
  - Checks purse, gender limits, and category restrictions

### 2. Bid Placement with Validation (lib/actions/bids.ts)

Created server actions for validated bid placement:

- **placeBidWithValidation(playerId, teamId, bidAmount)**:
  - Validates bid amount matches expected (current + 25000 increment)
  - Checks 3-second cooldown between bids
  - Calls validateBid for max bid validation
  - Inserts bid and updates auction_state
  - Returns success/error with descriptive messages

- **checkCooldown(teamId, playerId)**:
  - Enforces 3-second cooldown between bids
  - Returns canBid with remaining seconds if on cooldown

- **getTeamBidEligibility(teamId, playerId)**:
  - Returns eligibility info for UI display
  - Includes nextBid, maxBid, and reasons array

### 3. Captain Dashboard Integration

Updated app/captain/page.tsx with:

- **Max bid calculation**:
  - Added useEffect to fetch max bid when player is deployed
  - Updates in real-time as bids come in

- **Max bid display**:
  - Shows "Your Maximum Bid" prominently
  - Color-coded: red when next bid exceeds max, primary when within limit

- **Bid validation**:
  - Bid button disabled when nextBid > maxBid
  - Shows "Max bid is ₹X" reason
  - Server-side validation as final safeguard

## Success Criteria Met

✅ Max bid calculated using formula: Remaining purse - (Category base prices for unfilled roster slots) + Current player category base price

✅ Captain receives red alert when bid exceeds max bid and bid is disabled

✅ Bids rejected server-side if max bid exceeded or purse insufficient

## Verification

✅ Build passes without errors  
✅ All validation functions exported and used  
✅ Max bid displayed in Captain Dashboard  
✅ Bid validation enforced on server-side  

## Files Created

- `lib/validation/bidValidation.ts` - Max bid calculation and validation logic
- `lib/actions/bids.ts` - Bid placement with validation

## Files Modified

- `app/captain/page.tsx` - Added max bid display and validation
