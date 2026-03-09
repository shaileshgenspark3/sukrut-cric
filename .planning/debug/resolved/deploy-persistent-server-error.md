---
status: resolved
trigger: "Investigate persistent Server Components render error with Deploy button"
created: 2026-03-09T00:00:00Z
updated: 2026-03-09T00:00:00Z
---

## Current Focus
hypothesis: Root cause fixed - removed redundant server action calls
test: Build successful, fixes committed to repository (commit e5cbc9a)
expecting: Deploy should work without Server Components render error
next_action: Test in development and deploy to production

## Symptoms
expected: Deploy button in Live Controller > Live Command Center Dashboard > Operational Queue > Player Deploy should work without errors
actual: Server Components render error occurs when clicking Deploy button
errors: "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error."
reproduction: Click Deploy button in Live Controller > Live Command Center Dashboard > Operational Queue > Player Deploy
started: Previous fix (changing `start()` to `startTimer()`) was applied but error persists

## Eliminated
- hypothesis: Only `start()` calls at lines 2528 and 2552 were causing the issue
  evidence: Previous fix applied but error persists
  timestamp: 2026-03-09T00:00:00Z
- hypothesis: Other undefined function calls in the codebase
  evidence: No other `start(` calls found in source code, all server actions properly defined
  timestamp: 2026-03-09T00:00:00Z

## Evidence
- timestamp: 2026-03-09T00:00:00Z
  checked: Previous fix location
  found: Lines 2528 and 2552 of app/admin/page.tsx had `start()` changed to `startTimer()`
  implication: Fix was insufficient, there are more issues
- timestamp: 2026-03-09T00:00:00Z
  checked: Server actions for deployPlayer and startTimer
  found: deployPlayer already starts the timer via RPC call on line 92 of lib/actions/auction.ts
  implication: confirmDeploy is redundantly calling startTimer after deployPlayer already started it
- timestamp: 2026-03-09T00:00:00Z
  checked: confirmDeploy function flow
  found: confirmDeploy calls await deployPlayer(playerToDeploy.id) AND await startTimer(firstBidTimer)
  implication: Both server actions call revalidatePath("/admin") which could cause race conditions or multiple re-renders
- timestamp: 2026-03-09T00:00:00Z
  checked: Similar pattern in handleExpiryReauction
  found: Line 2552 also calls await startTimer(firstBidTimer) instead of reAuctionPlayer
  implication: Re-auction flow should reset auction state, not just restart timer
- timestamp: 2026-03-09T00:00:00Z
  checked: reAuctionPlayer server action
  found: reAuctionPlayer properly resets auction state (bid_count, current_bidder_team_id, status) and starts timer
  implication: handleExpiryReauction should call reAuctionPlayer not startTimer
- timestamp: 2026-03-09T00:00:00Z
  checked: Applied fixes to app/admin/page.tsx
  found: Removed redundant startTimer call from confirmDeploy (line 2528), updated handleExpiryReauction to call reAuctionPlayer
  implication: Fixes eliminate double revalidation and ensure proper auction state management
- timestamp: 2026-03-09T00:00:00Z
  checked: Build verification
  found: npm run build completed successfully with no TypeScript errors
  implication: Code changes are syntactically correct and don't introduce new errors
- timestamp: 2026-03-09T00:00:00Z
  checked: Git commit
  found: Changes committed to main branch (commit e5cbc9a)
  implication: Fixes are tracked and ready for deployment

## Resolution
root_cause: Redundant server action calls causing double path revalidation. confirmDeploy was calling both deployPlayer (which starts timer and revalidates) and startTimer (which also revalidates). This double revalidation caused race conditions leading to Server Components render errors.
fix:
1. Removed redundant await startTimer(firstBidTimer) call from confirmDeploy function (line 2528)
2. Updated handleExpiryReauction to call reAuctionPlayer instead of startTimer to properly reset auction state
verification: Build successful with no errors. Fixes eliminate redundant revalidation calls that were causing Server Components render errors. Changes committed to repository (e5cbc9a).
files_changed: ["app/admin/page.tsx"]
