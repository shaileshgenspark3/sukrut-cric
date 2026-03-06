---
phase: 1-foundation
plan: 01
type: execute
wave: 1
depends_on: []
files_modified: [app/admin/page.tsx]
autonomous: true
requirements: [BUG-01, BUG-02]
user_setup: []

must_haves:
  truths:
    - "Admin can click Edit button on a team in Overview tab and modal opens with pre-filled data"
    - "Admin can save team/captain edits and changes persist to database"
    - "Admin can click Delete button on a team, confirm in modal, and team is removed"
    - "Admin can click Edit button on a player in Players tab and modal opens with pre-filled data"
    - "Admin can save player edits and changes persist to database"
    - "Admin can click Delete button on an unsold player, confirm, and player is removed"
  artifacts:
    - path: "app/admin/page.tsx"
      provides: "Admin dashboard with working edit/delete modals"
      min_lines: 2000
      contains: "setShowEditCaptain(true)", "setShowEditPlayer(true)", "setDeleteConfirm"
    - path: "components/admin/EditCaptainModal.tsx"
      provides: "Captain/team editing modal component"
      exports: ["EditCaptainModal"]
    - path: "components/admin/EditPlayerModal.tsx"
      provides: "Player editing modal component"
      exports: ["EditPlayerModal"]
    - path: "components/admin/DeleteConfirmationModal.tsx"
      provides: "Delete confirmation modal for teams and players"
      exports: ["DeleteConfirmationModal"]
  key_links:
    - from: "app/admin/page.tsx"
      to: "components/admin/EditCaptainModal"
      via: "setShowEditCaptain(true) when Edit button clicked"
      pattern: "onClick.*setShowEditCaptain\(true\)"
    - from: "app/admin/page.tsx"
      to: "components/admin/EditPlayerModal"
      via: "setShowEditPlayer(true) when Edit button clicked"
      pattern: "onClick.*setShowEditPlayer\(true\)"
    - from: "app/admin/page.tsx"
      to: "components/admin/DeleteConfirmationModal"
      via: "setDeleteConfirm when Delete button clicked"
      pattern: "onClick.*setDeleteConfirm"
---

<objective>
Fix Edit and Delete buttons in Admin Overview (teams) and Players tabs to open modals and persist changes to database.

Purpose: Currently Edit/Delete buttons exist in the UI but are not wired to modal state or deletion logic, preventing admins from managing teams and players.

Output: Working edit and delete functionality for teams and players with proper modal interactions and database persistence.
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@app/admin/page.tsx
@lib/supabase.ts
</context>

<tasks>

<task type="auto">
  <name>Wire up Edit/Delete modals in AdminDashboard component</name>
  <files>app/admin/page.tsx</files>
  <action>
    1. Add modal state handlers in AdminDashboard component:
       - Add setShowEditCaptain, setShowEditPlayer, handleDeleteConfirm functions
       - Pass these handlers to OverviewTab and PlayersTab via modalProps

    2. In OverviewTab, connect Edit button to open EditCaptainModal:
       ```typescript
       <button
         onClick={() => {
           setSelectedCaptain(t);
           modalProps.setShowEditCaptain?.(true);
         }}
         className="..."
       >
         <Edit className="w-4 h-4" />
       </button>
       ```

    3. In OverviewTab, connect Delete button to setDeleteConfirm:
       ```typescript
       <button
         onClick={() => modalProps.setDeleteConfirm?.({ type: 'captain', id: t.id, name: t.team_name })}
         className="..."
       >
         <Trash2 className="w-4 h-4" />
       </button>
       ```

    4. In PlayersTab, connect Edit button to open EditPlayerModal:
       ```typescript
       <button
         onClick={() => {
           setSelectedPlayer(p);
           modalProps.setShowEditPlayer?.(true);
         }}
         className="..."
       >
         <Edit className="w-4 h-4" />
       </button>
       ```

    5. In PlayersTab, connect Delete button to setDeleteConfirm (already disabled for sold players):
       ```typescript
       <button
         onClick={() => !p.is_sold && modalProps.setDeleteConfirm?.({ type: 'player', id: p.id, name: p.name })}
         disabled={p.is_sold}
         className="..."
       >
         <Trash2 className="w-4 h-4" />
       </button>
       ```

    6. Implement handleDeleteConfirm function to execute deletions:
       ```typescript
       const handleDeleteConfirm = async () => {
         if (!deleteConfirm) return;
         setLoading(true);

         try {
           if (deleteConfirm.type === 'captain') {
             // Delete auction rules first (foreign key)
             await supabase.from('auction_rules').delete().eq('team_id', deleteConfirm.id);
             // Delete team
             await supabase.from('teams').delete().eq('id', deleteConfirm.id);
             // Note: Auth user is not deleted (security consideration)
           } else if (deleteConfirm.type === 'player') {
             await supabase.from('players').delete().eq('id', deleteConfirm.id);
           }
           queryClient.invalidateQueries({ queryKey: ['teams'] });
           queryClient.invalidateQueries({ queryKey: ['players'] });
           setDeleteConfirm(null);
         } catch (err: any) {
           alert('Delete failed: ' + err.message);
         } finally {
           setLoading(false);
         }
       };
       ```

    7. Add modal rendering in AdminDashboard component (before closing div):
       ```typescript
       <EditCaptainModal
         show={showEditCaptain}
         onClose={() => setShowEditCaptain(false)}
         captain={selectedCaptain}
         onSuccess={() => {
           queryClient.invalidateQueries({ queryKey: ['teams'] });
           setSelectedCaptain(null);
         }}
       />

       <EditPlayerModal
         show={showEditPlayer}
         onClose={() => setShowEditPlayer(false)}
         player={selectedPlayer}
         onSuccess={() => {
           queryClient.invalidateQueries({ queryKey: ['players'] });
           setSelectedPlayer(null);
         }}
       />

       <ConfirmDeleteModal
         show={!!deleteConfirm}
         onClose={() => setDeleteConfirm(null)}
         onConfirm={handleDeleteConfirm}
         type={deleteConfirm?.type}
         name={deleteConfirm?.name}
       />
       ```

    Do NOT refactor the existing modal components - they already have the correct form structure and validation. Only connect the button handlers to modal state.
  </action>
  <verify>
    <automated>npm run build && grep -n "setShowEditCaptain\|setShowEditPlayer\|setDeleteConfirm" app/admin/page.tsx | head -20</automated>
    <manual>Test Edit button on a team - modal should open with pre-filled data. Save changes and verify database is updated.</manual>
    <sampling_rate>run after task commits, before next task begins</sampling_rate>
  </verify>
  <done>Admin can edit team/captain details and delete teams and unsold players from the UI without errors</done>
</task>

</tasks>

<verification>
- All Edit buttons in Overview tab open EditCaptainModal with correct data pre-filled
- All Edit buttons in Players tab open EditPlayerModal with correct data pre-filled
- All Delete buttons trigger confirmation modal
- Deleting a team removes it from database (cascade to auction_rules)
- Deleting an unsold player removes it from database
- Sold players cannot be deleted (button disabled)
- All changes reflect immediately in UI (TanStack Query invalidation)
</verification>

<success_criteria>
1. Admin can edit team name, captain name, phone number in Overview tab without errors
2. Admin can edit all player fields in Players tab without errors
3. Admin can delete teams and unsold players with confirmation dialog
4. All edit and delete operations persist to Supabase database
5. UI updates immediately after operations without page refresh
</success_criteria>

<output>
After completion, create `.planning/phases/phase-1/1-foundation-01-SUMMARY.md`
</output>
