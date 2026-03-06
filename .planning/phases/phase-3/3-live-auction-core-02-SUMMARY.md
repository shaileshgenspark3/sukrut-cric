---
phase: 3-live-auction-core
plan: 02
subsystem: Auction Flow Orchestration
tags: [auction, deploy, unsold, sale, player-card]
dependency_graph:
  requires:
    - Phase 3 Plan 01 (Timer Management)
  provides:
    - Auction server actions (deploy, unsold, sale)
    - PlayerCard component for detailed display
    - Timer display on Captain Dashboard
  affects:
    - Admin Live Controller
    - Captain Dashboard
    - players table
    - auction_state table
tech_stack:
  added:
    - lib/actions/auction.ts (server actions)
    - components/admin/PlayerCard.tsx (player display)
    - hooks/useTimer.ts (timer hook - from Plan 01)
  patterns:
    - Server actions for auction operations
    - Zod validation for all inputs
    - Real-time state updates via Supabase
key_files:
  created:
    - lib/actions/auction.ts (413 lines)
    - components/admin/PlayerCard.tsx (272 lines)
  modified:
    - app/admin/page.tsx (+auction flow controls)
    - app/captain/page.tsx (+timer display)
decisions:
  - "Timer display on Captain Dashboard with color coding"
  - "PlayerCard shows all player details prominently"
  - "Sale finalization includes confetti celebration"
metrics:
  duration: ~20 minutes
  completed: 2026-03-06
  tasks_completed: 4/4
---

# Phase 3 Plan 2: Auction Flow Orchestration Summary

## Objective

Implement complete auction flow orchestration including player deployment, timer expiry handling, and sale finalization with bid increment enforcement.

## What Was Built

### Server Actions (lib/actions/auction.ts)

- **deployPlayer**: Validates player eligibility, updates auction_state with current player, starts timer, revalidates pages
- **markPlayerUnsold**: Clears current player, resets auction state, marks player as available
- **finalizeSale**: Records winning bid, updates player as sold, deducts from team purse, resets auction state

### PlayerCard Component (components/admin/PlayerCard.tsx)

- Displays all player details: name, category, age, height, handy, type, earlier seasons, achievements, special remarks
- Category badges: A+ (red), A (orange), B (yellow), C (green), F (purple)
- Shows base price prominently
- Shows current bid and bid count when deployed
- Displays top bidder info

### Timer Display on Captain Dashboard

- Added useTimer hook import and initialization
- Timer countdown display above bid section
- Color coding: red (<10s), orange (<20s), green (otherwise)
- Shows "PAUSED" overlay when timer is paused
- Format: MM:SS

### Auction Flow Controls in Admin

- Deploy player with confirmation dialog
- Mark as Sold / Unsold buttons
- Timer expiry handling (show modal with options)
- Sale confirmation with confetti celebration

## Key Decisions

1. **Timer as Source of Truth**: Server-side timer_end in database remains authoritative
2. **PlayerCard Reuse**: Used in both Admin and Captain dashboards
3. **Confetti on Sale**: Added visual celebration when player is sold

## Verification

- [x] deployPlayer action sets current_player_id and starts timer correctly
- [x] markPlayerUnsold action clears current player and resets state
- [x] finalizeSale action updates player and team correctly
- [x] PlayerCard displays all player details prominently
- [x] Timer displays on Captain Dashboard with color coding
- [x] Base price displayed prominently to all participants
- [x] Bid increment of 25,000 enforced and displayed correctly

## Notes

- Plan 01 timer management serves as foundation for Plan 02
- Captain Dashboard now shows countdown timer synced with admin
- Sale confirmation includes confetti for visual feedback
