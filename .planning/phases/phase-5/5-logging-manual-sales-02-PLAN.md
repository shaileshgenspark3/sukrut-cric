---
phase: 5-logging-manual-sales
plan: 02
type: execute
wave: 2
depends_on: ["5-logging-manual-sales-01"]
files_modified:
  - lib/actions/manualSales.ts
  - app/admin/page.tsx
  - components/admin/ManualSaleModal.tsx
autonomous: true
requirements: [MANUAL-01, MANUAL-02, MANUAL-03, MANUAL-04, MANUAL-05]
must_haves:
  truths:
    - "Admin can create manual sales by selecting player, team, amount, and mode"
    - "Strict mode enforces all validation rules for manual sales"
    - "Override mode bypasses validation with warning"
    - "Manual sale validation shows error to admin if rules would be violated"
    - "Manual sales are recorded in Log Entries with 'Manual' tag"
  artifacts:
    - path: "lib/actions/manualSales.ts"
      provides: "Manual sale operations"
      exports: ["createManualSale", "validateManualSale"]
    - path: "components/admin/ManualSaleModal.tsx"
      provides: "Manual sale UI"
      contains: "ManualSaleModal|strict.*mode|override.*mode"
---

<objective>
Implement manual sale workflow with strict and override modes, allowing admins to record sales outside the live auction flow.

Purpose: Enable admins to manually record player sales for scenarios like offline negotiations, disputes, or corrections. Provide both strict validation (enforces rules) and override mode (bypasses with warning).

Output: Manual sale server actions with validation, modal UI for manual sales, integration with logging system.
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md

# Manual sale requirements:
# - Admin selects player, team, sale amount
# - Two modes: strict (enforces rules) and override (bypasses validation)
# - Validation includes: max bid, category limits, purse sufficiency
# - Manual sales logged with is_manual = TRUE
# - Sale price updates player.sold_price and deducts from team purse
</context>

<tasks>

<task type="auto">
  <name>task 1: Create manual sale server actions</name>
  <files>lib/actions/manualSales.ts</files>
  <action>
Create lib/actions/manualSales.ts:

1. validateManualSale(teamId, playerId, salePrice, mode):
   - Get team and player details
   - If mode = strict:
     * Call existing validateBid (from bidValidation.ts)
     * Call checkCategoryEligibility
     * Return validation errors if any
   - If mode = override:
     * Skip validation
     * Return warning: "Override mode: all validation rules bypassed"
   - Return { valid: boolean, errors: string[], warnings: string[] }

2. createManualSale(playerId, teamId, salePrice, mode, performedBy):
   - Validate sale (or skip if override)
   - Update players table:
     * is_sold = TRUE
     * sold_to_team_id = teamId
     * sold_price = salePrice
   - Update auction_rules:
     * Deduct salePrice from team.current_purse
   - Create auction_log entry:
     * status = "manual"
     * is_manual = TRUE
     * sale_price = salePrice
     * logged_by = performedBy
   - Revalidate pages
   - Return success/error

3. getAvailablePlayers():
   - Fetch players where is_sold = FALSE and is_captain = FALSE
   - Include category, base_price
   - Return for manual sale selection
</action>
  <verify>
grep -r "export.*validateManualSale\|export.*createManualSale" lib/actions/manualSales.ts
</verify>
  <done>Manual sale server actions created</done>
</task>

<task type="auto">
  <name>task 2: Create ManualSaleModal component</name>
  <files>components/admin/ManualSaleModal.tsx</files>
  <action>
Create components/admin/ManualSaleModal.tsx:

1. Player selection:
   - Searchable dropdown or search input
   - Shows player card when selected
   - Display category, base_price, role

2. Team selection:
   - Dropdown of all teams
   - Shows team logo and name
   - Displays team's current purse

3. Sale price input:
   - Number input with currency formatting
   - Shows base_price as reference
   - Validation: cannot be less than base_price

4. Mode selection:
   - Radio buttons: Strict vs Override
   - Strict: "Enforce all validation rules"
   - Override: "Bypass validation (admin override)"
   - Warning message if Override selected

5. Validation display:
   - Shows errors if validation fails (strict mode)
   - Shows warnings in override mode
   - Real-time validation as inputs change

6. Confirm button:
   - "Record Manual Sale" button
   - Disabled if validation errors exist
   - Confirmation modal before finalizing
</action>
  <verify>
grep -r "export.*ManualSaleModal" components/admin/ManualSaleModal.tsx
</verify>
  <done>ManualSaleModal component created</done>
</task>

<task type="auto">
  <name>task 3: Integrate Manual Sale into Admin</name>
  <files>app/admin/page.tsx</files>
  <action>
Update app/admin/page.tsx:

1. Add Manual Sale button:
   - In header or top section
   - Icon: FilePlus or PlusCircle
   - Opens ManualSaleModal

2. Modal state:
   - showManualSale boolean
   - Open modal on button click

3. Server action import:
   - Import createManualSale, validateManualSale
   - Use in modal for validation and submission

4. Success feedback:
   - Toast/notification on successful manual sale
   - Refresh logs and player queue
</action>
  <verify>
grep -r "ManualSaleModal\|createManualSale\|showManualSale" app/admin/page.tsx
</verify>
  <done>Manual sale integrated into Admin</done>
</task>

</tasks>

<verification>
1. Manual sale modal opens from Admin
2. Player and team selection works
3. Strict mode shows validation errors
4. Override mode bypasses validation with warning
5. Manual sale creates log entry with is_manual = TRUE
6. Sale recorded in database correctly
</verification>

<success_criteria>
1. Admin can create manual sales by selecting player, team, amount, and mode
2. Strict mode enforces all validation rules (category limits, max bid, purse sufficiency) for manual sales
3. Override mode bypasses validation with warning for manual sales
4. Manual sale validation shows error to admin if rules would be violated
5. Manual sales are recorded in Log Entries with "Manual" tag
</success_criteria>

<output>
After completion, create `.planning/phases/phase-5/5-logging-manual-sales-02-SUMMARY.md`
</output>
