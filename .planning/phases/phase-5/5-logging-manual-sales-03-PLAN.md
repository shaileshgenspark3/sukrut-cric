---
phase: 5-logging-manual-sales
plan: 03
type: execute
wave: 3
depends_on: ["5-logging-manual-sales-01"]
files_modified:
  - lib/actions/logging.ts
  - lib/actions/reverseSale.ts
  - app/admin/page.tsx
autonomous: true
requirements: [LOG-02, LOG-03, DATA-01, DATA-02, LIFE-04]
must_haves:
  truths:
    - "Admin can delete log entries with confirmation"
    - "Deletion reverses sale (player becomes available, team purse restored)"
    - "Deleted entries are recorded in audit trail with what was reversed"
    - "Bid history cleared for reversed sales"
    - "Deleted Log Entry restores player to available status and team to previous state (sold price refunded to purse)"
  artifacts:
    - path: "lib/actions/reverseSale.ts"
      provides: "Sale reversal operations"
      exports: ["reverseSale", "getSaleHistory"]
    - path: "lib/actions/logging.ts"
      provides: "Updated delete log entry with reverse sale"
      contains: "reverseSale\|restorePlayer\|refundTeam"
---

<objective>
Implement delete log entry functionality that reverses the sale, restores player to available status, refunds team purse, and records the reversal in audit trail.

Purpose: Allow admins to reverse erroneous or disputed sales by deleting the log entry. This restores the system state before the sale occurred, with full audit trail.

Output: Server actions for sale reversal, integration with logging deletion, Admin UI confirmation flow.
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Reverse sale requirements:
# - Delete log entry with confirmation
# - Mark log as deleted (soft delete)
# - Restore player: is_sold = FALSE, sold_to_team_id = NULL, sold_price = NULL
# - Refund team: add sale_price back to current_purse
# - Clear bids: delete all bids for this player
# - Audit trail: record who reversed, when, reason
</context>

<tasks>

<task type="auto">
  <name>task 1: Create reverse sale server actions</name>
  <files>lib/actions/reverseSale.ts</files>
  <action>
Create lib/actions/reverseSale.ts:

1. getSaleHistory(playerId):
   - Fetch all bids for player
   - Fetch auction_log entries for player
   - Return chronological history of all actions

2. reverseSale(logId, reason, performedBy):
   - Get log entry details
   - Validate entry exists and is not already deleted
   
   - Record in audit_log:
     * action_type = "reverse_sale"
     * entity_type = "auction_log"
     * entity_id = logId
     * performed_by = performedBy
     * reason = reason
     * previous_state = full log entry JSON
   
   - Restore player state:
     * is_sold = FALSE
     * sold_to_team_id = NULL
     * sold_price = NULL
   
   - Refund team purse (if sale was sold, not unsold):
     * Get team's current purse
     * Add sale_price back to current_purse
     * Update auction_rules table
   
   - Clear bid history:
     * Delete all bids for this player
     * Clear auction_state if this was current player
   
   - Mark log as deleted:
     * auction_log.deleted = TRUE
     * auction_log.deleted_by = performedBy
     * auction_log.deleted_at = now()
     * auction_log.deletion_reason = reason
   
   - Revalidate pages
   - Return success/error
</action>
  <verify>
grep -r "export.*reverseSale\|export.*getSaleHistory" lib/actions/reverseSale.ts
</verify>
  <done>Reverse sale server actions created</done>
</task>

<task type="auto">
  <name>task 2: Update delete log entry action</name>
  <files>lib/actions/logging.ts</files>
  <action>
Update lib/actions/logging.ts deleteLogEntry function:

1. Import reverseSale function
2. Call reverseSale instead of just marking deleted
3. Handle the complete reversal process
4. Return updated status

This ensures delete and reverse are tightly integrated.
</action>
  <verify>
grep -r "reverseSale" lib/actions/logging.ts
</verify>
  <done>Delete log entry updated to use reverse sale</done>
</task>

<task type="auto">
  <name>task 3: Update AuctionLogs component with delete confirmation</name>
  <files>components/admin/AuctionLogs.tsx</files>
  <action>
Update components/admin/AuctionLogs.tsx:

1. Delete button:
   - Show trash icon for non-deleted entries
   - Disabled for already deleted entries

2. Delete confirmation modal:
   - "Delete Log Entry"
   - Show player name and details
   - Show team and sale price
   - Warning: "This will reverse the sale, restore player to available status, and refund team purse"
   - Reason input (required): "Reason for deletion"
   - Confirm/Cancel buttons

3. Deleted entries display:
   - Show "DELETED" badge
   - Grayed out styling
   - Show deletion reason
   - Show who deleted and when

4. Success feedback:
   - Toast/notification after successful deletion
   - Refresh logs display
</action>
  <verify>
grep -r "delete.*confirm\|reverse.*sale\|deleted.*badge" components/admin/AuctionLogs.tsx
</verify>
  <done>Delete confirmation added to AuctionLogs</done>
</task>

<task type="auto">
  <name>task 4: Update Admin page with audit trail view</name>
  <files>app/admin/page.tsx</files>
  <action>
Update app/admin/page.tsx:

1. Add Audit Trail tab (optional or sub-tab):
   - Show audit_log entries
   - Filter by entity_id (player/team)
   - Columns: Action, Entity, Performed By, When, Reason

2. Delete action integration:
   - Already handled in AuctionLogs component
   - Ensure audit trail updates on deletion

3. Reverse sale action import:
   - Import reverseSale
   - Available if needed elsewhere
</action>
  <verify>
grep -r "audit.*trail\|AuditLog" app/admin/page.tsx
</verify>
  <done>Audit trail view added to Admin</done>
</task>

</tasks>

<verification>
1. Delete button shows confirmation modal
2. Confirmation modal shows reversal warning
3. Reason input required for deletion
4. Deletion marks log as deleted and restores player
5. Team purse refunded with sold price
6. Bid history cleared for player
7. Audit trail records reversal details
8. Deleted entries show with DELETED badge
</verification>

<success_criteria>
1. Admin can delete entries from Log Entries with confirmation, and deletion reverses sale (player becomes available, team purse restored, bid history cleared)
2. Deleted entries are recorded in audit trail with what was reversed, by whom, when, and reason
3. Deleted Log Entry restores player to available status and team to previous state (sold price refunded to purse)
</success_criteria>

<output>
After completion, create `.planning/phases/phase-5/5-logging-manual-sales-03-SUMMARY.md`
</output>
