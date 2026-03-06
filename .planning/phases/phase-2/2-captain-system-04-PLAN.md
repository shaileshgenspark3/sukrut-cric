---
phase: 2-captain-system
plan: 04
type: execute
wave: 3
depends_on: [2-captain-system-01, 2-captain-system-02]
files_modified:
  - app/admin/page.tsx
  - lib/validation/teamComposition.ts
  - supabase/migrations/20260306000002_add_team_composition_functions.sql
autonomous: true
requirements: [RULE-06, LIFE-01, LIFE-02, LIFE-03]
user_setup: []

must_haves:
  truths:
    - "Team composition rules are enforced (Male: A+=1, A=3, B=4; Female: F=1; Total: 1 captain + 8 players)"
    - "Adding players to team fails if roster limit reached (max 9 total including captain)"
    - "Adding players to team fails if category limit reached for that category"
    - "Adding players to team fails if gender limit reached (Male max 7, Female max 2)"
    - "Sold players cannot be deployed to auction (filtered from Live Controller)"
    - "Unsold players can be deployed to auction (shown in Live Controller)"
    - "Captains cannot be selected for auction (filtered from Live Controller)"
  artifacts:
    - path: "lib/validation/teamComposition.ts"
      provides: "Team composition validation logic"
      exports: ["validateTeamComposition", "canAddPlayerToTeam", "isPlayerEligibleForAuction"]
    - path: "supabase/migrations/20260306000002_add_team_composition_functions.sql"
      provides: "Database functions for composition checks"
      contains: "check_team_composition, can_deploy_player_for_auction"
    - path: "app/admin/page.tsx"
      provides: "LiveController with auction eligibility filtering"
      contains: "filteredPlayers = players.filter.*is_captain.*is_sold"
  key_links:
    - from: "LiveController player deployment"
      to: "canDeployPlayerForAuction function"
      via: "filter logic"
      pattern: "players.filter.*is_captain.*is_sold"
    - from: "Captain assignment"
      to: "validateTeamComposition function"
      via: "server action validation"
      pattern: "validateTeamComposition.*before.*update"
</key_links>
---

<objective>
Enforce team composition rules and prevent ineligible players from auction deployment

Purpose: Validate team roster limits (category and gender), ensure sold players and captains cannot be auctioned, and provide clear error messages for rule violations
Output: Team composition validation system and auction eligibility filtering
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

# Phase 1 summaries for patterns (roster limit enforcement, error handling)
@.planning/phases/phase-1/1-foundation-03-SUMMARY.md

# Phase 2 Plan 1 for database schema
@.planning/phases/phase-2/2-captain-system-01-PLAN.md

# Phase 2 Plan 2 for captain assignment
@.planning/phases/phase-2/2-captain-system-02-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>task 1: Create database functions for team composition validation</name>
  <files>supabase/migrations/20260306000002_add_team_composition_functions.sql</files>
<action>
Create `supabase/migrations/20260306000002_add_team_composition_functions.sql` with:

1. check_team_composition function:
   ```sql
   CREATE OR REPLACE FUNCTION check_team_composition(
     p_team_id UUID
   ) RETURNS JSON AS $$
   DECLARE
     v_result JSONB := '{"valid": true}'::jsonb;
     v_roster_count INTEGER;
     v_male_count INTEGER;
     v_female_count INTEGER;
     v_a_plus_count INTEGER;
     v_a_count INTEGER;
     v_b_count INTEGER;
     v_f_count INTEGER;
     v_captain_count INTEGER;
   BEGIN
     -- Count total roster (excluding captains)
     SELECT COUNT(*) INTO v_roster_count
     FROM players
     WHERE sold_to_team_id = p_team_id AND is_captain = FALSE;

     -- Count by gender
     SELECT
       COUNT(*) FILTER (WHERE gender = 'Male') INTO v_male_count,
       COUNT(*) FILTER (WHERE gender = 'Female') INTO v_female_count
     FROM players
     WHERE sold_to_team_id = p_team_id AND is_captain = FALSE;

     -- Count by category
     SELECT
       COUNT(*) FILTER (WHERE category = 'A+') INTO v_a_plus_count,
       COUNT(*) FILTER (WHERE category = 'A') INTO v_a_count,
       COUNT(*) FILTER (WHERE category = 'B') INTO v_b_count,
       COUNT(*) FILTER (WHERE category = 'F') INTO v_f_count
     FROM players
     WHERE sold_to_team_id = p_team_id AND is_captain = FALSE;

     -- Count captains
     SELECT COUNT(*) INTO v_captain_count
     FROM players
     WHERE captain_team_id = p_team_id;

     -- Validate roster limits
     IF v_roster_count >= 8 THEN
       v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
       v_result := jsonb_set(v_result, '{reason}', '"Roster full (max 8 players excluding captain)"'::jsonb);
       RETURN v_result;
     END IF;

     IF v_male_count >= 7 THEN
       v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
       v_result := jsonb_set(v_result, '{reason}', '"Male roster full (max 7)"'::jsonb);
       RETURN v_result;
     END IF;

     IF v_female_count >= 2 THEN
       v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
       v_result := jsonb_set(v_result, '{reason}', '"Female roster full (max 2)"'::jsonb);
       RETURN v_result;
     END IF;

     IF v_a_plus_count >= 1 THEN
       v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
       v_result := jsonb_set(v_result, '{reason}', '"A+ category full (max 1)"'::jsonb);
       RETURN v_result;
     END IF;

     IF v_a_count >= 3 THEN
       v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
       v_result := jsonb_set(v_result, '{reason}', '"A category full (max 3)"'::jsonb);
       RETURN v_result;
     END IF;

     IF v_b_count >= 4 THEN
       v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
       v_result := jsonb_set(v_result, '{reason}', '"B category full (max 4)"'::jsonb);
       RETURN v_result;
     END IF;

     IF v_f_count >= 1 THEN
       v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
       v_result := jsonb_set(v_result, '{reason}', '"F category full (max 1)"'::jsonb);
       RETURN v_result;
     END IF;

     RETURN v_result;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. can_deploy_player_for_auction function:
   ```sql
   CREATE OR REPLACE FUNCTION can_deploy_player_for_auction(
     p_player_id UUID
   ) RETURNS JSON AS $$
   DECLARE
     v_player players%ROWTYPE;
     v_result JSONB := '{"can_deploy": true}'::jsonb;
   BEGIN
     -- Get player info
     SELECT * INTO v_player FROM players WHERE id = p_player_id;

     -- Check if captain
     IF v_player.is_captain = TRUE THEN
       v_result := jsonb_set(v_result, '{can_deploy}', 'false'::jsonb);
       v_result := jsonb_set(v_result, '{reason}', '"Captains cannot be deployed to auction"'::jsonb);
       RETURN v_result;
     END IF;

     -- Check if sold
     IF v_player.is_sold = TRUE THEN
       v_result := jsonb_set(v_result, '{can_deploy}', 'false'::jsonb);
       v_result := jsonb_set(v_result, '{reason}', '"Player already sold"'::jsonb);
       RETURN v_result;
     END IF;

     RETURN v_result;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. Add comments for documentation
</action>
<verify>
<automated>cat supabase/migrations/20260306000002_add_team_composition_functions.sql 2>/dev/null | grep -q "CREATE OR REPLACE FUNCTION check_team_composition" && echo "check_team_composition function exists" || echo "MISSING: check_team_composition function"</automated>
<automated>cat supabase/migrations/20260306000002_add_team_composition_functions.sql 2>/dev/null | grep -q "CREATE OR REPLACE FUNCTION can_deploy_player_for_auction" && echo "can_deploy_player_for_auction function exists" || echo "MISSING: can_deploy_player_for_auction function"</automated>
</verify>
<done>
  - check_team_composition function validates all roster limits
  - can_deploy_player_for_auction function checks captain and sold status
  - Functions return JSON with valid flag and error reason
  - Functions handle edge cases (full roster, category limits, gender limits)
</done>
</task>

<task type="auto">
  <name>task 2: Create team composition validation utilities</name>
<files>lib/validation/teamComposition.ts</files>
<action>
Create `lib/validation/teamComposition.ts` with:

1. validateTeamComposition function:
   ```typescript
   import { supabase } from "@/lib/supabase";

   export interface TeamCompositionResult {
     valid: boolean;
     reason?: string;
     roster: {
       total: number;
       male: number;
       female: number;
       byCategory: {
         "A+": number;
         A: number;
         B: number;
         F: number;
       };
     };
   }

   export async function validateTeamComposition(teamId: string): Promise<TeamCompositionResult> {
     // Get roster composition
     const { data: roster } = await supabase
       .from("players")
       .select("gender, category")
       .eq("sold_to_team_id", teamId)
       .eq("is_captain", false);

     if (!roster) {
       throw new Error("Failed to fetch roster");
     }

     // Calculate composition
     const composition = {
       total: roster.length,
       male: roster.filter(p => p.gender === "Male").length,
       female: roster.filter(p => p.gender === "Female").length,
       byCategory: {
         "A+": roster.filter(p => p.category === "A+").length,
         A: roster.filter(p => p.category === "A").length,
         B: roster.filter(p => p.category === "B").length,
         F: roster.filter(p => p.category === "F").length,
       }
     };

     // Validate limits
     if (composition.total >= 8) {
       return { valid: false, reason: "Roster full (max 8 players excluding captain)", roster: composition };
     }

     if (composition.male >= 7) {
       return { valid: false, reason: "Male roster full (max 7)", roster: composition };
     }

     if (composition.female >= 2) {
       return { valid: false, reason: "Female roster full (max 2)", roster: composition };
     }

     if (composition.byCategory["A+"] >= 1) {
       return { valid: false, reason: "A+ category full (max 1)", roster: composition };
     }

     if (composition.byCategory.A >= 3) {
       return { valid: false, reason: "A category full (max 3)", roster: composition };
     }

     if (composition.byCategory.B >= 4) {
       return { valid: false, reason: "B category full (max 4)", roster: composition };
     }

     if (composition.byCategory.F >= 1) {
       return { valid: false, reason: "F category full (max 1)", roster: composition };
     }

     return { valid: true, roster: composition };
   }
   ```

2. canAddPlayerToTeam function:
   ```typescript
   export async function canAddPlayerToTeam(teamId: string, player: { gender: string; category: string }): Promise<boolean> {
     const validation = await validateTeamComposition(teamId);

     if (!validation.valid) {
       // Check if adding this specific player would violate rules
       const wouldExceedTotal = validation.roster.total + 1 > 8;
       const wouldExceedMale = player.gender === "Male" && validation.roster.male >= 7;
       const wouldExceedFemale = player.gender === "Female" && validation.roster.female >= 2;
       const wouldExceedAPlus = player.category === "A+" && validation.roster.byCategory["A+"] >= 1;
       const wouldExceedA = player.category === "A" && validation.roster.byCategory.A >= 3;
       const wouldExceedB = player.category === "B" && validation.roster.byCategory.B >= 4;
       const wouldExceedF = player.category === "F" && validation.roster.byCategory.F >= 1;

       if (wouldExceedTotal || wouldExceedMale || wouldExceedFemale ||
           wouldExceedAPlus || wouldExceedA || wouldExceedB || wouldExceedF) {
         return false;
       }
     }

     return true;
   }
   ```

3. isPlayerEligibleForAuction function:
   ```typescript
   export async function isPlayerEligibleForAuction(playerId: string): Promise<boolean> {
     const { data: player } = await supabase
       .from("players")
       .select("is_captain, is_sold")
       .eq("id", playerId)
       .single();

     if (!player) {
       throw new Error("Player not found");
     }

     // Captains and sold players are not eligible
     return !player.is_captain && !player.is_sold;
   }
   ```

4. Export all functions and interfaces
</action>
<verify>
<automated>cat lib/validation/teamComposition.ts 2>/dev/null | grep -q "export async function validateTeamComposition" && echo "validateTeamComposition function exists" || echo "MISSING: validateTeamComposition function"</automated>
<automated>cat lib/validation/teamComposition.ts 2>/dev/null | grep -q "export async function canAddPlayerToTeam" && echo "canAddPlayerToTeam function exists" || echo "MISSING: canAddPlayerToTeam function"</automated>
<automated>cat lib/validation/teamComposition.ts 2>/dev/null | grep -q "export async function isPlayerEligibleForAuction" && echo "isPlayerEligibleForAuction function exists" || echo "MISSING: isPlayerEligibleForAuction function"</automated>
</verify>
<done>
  - validateTeamComposition checks all roster limits
  - canAddPlayerToTeam validates if specific player can be added
  - isPlayerEligibleForAuction checks captain and sold status
  - Functions return clear validation results
  - Error handling for missing data
</done>
</task>

<task type="auto">
  <name>task 3: Update LiveController to filter ineligible players</name>
<files>app/admin/page.tsx</files>
<action>
In `app/admin/page.tsx` LiveControllerTab component:

1. Import validation functions:
   ```typescript
   import { isPlayerEligibleForAuction } from "@/lib/validation/teamComposition";
   ```

2. Add state for eligible players:
   ```typescript
   const [eligiblePlayers, setEligiblePlayers] = useState<any[]>([]);
   ```

3. Add effect to filter eligible players:
   ```typescript
   useEffect(() => {
     const filterEligiblePlayers = async () => {
       if (!players) return;

       const eligible = await Promise.all(
         players.map(async (player: any) => {
           const isEligible = await isPlayerEligibleForAuction(player.id);
           return { ...player, isEligible };
         })
       );

       setEligiblePlayers(eligible.filter((p: any) => p.isEligible));
     };

     filterEligiblePlayers();
   }, [players]);
   ```

4. Update player deployment dropdown to use eligiblePlayers:
   - Replace `players` with `eligiblePlayers` in dropdown options
   - Update search filter to work on eligiblePlayers instead of players
   - Update category/role/gender filters to work on eligiblePlayers

5. Add visual indicator for ineligible players (optional):
   - Show "Captains and sold players are not available for auction" text
   - Display count of available players vs total players

6. Update search/filter logic:
   - Ensure search works on eligible players list
   - Keep existing filter logic (category, role, gender)

Note: For better performance, consider moving this filtering to server-side or caching results. For now, client-side filtering is acceptable.
</action>
<verify>
<automated>grep -q "eligiblePlayers" app/admin/page.tsx && echo "eligiblePlayers state exists" || echo "MISSING: eligiblePlayers state"</automated>
<automated>grep -q "isPlayerEligibleForAuction" app/admin/page.tsx && echo "isPlayerEligibleForAuction imported" || echo "MISSING: isPlayerEligibleForAuction import"</automated>
</verify>
<done>
  - LiveController filters out captains from player selection
  - LiveController filters out sold players from player selection
  - Only eligible players appear in deployment dropdown
  - Search and filter functionality works on eligible players
  - Visual indicator shows number of available players
</done>
</task>

<task type="auto">
  <name>task 4: Add team composition validation to captain assignment</name>
<files>lib/actions/captains.ts</files>
<action>
Update `lib/actions/captains.ts` assignCaptain function to validate team composition:

1. Import validation:
   ```typescript
   import { validateTeamComposition, canAddPlayerToTeam } from "@/lib/validation/teamComposition";
   ```

2. Add validation before updating player:
   ```typescript
   // Check if adding this captain would violate roster limits
   const canAdd = await canAddPlayerToTeam(teamId, {
     gender: player.gender,
     category: player.category
   });

   if (!canAdd) {
     const validation = await validateTeamComposition(teamId);
     throw new Error(`Cannot add captain: ${validation.reason}`);
   }
   ```

3. Place this validation before the UPDATE players statement

This ensures that assigning a captain respects the 1 captain + 8 players total limit (captain counts as +1 to team size).
</action>
<verify>
<automated>grep -q "validateTeamComposition\|canAddPlayerToTeam" lib/actions/captains.ts && echo "Team composition validation imported" || echo "MISSING: Team composition validation import"</automated>
<automated>grep -q "Cannot add captain" lib/actions/captains.ts && echo "Captain assignment validation exists" || echo "MISSING: Captain assignment validation"</automated>
</verify>
<done>
  - Captain assignment validates team composition
  - Captains respect roster limits when assigned
  - Clear error message when composition rules violated
  - Validation happens before database update
</done>
</task>

</tasks>

<verification>
- Team composition rules enforced for all operations
- Roster limit validated before player addition (max 8 + 1 captain = 9 total)
- Category limits enforced (A+=1, A=3, B=4, F=1)
- Gender limits enforced (Male max 7, Female max 2)
- Captains filtered from Live Controller player selection
- Sold players filtered from Live Controller player selection
- Only eligible players can be deployed to auction
- Unsold players appear in Live Controller
- Error messages provide clear reasons for violations
- Database functions validate composition on server side
- Client-side validation provides immediate feedback
</verification>

<success_criteria>
- Adding players to team fails if roster limit reached
- Adding players to team fails if category limit reached
- Adding players to team fails if gender limit reached
- Error messages explain which limit was violated
- Captains cannot be selected in Live Controller
- Sold players cannot be selected in Live Controller
- Unsold players can be selected in Live Controller
- Team composition validation works for captain assignment
- All validation persists to database
- Server-side functions prevent invalid database states
</success_criteria>

<output>
After completion, create `.planning/phases/phase-2/2-captain-system-04-SUMMARY.md`
</output>
