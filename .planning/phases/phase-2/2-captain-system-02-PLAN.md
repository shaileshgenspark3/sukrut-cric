---
phase: 2-captain-system
plan: 02
type: execute
wave: 2
depends_on: [2-captain-system-01]
files_modified:
  - app/admin/page.tsx
  - lib/actions/captains.ts
autonomous: true
requirements: [CAPT-01, CAPT-02, CAPT-04, LIFE-03]
user_setup: []

must_haves:
  truths:
    - "Admin can view Captain Selection tab with all teams listed"
    - "Each team has dropdown to select captain from available players"
    - "Assigning captain marks player with is_captain=true and links to team"
    - "Captain is automatically added to team roster with sold_price=0"
    - "Assigned captains are removed from available players dropdown for other teams"
    - "Captains cannot be selected for auction (filtered from Live Controller)"
  artifacts:
    - path: "app/admin/page.tsx"
      provides: "CaptainSelectionTab component and tab navigation"
      contains: "CaptainSelectionTab, activeTab === 'captain'"
    - path: "lib/actions/captains.ts"
      provides: "Captain assignment server actions"
      exports: ["assignCaptain", "removeCaptain"]
  key_links:
    - from: "CaptainSelectionTab"
      to: "assignCaptain action"
      via: "form submission"
      pattern: "assignCaptain.*onSubmit"
    - from: "assignCaptain action"
      to: "database"
      via: "Supabase update transaction"
      pattern: "supabase.from.*players.*update.*is_captain.*true"
</key_links>
---

<objective>
Create Captain Selection UI with dropdown assignment and automatic roster addition

Purpose: Enable admins to assign captains to teams from a dropdown of available players, with automatic roster addition and database persistence
Output: CaptainSelectionTab component with captain assignment functionality
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/research/ARCHITECTURE.md
@.planning/research/STACK.md

# Phase 1 summaries for patterns (modal structure, query invalidation)
@.planning/phases/phase-1/1-foundation-01-SUMMARY.md

# Phase 2 Plan 1 for database schema
@.planning/phases/phase-2/2-captain-system-01-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>task 1: Create CaptainSelectionTab component in admin dashboard</name>
  <files>app/admin/page.tsx</files>
  <action>
In `app/admin/page.tsx`:

1. Add "captain" to tab options after "players" and before "rules":
   - Add to tabs array: { id: "captain", label: "Captain Selection" }

2. Add CaptainSelectionTab to conditional rendering:
   - {activeTab === "captain" && <CaptainSelectionTab teams={teams} players={players} />}

3. Create CaptainSelectionTab component with:
   - Props: teams array, players array
   - Query client for invalidation: const queryClient = useQueryClient();
   - State for selections: useState for selectedCaptainId per team (use object keyed by teamId)
   - Filter available players: players where is_captain=false AND is_sold=false
   - Filter by gender for teams (male teams get male players, female teams get female players)

4. Component structure:
   - Header with title and description
   - Grid layout (1 column mobile, 2 columns tablet, 3 columns desktop)
   - Card for each team showing:
     - Team name
     - Current captain name (if assigned)
     - Captain category (if assigned)
     - Dropdown of available players to assign as captain
     - "Assign Captain" button (disabled if no selection)
     - "Remove Captain" button (only shows if captain assigned)

5. Player dropdown should show:
   - Player name
   - Player category (A+, A, B, F)
   - Player role (Batsman, Bowler, etc.)
   - Gender

6. Styling: Match existing admin dashboard aesthetic (glass cards, gold accents, slate colors)
   - Use glass-card class for team cards
   - Use bg-gold for primary buttons
   - Use text-destructive for remove button

7. Error handling: Alert on assignment failure with clear error message
8. Success feedback: Alert on successful assignment/removal

Reference existing RulesTab and PlayersTab for styling patterns.
  </action>
  <verify>
    <automated>grep -q "CaptainSelectionTab" app/admin/page.tsx && echo "CaptainSelectionTab component exists" || echo "MISSING: CaptainSelectionTab component"</automated>
    <automated>grep -q 'activeTab === "captain"' app/admin/page.tsx && echo "Captain tab condition exists" || echo "MISSING: Captain tab condition"</automated>
  </verify>
  <done>
    - Captain Selection tab added to admin dashboard
    - CaptainSelectionTab component created with team cards
    - Player dropdowns show available non-captain players
    - UI matches existing admin dashboard aesthetic
  </done>
</task>

<task type="auto">
  <name>task 2: Create captain assignment server actions</name>
  <files>lib/actions/captains.ts</files>
  <action>
Create `lib/actions/captains.ts` with:

1. assignCaptain function:
   ```typescript
   export async function assignCaptain(teamId: string, playerId: string) {
     const { data: player } = await supabase
       .from("players")
       .select("category, gender, name")
       .eq("id", playerId)
       .single();

     const { data: team } = await supabase
       .from("teams")
       .select("team_name")
       .eq("id", teamId)
       .single();

     // Calculate captain deduction based on category
     const deduction = player.category === 'A+' ? 500000 :
                      player.category === 'A' ? 200000 : 0;

     // Start transaction-like sequence
     // 1. Update player to mark as captain and link to team
     await supabase
       .from("players")
       .update({
         is_captain: true,
         captain_team_id: teamId,
         sold_to_team_id: teamId,  // Add to roster
         sold_price: 0,  // Captains are free
         is_sold: true  // Mark as sold (cannot be auctioned)
       })
       .eq("id", playerId);

     // 2. Update team to link captain
     await supabase
       .from("teams")
       .update({ captain_player_id: playerId })
       .eq("id", teamId);

     // 3. Update auction_rules to deduct captain amount and update current_purse
     const { data: rules } = await supabase
       .from("auction_rules")
       .select("current_purse")
       .eq("team_id", teamId)
       .single();

     await supabase
       .from("auction_rules")
       .update({
         captain_deduction: deduction,
         current_purse: rules.current_purse - deduction
       })
       .eq("team_id", teamId);

     revalidatePath("/admin");
     revalidatePath("/captain");

     return { success: true };
   }
   ```

2. removeCaptain function:
   ```typescript
   export async function removeCaptain(teamId: string) {
     // Get current captain info
     const { data: team } = await supabase
       .from("teams")
       .select("captain_player_id")
       .eq("id", teamId)
       .single();

     if (!team.captain_player_id) return { success: true };

     const { data: player } = await supabase
       .from("players")
       .select("category")
       .eq("id", team.captain_player_id)
       .single();

     // Calculate refund amount
     const refund = player.category === 'A+' ? 500000 :
                    player.category === 'A' ? 200000 : 0;

     // Restore player status
     await supabase
       .from("players")
       .update({
         is_captain: false,
         captain_team_id: null,
         sold_to_team_id: null,  // Remove from roster
         sold_price: null,
         is_sold: false
       })
       .eq("id", team.captain_player_id);

     // Update team
     await supabase
       .from("teams")
       .update({ captain_player_id: null })
       .eq("id", teamId);

     // Restore purse
     const { data: rules } = await supabase
       .from("auction_rules")
       .select("current_purse")
       .eq("team_id", teamId)
       .single();

     await supabase
       .from("auction_rules")
       .update({
         captain_deduction: 0,
         current_purse: rules.current_purse + refund
       })
       .eq("team_id", teamId);

     revalidatePath("/admin");
     revalidatePath("/captain");

     return { success: true };
   }
   ```

3. Import supabase from @/lib/supabase
4. Export both functions
  </action>
  <verify>
    <automated>cat lib/actions/captains.ts 2>/dev/null | grep -q "export async function assignCaptain" && echo "assignCaptain function exists" || echo "MISSING: assignCaptain function"</automated>
    <automated>cat lib/actions/captains.ts 2>/dev/null | grep -q "export async function removeCaptain" && echo "removeCaptain function exists" || echo "MISSING: removeCaptain function"</automated>
  </verify>
  <done>
    - assignCaptain function marks player as captain and links to team
    - assignCaptain automatically deducts category-based amount from purse
    - assignCaptain adds captain to roster with sold_price=0
    - removeCaptain function restores player and team state
    - removeCaptain refunds captain deduction to purse
  </done>
</task>

<task type="auto">
  <name>task 3: Connect CaptainSelectionTab to server actions</name>
  <files>app/admin/page.tsx</files>
  <action>
In CaptainSelectionTab component in `app/admin/page.tsx`:

1. Import actions: import { assignCaptain, removeCaptain } from "@/lib/actions/captains";

2. Add handleAssignCaptain function:
   ```typescript
   const handleAssignCaptain = async (teamId: string, playerId: string) => {
     try {
       const result = await assignCaptain(teamId, playerId);
       if (result.success) {
         queryClient.invalidateQueries({ queryKey: ["teams"] });
         queryClient.invalidateQueries({ queryKey: ["players"] });
         queryClient.invalidateQueries({ queryKey: ["rules"] });
         alert("Captain assigned successfully!");
       }
     } catch (err: any) {
       alert("Error assigning captain: " + err.message);
     }
   };
   ```

3. Add handleRemoveCaptain function:
   ```typescript
   const handleRemoveCaptain = async (teamId: string) => {
     if (!confirm("Are you sure you want to remove this captain?")) return;
     try {
       const result = await removeCaptain(teamId);
       if (result.success) {
         queryClient.invalidateQueries({ queryKey: ["teams"] });
         queryClient.invalidateQueries({ queryKey: ["players"] });
         queryClient.invalidateQueries({ queryKey: ["rules"] });
         alert("Captain removed successfully!");
       }
     } catch (err: any) {
       alert("Error removing captain: " + err.message);
     }
   };
   ```

4. Wire up "Assign Captain" button:
   - onClick={() => handleAssignCaptain(team.id, selectedCaptainId[team.id])}
   - Disable if no player selected

5. Wire up "Remove Captain" button:
   - onClick={() => handleRemoveCaptain(team.id)}
   - Only show if team.captain_player_id exists

6. Update filtered players list on re-render to exclude newly assigned captains
7. Show loading state during API calls (optional: add loading button state)
  </action>
  <verify>
    <automated>grep -q "handleAssignCaptain" app/admin/page.tsx && echo "handleAssignCaptain function exists" || echo "MISSING: handleAssignCaptain function"</automated>
    <automated>grep -q "handleRemoveCaptain" app/admin/page.tsx && echo "handleRemoveCaptain function exists" || echo "MISSING: handleRemoveCaptain function"</automated>
  </verify>
  <done>
    - Captain assignment connected to server action
    - Captain removal connected to server action
    - Query invalidation updates UI after changes
    - Error handling with user feedback
    - Confirmation dialog for captain removal
  </done>
</task>

</tasks>

<verification>
- Captain Selection tab appears in admin dashboard
- Each team has captain assignment dropdown
- Available players list excludes captains and sold players
- Assigning captain marks is_captain=true and links to team
- Captain is added to roster with sold_price=0 and is_sold=true
- Category-based purse deduction applied (A+=5,00,000, A=2,00,000, B/F=0)
- Captain removal restores player and team state
- All changes persist to database
</verification>

<success_criteria>
- Admin can assign captains to teams from dropdown
- Assigned captains are marked in database (is_captain=true)
- Captains appear in team roster with sold_price=0
- Captain category deduction is applied to team purse (A+=5L, A=2L, B/F=0)
- Removing captain restores player status and team purse
- Assigned captains no longer appear in player dropdowns
- UI updates immediately after assignment/removal
- Error handling provides clear feedback to admin
</success_criteria>

<output>
After completion, create `.planning/phases/phase-2/2-captain-system-02-SUMMARY.md`
</output>
