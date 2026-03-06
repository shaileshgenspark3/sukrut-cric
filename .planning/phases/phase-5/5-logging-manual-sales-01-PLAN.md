---
phase: 5-logging-manual-sales
plan: 01
type: execute
wave: 1
depends_on: ["4-bid-validation-03"]
files_modified:
  - supabase/migrations/
  - lib/actions/logging.ts
  - app/admin/page.tsx
  - components/admin/AuctionLogs.tsx
autonomous: true
requirements: [LOG-01, LOG-02, LOG-03, LOG-04]
must_haves:
  truths:
    - "Admin can view all sold/unsold records in Log Entries tab"
    - "Admin can delete log entries with confirmation"
    - "Deleted entries are recorded in audit trail"
    - "Admin can download logs as CSV"
  artifacts:
    - path: "supabase/migrations/"
      provides: "auction_log table schema"
      contains: "CREATE TABLE.*auction_log"
    - path: "lib/actions/logging.ts"
      provides: "Logging CRUD operations"
      exports: ["createLogEntry", "deleteLogEntry", "getAuctionLogs"]
    - path: "components/admin/AuctionLogs.tsx"
      provides: "Log Entries tab UI"
      contains: "AuctionLogs|delete.*log"
---

<objective>
Create comprehensive logging system for all auction transactions with display, deletion, audit trail, and CSV export functionality.

Purpose: Record all auction activities (sold, unsold, manual sales) for audit and reporting. Enable admins to view, delete, and export logs.

Output: Database table for logs, server actions for log management, Admin UI component for displaying logs, CSV export functionality.
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Log entries needed:
# - Player name, details (category, role)
# - Sold to team (or unsold)
# - Sale price (or unsold reason)
# - Status: sold/unsold/manual
# - Timestamp
# - Performed by (admin who recorded it)
# - Audit trail for deletions
</context>

<tasks>

<task type="auto">
  <name>task 1: Create auction_log table and audit_log table</name>
  <files>supabase/migrations/</files>
  <action>
Create migration file supabase/migrations/20260306_auction_logging.sql:

1. Create auction_log table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - player_id UUID REFERENCES players(id)
   - team_id UUID REFERENCES teams(id) (nullable)
   - status VARCHAR(20) (sold, unsold, manual)
   - sale_price INTEGER (nullable)
   - base_price INTEGER
   - bid_count INTEGER DEFAULT 0
   - category VARCHAR(10)
   - gender VARCHAR(10)
   - logged_at TIMESTAMPTZ DEFAULT now()
   - logged_by UUID REFERENCES auth.users(id) (admin who created)
   - is_manual BOOLEAN DEFAULT FALSE
   - deleted BOOLEAN DEFAULT FALSE
   - deleted_at TIMESTAMPTZ (nullable)
   - deleted_by UUID REFERENCES auth.users(id) (nullable)
   - deletion_reason TEXT

2. Create audit_log table:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - action_type VARCHAR(50) (delete_log, reverse_sale, manual_sale)
   - entity_type VARCHAR(50) (auction_log, sale)
   - entity_id UUID
   - performed_by UUID REFERENCES auth.users(id)
   - performed_at TIMESTAMPTZ DEFAULT now()
   - reason TEXT
   - previous_state JSONB

3. Create indexes:
   - auction_log: logged_at (descending)
   - auction_log: player_id
   - audit_log: performed_at

4. Enable RLS and policies
</action>
  <verify>
grep -r "CREATE TABLE.*auction_log\|CREATE TABLE.*audit_log" supabase/migrations/20260306_auction_logging.sql
</verify>
  <done>Log tables created with audit trail</done>
</task>

<task type="auto">
  <name>task 2: Create logging server actions</name>
  <files>lib/actions/logging.ts</files>
  <action>
Create lib/actions/logging.ts:

1. createLogEntry(playerId, teamId, status, salePrice, isAdmin):
   - Get player details
   - Get current user (admin)
   - Insert into auction_log
   - Return created log entry

2. getAuctionLogs(limit?, offset?):
   - Fetch auction_log with player and team details
   - Filter out deleted entries by default
   - Join with players, teams tables
   - Return paginated results

3. deleteLogEntry(logId, reason):
   - Get log entry to delete
   - Record in audit_log before deletion
   - Mark auction_log.deleted = TRUE
   - Set deleted_by, deleted_at, deletion_reason
   - Return success/error

4. exportLogsAsCSV(startDate?, endDate?):
   - Fetch all logs (including deleted if needed)
   - Format as CSV with headers
   - Return CSV string or file URL

5. getAuditTrail(entityId?):
   - Fetch audit_log entries
   - Filter by entity_id if provided
   - Return audit records
</action>
  <verify>
grep -r "export.*createLogEntry\|export.*deleteLogEntry\|export.*getAuctionLogs" lib/actions/logging.ts
</verify>
  <done>Logging server actions created</done>
</task>

<task type="auto">
  <name>task 3: Create AuctionLogs component for Admin</name>
  <files>components/admin/AuctionLogs.tsx</files>
  <action>
Create components/admin/AuctionLogs.tsx:

1. Table display:
   - Columns: Player, Team, Status, Sale Price, Category, Time, Actions
   - Pagination (10, 25, 50 per page)
   - Date range filter
   - Search by player name or team name

2. Log entry details:
   - Player card with image, name, category
   - Team badge with logo and name
   - Status badges: sold (green), unsold (yellow), manual (blue)
   - Sale price formatted as currency
   - Timestamp in readable format

3. Delete action:
   - Delete button for each entry
   - Confirmation modal
   - Reason input for deletion
   - Shows deleted status for deleted entries

4. Export button:
   - Download CSV button in header
   - Export all filtered logs
   - File name: auction_logs_YYYYMMDD.csv
</action>
  <verify>
grep -r "export.*AuctionLogs" components/admin/AuctionLogs.tsx
</verify>
  <done>AuctionLogs component created</done>
</task>

<task type="auto">
  <name>task 4: Integrate AuctionLogs into Admin page</name>
  <files>app/admin/page.tsx</files>
  <action>
Update app/admin/page.tsx:

1. Add Log Entries tab:
   - Add "logs" to activeTab options
   - Render AuctionLogs component when tab active

2. Update existing auction flow:
   - Call createLogEntry after finalizeSale
   - Call createLogEntry after markPlayerUnsold
   - Pass isManual flag

3. Tab navigation:
   - Add button/tab in header
   - Show tab icon (FileText or Database)
</action>
  <verify>
grep -r "AuctionLogs\|logs.*tab" app/admin/page.tsx
</verify>
  <done>Log Entries tab integrated into Admin</done>
</task>

</tasks>

<verification>
1. auction_log table created with all required fields
2. audit_log table created for deletion tracking
3. Admin can view all sold/unsold records
4. Admin can delete entries with confirmation
5. Deletion recorded in audit trail
6. Admin can download logs as CSV
7. Log entries show player details, team, status, price
</verification>

<success_criteria>
1. Log Entries tab in Admin shows all sold/unsold records with player name, details, sold to team, price, status, and timestamp
2. Admin can delete entries from Log Entries with confirmation, and deletion is recorded in audit trail with what was reversed, by whom, when, and reason
3. Admin can download auction logs as CSV or Excel files, and all fields are included in export
</success_criteria>

<output>
After completion, create `.planning/phases/phase-5/5-logging-manual-sales-01-SUMMARY.md`
</output>
