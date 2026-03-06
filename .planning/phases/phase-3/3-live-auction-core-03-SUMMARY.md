---
phase: 3-live-auction-core
plan: 03
subsystem: Real-time Bid Display
tags: [bids, real-time, display, history, top-3]
dependency_graph:
  requires:
    - Phase 3 Plan 02 (Auction Flow)
  provides:
    - useBids hook for real-time bid subscriptions
    - BidHistory component for prominent display
    - Top 3 bids with team details
    - Bid history from 4th onwards
  affects:
    - Admin Live Controller
    - Captain Dashboard
    - bids table
tech_stack:
  added:
    - hooks/useBids.ts (real-time bid hook)
    - components/admin/BidHistory.tsx (bid display)
  patterns:
    - Supabase Realtime for live bid updates
    - TanStack Query for data fetching
    - Memoized top 3 and history splits
key_files:
  created:
    - hooks/useBids.ts (150 lines)
    - components/admin/BidHistory.tsx (200 lines)
  modified:
    - app/captain/page.tsx (+bid display)
    - app/admin/page.tsx (+bid display)
decisions:
  - "Top 3 bids displayed prominently with team logo, captain, amount"
  - "History from 4th onwards in compact list"
  - "Real-time updates via Supabase channel"
  - "BidHistory replaces Transaction Feed when player deployed"
metrics:
  duration: ~15 minutes
  completed: 2026-03-06
  tasks_completed: 5/5
---

# Phase 3 Plan 3: Real-time Bid Display Summary

## Objective

Implement real-time bid history display with top 3 bids prominently shown with team details, and history from 4th bid onwards in compact format.

## What Was Built

### useBids Hook (hooks/useBids.ts)

- Fetches bids for a specific player with team join
- Orders by bid_amount DESC, then created_at DESC
- Real-time subscription via Supabase Postgres Changes
- Returns: bids array, topBids (first 3), historyBids (4+)
- Memoized calculations for performance

### BidHistory Component (components/admin/BidHistory.tsx)

- **Top 3 Bids Section**:
  - 3-column grid on desktop, stacked on mobile
  - Each card shows: team logo, captain name/image, bid amount
  - Gold/Silver/Bronze badges for 1st, 2nd, 3rd place
  - Animated entry with Framer Motion
  
- **History Section** (4th onwards):
  - Table-like compact list
  - Shows rank, team name, amount, timestamp
  - Scrollable if > 10 bids

- **Summary Bar**:
  - Total bids count
  - Current highest bid amount

### Captain Dashboard Integration

- Added useBids hook import and call
- Added BidHistory component below bid button
- Shows bid history when player is deployed
- Real-time updates as captains place bids

### Admin Live Controller Integration

- Added useBids hook to LiveControllerTab
- Replaced Transaction Feed with BidHistory when player deployed
- Shows full bid history when no player on block

## Key Decisions

1. **Top 3 Prominent**: Enhanced visual display with badges and colors
2. **History Compact**: Table view saves space, scrollable
3. **Real-time**: Supabase subscription for instant updates
4. **Contextual Display**: Different views for "player deployed" vs "idle"

## Verification

- [x] useBids hook created with real-time subscription
- [x] BidHistory component shows top 3 prominently with team details
- [x] History from 4th onwards in compact list
- [x] Captain Dashboard shows bid display
- [x] Admin Live Controller shows bid display
- [x] Real-time updates work correctly
- [x] Build passes with no errors

## Notes

- Bids table indexes should be verified for performance
- Captain Dashboard already had victory confetti for successful bids
- BidHistory component is reusable across both dashboards
