---
phase: 3-live-auction-core
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260306_timer_management.sql
  - src/actions/timer.ts
  - src/services/timer/timerService.ts
  - src/hooks/useTimer.ts
  - src/components/admin/LiveAuctionController.tsx
autonomous: true
requirements: [RULE-03, RULE-04, FLOW-01, FLOW-06, FLOW-07]
must_haves:
  truths:
    - "Admin can deploy a player to auction and timer starts automatically"
    - "Countdown timer is visible in Admin Live Controller showing seconds remaining"
    - "Admin can pause the auction and timer freezes at current value"
    - "Admin can resume the auction and timer continues from frozen state"
    - "Admin can configure timer settings (first bid timer, subsequent bid timer) during live auction"
  artifacts:
    - path: "supabase/migrations/20260306_timer_management.sql"
      provides: "Database schema for timer state management"
      contains: "ALTER TABLE auction_state ADD COLUMN timer_end"
    - path: "src/hooks/useTimer.ts"
      provides: "React hook for timer state management with pause/resume"
      exports: ["useTimer"]
    - path: "src/actions/timer.ts"
      provides: "Server actions for timer control (start, pause, resume)"
      exports: ["startTimer", "pauseTimer", "resumeTimer", "updateTimerSettings"]
  key_links:
    - from: "src/components/admin/LiveAuctionController.tsx"
      to: "src/hooks/useTimer.ts"
      via: "useTimer hook import"
      pattern: "useTimer"
    - from: "src/hooks/useTimer.ts"
      to: "src/actions/timer.ts"
      via: "Server action calls"
      pattern: "pauseTimer|resumeTimer|updateTimerSettings"
    - from: "src/actions/timer.ts"
      to: "supabase RPC functions"
      via: "RPC function calls"
      pattern: "supabase\\.rpc"
---

<objective>
Implement timer management system for live auction with pause/resume capability and configurable timer settings.

Purpose: Establish authoritative timer state in database with client-side display for smooth auction flow. Timer state must be synchronized across all clients to prevent drift.

Output: Database schema for timer state, server actions for timer control, React hook for timer management, updated Admin Live Controller with timer display and controls.
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
@.planning/research/STACK.md

# Timer management pattern from ARCHITECTURE.md
# Use react-timer-hook 4.0.4 for client-side countdown
# Server-side timer_end stored in auction_state table
# Client-server sync pattern (every 5s) to prevent desynchronization
</context>

<tasks>

<task type="auto">
  <name>task 1: Add timer management schema and RPC functions</name>
  <files>supabase/migrations/20260306_timer_management.sql</files>
  <action>
Create migration file with:

1. Add columns to auction_state table:
   - timer_end TIMESTAMPTZ (authoritative timer expiry)
   - initial_timer_seconds INTEGER DEFAULT 30
   - first_bid_timer_seconds INTEGER DEFAULT 30
   - subsequent_bid_timer_seconds INTEGER DEFAULT 15
   - is_paused BOOLEAN DEFAULT FALSE
   - paused_at TIMESTAMPTZ
   - last_bid_at TIMESTAMPTZ

2. Create RPC function start_auction_timer(p_initial_seconds INTEGER DEFAULT NULL):
   - If p_initial_seconds provided, update initial_timer_seconds
   - Set timer_end = now() + (initial_timer_seconds || 30) seconds
   - Set is_paused = FALSE, paused_at = NULL

3. Create RPC function pause_auction_timer():
   - Set is_paused = TRUE, paused_at = timer_end

4. Create RPC function resume_auction_timer():
   - Calculate pause_duration = paused_at - now()
   - Set timer_end = timer_end + pause_duration
   - Set is_paused = FALSE, paused_at = NULL

5. Create RPC function update_timer_settings(p_first_bid_seconds INTEGER, p_subsequent_bid_seconds INTEGER):
   - Update first_bid_timer_seconds, subsequent_bid_timer_seconds
   - If no bids on current player and timer running, restart with new settings

6. Create index on auction_state.timer_end for efficient queries

Reference ARCHITECTURE.md lines 510-584 for exact SQL implementations.
</action>
  <verify>
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'supabase_migrations'
  AND table_name = '20260306_timer_management'
);
</verify>
  <done>Database schema with timer columns and RPC functions created</done>
</task>

<task type="auto">
  <name>task 2: Create timer server actions and service layer</name>
  <files>src/actions/timer.ts, src/services/timer/timerService.ts</files>
  <action>
Create src/actions/timer.ts with server actions:
- startTimer(playerId: string, initialSeconds?: number): Calls RPC start_auction_timer
- pauseTimer(): Calls RPC pause_auction_timer
- resumeTimer(): Calls RPC resume_auction_timer
- updateTimerSettings(firstBidSeconds: number, subsequentBidSeconds: number): Calls RPC update_timer_settings

Each action should:
- Validate input with Zod schema
- Call corresponding RPC function
- Handle errors and throw descriptive messages
- Revalidate admin and captain pages after mutation

Create src/services/timer/timerService.ts with:
- calculateRemainingSeconds(timerEnd: string, isPaused: boolean, pausedAt?: string): Returns remaining seconds accounting for pause state
- formatTimerDisplay(seconds: number): Returns { days, hours, minutes, seconds, totalSeconds }
- isTimerExpired(timerEnd: string, isPaused: boolean): Returns boolean

Reference STACK.md for react-timer-hook usage patterns.
</action>
  <verify>
grep -r "export.*startTimer\|export.*pauseTimer\|export.*resumeTimer" src/actions/timer.ts
grep -r "export.*calculateRemainingSeconds\|export.*formatTimerDisplay" src/services/timer/timerService.ts
</verify>
  <done>Server actions and service layer for timer management created</done>
</task>

<task type="auto">
  <name>task 3: Create useTimer hook and update Admin Live Controller</name>
  <files>src/hooks/useTimer.ts, src/components/admin/LiveAuctionController.tsx</files>
  <action>
Create src/hooks/useTimer.ts with client-side timer management:
- Use react-timer-hook's useTimer hook
- Sync with database every 5 seconds via auction_state query
- Handle pause/resume state from database
- Provide: totalSeconds, seconds, minutes, hours, isRunning, pause(), resume()
- On expiry, dispatch event for parent to handle

Hook logic:
1. Fetch auction_state.timer_end, is_paused from Supabase
2. Calculate remaining seconds locally for smooth display
3. Use useTimer from react-timer-hook with expiryTimestamp
4. Periodically sync with database to correct drift
5. Sync pause/resume state from database is_paused flag

Update src/components/admin/LiveAuctionController.tsx to:
1. Add timer display section showing "Time remaining: MM:SS" in large, prominent text
2. Add Pause/Resume button (toggle based on is_paused state)
3. Add Timer Settings section with inputs for "First Bid Timer (seconds)" and "Subsequent Bid Timer (seconds)" with Save button
4. When admin deploys player, call startTimer() with initial value
5. Subscribe to auction_state changes via Supabase Realtime
6. Display timer in both admin and captain dashboards (captain gets via Realtime, admin via useTimer hook)

Timer display format: Large red numbers, updates every second, shows "PAUSED" overlay when timer paused.
</action>
  <verify>
grep -r "export.*useTimer" src/hooks/useTimer.ts
grep -r "useTimer\|pauseTimer\|resumeTimer\|updateTimerSettings" src/components/admin/LiveAuctionController.tsx
</verify>
  <done>useTimer hook created and Admin Live Controller updated with timer display and controls</done>
</task>

</tasks>

<verification>
1. Migration runs successfully without errors
2. RPC functions callable from server actions
3. Timer display shows countdown in Admin Live Controller
4. Pause/Resume buttons correctly freeze and continue timer
5. Timer settings inputs save and apply immediately
6. Timer syncs with database every 5 seconds
7. Timer expiry triggers state change (handled in next plan)
</verification>

<success_criteria>
1. Admin can deploy a player to auction and timer starts automatically (startTimer called on deploy)
2. Countdown timer is visible in Admin Live Controller showing seconds remaining correctly
3. Admin can pause the auction and timer freezes at current value (pauseTimer RPC called)
4. Admin can resume the auction and timer continues from frozen state (resumeTimer RPC called with pause_duration adjustment)
5. Admin can configure timer settings (first bid timer, subsequent bid timer) during live auction and changes apply immediately
</success_criteria>

<output>
After completion, create `.planning/phases/phase-3/3-live-auction-core-01-SUMMARY.md`
</output>
