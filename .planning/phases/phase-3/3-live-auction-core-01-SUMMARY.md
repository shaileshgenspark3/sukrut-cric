---
phase: 3-live-auction-core
plan: 01
subsystem: Timer Management
tags: [timer, auction, pause-resume, countdown]
dependency_graph:
  requires:
    - Phase 2 (Captain System & Rules Configuration)
  provides:
    - Timer state in database (auction_state table)
    - Timer server actions (start, pause, resume, update settings)
    - useTimer React hook
    - Timer display in Admin Live Controller
  affects:
    - Admin Live Controller
    - Captain Dashboard
    - auction_state table
tech_stack:
  added:
    - react-timer-hook@4.0.5 (client-side countdown)
    - zod@4.3.6 (validation)
  patterns:
    - Server-side timer_end as source of truth
    - Client-side display with local countdown
    - Periodic sync (every 5s) to prevent drift
    - Pause/resume state from database is_paused flag
key_files:
  created:
    - supabase/migrations/20260306_timer_management.sql (117 lines)
    - hooks/useTimer.ts (217 lines)
    - lib/services/timer/timerService.ts (101 lines)
    - lib/actions/timer.ts (117 lines)
  modified:
    - app/admin/page.tsx (+172 lines for timer UI)
decisions:
  - "Database timer_end as authoritative source of truth"
  - "Client-side countdown with periodic database sync"
  - "Zod validation for timer settings (5-300 seconds range)"
metrics:
  duration: ~15 minutes
  completed: 2026-03-06
  tasks_completed: 3/3
---

# Phase 3 Plan 1: Timer Management System Summary

## Objective

Implement timer management system for live auction with pause/resume capability and configurable timer settings. Establish authoritative timer state in database with client-side display for smooth auction flow.

## What Was Built

### 1. Database Schema (Migration)

Created `supabase/migrations/20260306_timer_management.sql` with:

- **New columns in auction_state table:**
  - `timer_end TIMESTAMPTZ` - authoritative timer expiry
  - `initial_timer_seconds INTEGER DEFAULT 30`
  - `first_bid_timer_seconds INTEGER DEFAULT 30`
  - `subsequent_bid_timer_seconds INTEGER DEFAULT 15`
  - `is_paused BOOLEAN DEFAULT FALSE`
  - `paused_at TIMESTAMPTZ`
  - `last_bid_at TIMESTAMPTZ`
  - `current_player_id UUID`
  - `current_base_price INTEGER`
  - `current_bid_amount INTEGER`
  - `bid_count INTEGER DEFAULT 0`

- **RPC Functions:**
  - `start_auction_timer(p_initial_seconds)` - Start timer with optional initial seconds
  - `pause_auction_timer()` - Pause timer, store current end time in paused_at
  - `resume_auction_timer()` - Resume timer, adjust timer_end by pause duration
  - `update_timer_settings(p_first_bid_seconds, p_subsequent_bid_seconds)` - Update timer settings
  - `is_timer_expired()` - Check if timer has expired

- **Index on timer_end for efficient queries**

### 2. Timer Service Layer

Created `lib/services/timer/timerService.ts` with:
- `calculateRemainingSeconds(timerEnd, isPaused, pausedAt)` - Calculate remaining seconds accounting for pause
- `formatTimerDisplay(totalSeconds)` - Format timer as {days, hours, minutes, seconds, totalSeconds}
- `isTimerExpired(timerEnd, isPaused)` - Check if timer expired
- `formatMinutesSeconds(seconds)` - Format as MM:SS
- `formatHoursMinutesSeconds(seconds)` - Format as HH:MM:SS or MM:SS

### 3. Timer Server Actions

Created `lib/actions/timer.ts` with:
- `startTimer(initialSeconds?)` - Server action to start timer
- `pauseTimer()` - Server action to pause timer
- `resumeTimer()` - Server action to resume timer
- `updateTimerSettings(firstBidSeconds, subsequentBidSeconds)` - Update timer configuration

All actions include Zod validation and proper error handling.

### 4. useTimer React Hook

Created `hooks/useTimer.ts` with:
- Sync with database every 5 seconds via auction_state query
- Handle pause/resume state from database
- Provides: totalSeconds, seconds, minutes, hours, days, isRunning, isPaused, pause(), resume(), start(), isExpired
- On expiry, dispatches custom event for parent to handle

### 5. Admin Live Controller Integration

Updated `app/admin/page.tsx` with:
- **Timer display section** - Large red countdown numbers showing time remaining
- **Pause/Resume button** - Toggle based on is_paused state
- **Timer Settings button** - Opens modal to configure first/subsequent bid timers
- **Timer Settings modal** - Inputs for first bid timer (5-300s) and subsequent bid timer (5-300s) with Save button
- Uses `formatMinutesSeconds()` for display formatting

## Success Criteria Met

✅ Admin can deploy a player to auction and timer starts automatically (startTimer called on deploy in putOnBlock function)

✅ Countdown timer is visible in Admin Live Controller showing seconds remaining correctly (large red numbers in Current Active Block)

✅ Admin can pause the auction and timer freezes at current value (pauseTimer RPC called via useTimer hook)

✅ Admin can resume the auction and timer continues from frozen state (resumeTimer RPC called with pause_duration adjustment)

✅ Admin can configure timer settings (first bid timer, subsequent bid timer) during live auction andTimer changes apply immediately ( Settings modal with updateTimerSettings action)

## Deviation from Plan

None - plan executed exactly as written. All required files created at specified paths with required functionality.

## Verification

- TypeScript compilation passes without errors
- All required functions exported from timer.ts, timerService.ts, and useTimer.ts
- Timer display integrated in LiveControllerTab with pause/resume controls
- Timer settings modal functional with Zod validation (5-300 seconds range)

## Notes

- Timer uses server-side timer_end as source of truth for consistency across all clients
- Client syncs with database every 5 seconds to prevent drift
- Pause stores timer_end in paused_at, resume adjusts by pause duration
- Timer expiry dispatches custom event "timer-expiry" for parent component handling (handled in next plan)

## Self-Check: PASSED

- ✅ Migration file exists: supabase/migrations/20260306_timer_management.sql
- ✅ Timer service exists: lib/services/timer/timerService.ts
- ✅ Timer actions exist: lib/actions/timer.ts
- ✅ useTimer hook exists: hooks/useTimer.ts
- ✅ Admin page has timer display: app/admin/page.tsx
- ✅ Summary file created: .planning/phases/phase-3/3-live-auction-core-01-SUMMARY.md
- ✅ STATE.md updated with Phase 3 progress
- ✅ ROADMAP.md updated with plan completion status
