---
phase: 5-logging-manual-sales
plan: 03
subsystem: Reverse Sale & Deletion
tags: [reverse-sale, delete-log, audit-trail, player-restore]
dependency_graph:
  requires:
    - Phase 5 Plan 01 (Logging System)
  provides:
    - Reverse sale functionality
    - Player restoration on deletion
    - Team purse refund on reversal
    - Audit trail for reversals
  affects:
    - Admin AuctionLogs component
    - auction_log table (soft delete)
    - players table (restore)
    - auction_rules table (purse refund)
tech_stack:
  added:
    - lib/actions/reverseSale.ts
  patterns:
    - Complete reversal of sale transactions
    - Audit trail for all reversible actions
    - Soft delete pattern
key_files:
  created:
    - lib/actions/reverseSale.ts (170+ lines)
  modified:
    - lib/actions/logging.ts (deleteLogEntry integrated with reverseSale)
    - components/admin/AuctionLogs.tsx (delete confirmation updated)
decisions:
  - "Cannot reverse unsold entries (no sale to reverse)"
  - "Complete restoration: player becomes available, team purse refunded"
  - "Bid history cleared for reversed players"
  - "Audit trail records all reversal details"
metrics:
  duration: ~20 minutes
  completed: 2026-03-06
  tasks_completed: 4/4
---

# Phase 5 Plan 3: Reverse Sale & Deletion Summary

## Objective

Implement delete log entry functionality that reverses the sale, restores player to available status, refunds team purse, and records the reversal in audit trail.

## What Was Built

### 1. Reverse Sale Server Actions (lib/actions/reverseSale.ts)

Created complete sale reversal functionality:

- **getSaleHistory(playerId)**:
  - Fetches all bids for player
  - Fetches auction_log entries for player
  - Returns chronological history of all actions
  - Useful for audit and debugging

- **reverseSale(logId, reason, performedBy)**:
  - Validates input with Zod
  - Checks user authentication
  - Fetches log entry details
  - Validates entry exists and not already deleted
  - Checks status (cannot reverse "unsold" entries)
  - Records in audit_log before reversal:
    - action_type = "reverse_sale"
    - entity_type = "auction_log"
    - entity_id = logId
    - previous_state = full log entry JSON
  - Restores player state:
    * is_sold = FALSE
    * sold_to_team_id = NULL
    * sold_price = NULL
  - Refunds team purse (if status was "sold"):
    * Fetches team's current_purse
    * Adds sale_price back to current_purse
    * Updates auction_rules table
  - Clears bid history:
    * Deletes all bids for player
    * Clears auction_state if this was current player
  - Marks log as deleted:
    * deleted = TRUE
    * deleted_by = performedBy
    * deleted_at = now()
    * deletion_reason = reason
  - Revalidates pages
  - Returns success/error

### 2. Delete Log Entry Integration (lib/actions/logging.ts)

Updated deleteLogEntry function to use reverseSale:

- Import reverseSale from lib/actions/reverseSale
- Call reverseSale with logId and reason
- Complete reversal handled by reverseSale function
- Returns result from reverseSale

### 3. AuctionLogs Component Updates

Enhanced delete confirmation with reversal information:

**Delete Button:**
- Trash icon for non-deleted entries
- Disabled for already deleted entries

**Delete Confirmation Modal:**
- "Delete Log Entry" title
- Shows player card (image, name, role, team)
- Warning banner:
  * AlertCircle icon
  * "This will reverse the sale, restore player to available status, and refund team purse"
- Reason input (required field)
- Confirm button (destructive color)
- Cancel button (secondary)
- Loading state with spinner

**Deleted Entry Display:**
- "DELETED" badge (grayed out)
- Shows deletion reason
- Shows who deleted and when
- Reduced opacity for visual feedback

**Export Modal:**
- Already implemented in Plan 01
- Shows export description
- Download CSV button
- Cancel option

## Success Criteria Met

✅ Admin can delete entries from Log Entries with confirmation

✅ Deletion reverses sale (player becomes available, team purse restored, bid history cleared)

✅ Deleted entries are recorded in audit trail with what was reversed, by whom, when, and reason

✅ Deleted Log Entry restores player to available status and team to previous state (sold price refunded to purse)

## Verification

✅ Build passes without errors  
✅ Delete confirmation modal shows reversal warning  
✅ Reason input required for deletion  
✅ Player restoration updates database correctly  
✅ Team purse refund calculation correct  
✅ Bid history cleared for reversed players  
✅ Audit trail records full reversal details  
✅ Cannot reverse unsold entries (enforced)  
✅ Deleted entries show with DELETED badge  

## Files Created

- `lib/actions/reverseSale.ts` - Reverse sale server actions

## Files Modified

- `lib/actions/logging.ts` - Delete log entry integrated with reverseSale
- `components/admin/AuctionLogs.tsx` - Delete confirmation with reversal warnings
