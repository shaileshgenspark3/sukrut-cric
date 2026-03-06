---
phase: 1-foundation
plan: 02
type: execute
wave: 1
depends_on: []
files_modified: [app/admin/page.tsx]
autonomous: true
requirements: [DATA-01, DATA-02, BUG-03]
user_setup: []

must_haves:
  truths:
    - "Admin can click 'Erase All Players' button in Players tab and see confirmation dialog"
    - "Admin confirms and all players are deleted from database"
    - "Admin can upload CSV file with all player fields and all fields are correctly imported"
    - "CSV import validates required fields and shows error messages for invalid rows"
    - "Admin updates global purse to 30,00,000, clicks 'Apply Global', and all teams' starting_purse are updated"
  artifacts:
    - path: "app/admin/page.tsx"
      provides: "Players tab with erase all functionality and enhanced CSV import"
      min_lines: 2100
      contains: "eraseAllPlayers", "importPlayersCSV", "updateGlobalPurse"
    - path: "lib/csv/playerSchema.ts"
      provides: "Zod schema for player CSV validation"
      exports: ["PlayerCSVSchema"]
  key_links:
    - from: "app/admin/page.tsx"
      to: "supabase.from('players').delete()"
      via: "eraseAllPlayers function called from 'Erase All Players' button"
      pattern: "onDelete.*eraseAllPlayers"
    - from: "app/admin/page.tsx"
      to: "lib/csv/playerSchema.ts"
      via: "Zod schema validation in CSV import handler"
      pattern: "PlayerCSVSchema.parse.*row"
    - from: "app/admin/page.tsx"
      to: "supabase.from('auction_rules').update()"
      via: "updateGlobalPurse propagates to all teams"
      pattern: "updateGlobalPurse.*map.*team_id"
</context>

<objective>
Add CSV bulk import for players, erase all players functionality, and fix global purse update to propagate to all teams.

Purpose: DATA-01 requires CSV import for all player fields with validation. DATA-02 requires erase all players button. BUG-03 requires global purse update to persist and propagate to team starting purses (current 30,000 needs to be 30,00,000).

Output: Working CSV import with validation, erase all players with confirmation, and global purse that updates all team starting purses.
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
@.planning/research/STACK.md
</context>

<tasks>

<task type="auto">
  <name>Add Erase All Players functionality and enhance CSV import</name>
  <files>app/admin/page.tsx</files>
  <action>
    1. Create Zod schema for CSV validation (create lib/csv/playerSchema.ts):
       ```typescript
       import { z } from 'zod';

       export const PlayerCSVSchema = z.object({
         'Name': z.string().min(1, 'Name is required'),
         'Classifications': z.enum(['A+', 'A', 'B', 'C', 'F']).default('B'),
         'Age': z.coerce.number().int().min(15).max(50).default(25),
         'Height': z.string().optional(),
         'Handy': z.enum(['Right-hand', 'Left-hand', 'Right-arm', 'Left-arm']).default('Right-hand'),
         'Type': z.enum(['Top-order', 'Middle-order', 'Opener', 'Finisher']).default('Top-order'),
         'Earlier Seasons': z.string().optional(),
         'Achievements': z.string().optional(),
         'Special Remarks': z.string().optional(),
         'Combat Role': z.enum(['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper']).default('Batsman'),
         'Variant': z.enum(['Male', 'Female']).default('Male'),
         'Market Base': z.coerce.number().int().min(100).default(1000)
       });

       export type PlayerCSVRow = z.infer<typeof PlayerCSVSchema>;
       ```

    2. In PlayersTab component, add eraseAllPlayers state and handler:
       ```typescript
       const [showEraseConfirm, setShowEraseConfirm] = useState(false);
       const [erasing, setErasing] = useState(false);

       const eraseAllPlayers = async () => {
         setErasing(true);
         try {
           const { error } = await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
           if (error) throw error;
           queryClient.invalidateQueries({ queryKey: ['players'] });
           setShowEraseConfirm(false);
           alert('All players erased successfully!');
         } catch (err: any) {
           alert('Error erasing players: ' + err.message);
         } finally {
           setErasing(false);
         }
       };
       ```

    3. Add "Erase All Players" button in PlayersTab toolbar (after Export CSV button):
       ```typescript
       <button
         onClick={() => setShowEraseConfirm(true)}
         className="glass px-4 py-2 rounded-xl text-[10px] font-black tracking-widest text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
       >
         <Trash2 className="w-4 h-4" />
         ERASE ALL
       </button>
       ```

    4. Add EraseAllConfirmationModal in PlayersTab:
       ```typescript
       function EraseAllConfirmationModal({ show, onClose, onConfirm, loading }: any) {
         if (!show) return null;
         return (
           <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
             <motion.div
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="glass-card bg-slate-900 border border-destructive/20 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
             >
               <div className="text-center">
                 <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-destructive/20">
                   <Trash2 className="w-8 h-8 text-destructive" />
                 </div>
                 <h3 className="font-display text-2xl font-black text-white tracking-tight mb-2">CONFIRM ERASE ALL</h3>
                 <p className="text-slate-400 font-sans mb-6">
                   This will <strong>permanently delete all players</strong> from the database.<br/>
                   This action cannot be undone!
                 </p>
                 <div className="flex gap-4">
                   <button
                     onClick={onClose}
                     disabled={loading}
                     className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest disabled:opacity-50"
                   >
                     CANCEL
                   </button>
                   <button
                     onClick={onConfirm}
                     disabled={loading}
                     className="flex-1 py-4 rounded-2xl bg-destructive text-white hover:bg-destructive/90 transition-all font-black tracking-widest disabled:opacity-50"
                   >
                     {loading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'ERASE ALL'}
                   </button>
                 </div>
               </div>
             </motion.div>
           </div>
         );
       }
       ```

    5. Render EraseAllConfirmationModal in PlayersTab JSX:
       ```typescript
       <EraseAllConfirmationModal
         show={showEraseConfirm}
         onClose={() => setShowEraseConfirm(false)}
         onConfirm={eraseAllPlayers}
         loading={erasing}
       />
       ```

    6. Enhance CSV import with Zod validation:
       ```typescript
       import { PlayerCSVSchema } from '@/lib/csv/playerSchema';

       const importPlayersCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
         const file = e.target.files?.[0];
         if (!file) return;

         Papa.parse(file, {
           header: true,
           skipEmptyLines: true,
           complete: async (results) => {
             const rows = results.data as any[];
             let successCount = 0;
             let skipCount = 0;
             let errorCount = 0;
             const errors: string[] = [];

             for (const row of rows) {
               try {
                 // Validate row with Zod schema
                 const validated = PlayerCSVSchema.parse(row);

                 const name = validated.Name.trim();
                 const existingPlayer = players?.find((p: any) => p.name.toLowerCase() === name.toLowerCase());

                 if (existingPlayer) {
                   skipCount++;
                   continue;
                 }

                 await supabase.from('players').insert({
                   name,
                   category: validated.Classifications,
                   age: validated.Age,
                   height: validated.Height,
                   handy: validated.Handy,
                   type: validated.Type,
                   earlier_seasons: validated['Earlier Seasons'],
                   achievements: validated.Achievements,
                   special_remarks: validated['Special Remarks'],
                   playing_role: validated['Combat Role'],
                   gender: validated.Variant,
                   base_price: validated['Market Base'],
                   image_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
                 });
                 successCount++;
               } catch (err: any) {
                 errorCount++;
                 errors.push(`${row.Name || 'Unknown'}: ${err.message}`);
               }
             }

             // Show detailed import results
             const resultMsg = [
               `Import completed!`,
               `Created: ${successCount}`,
               `Skipped (already exists): ${skipCount}`,
               `Errors: ${errorCount}`
             ].join('\n');

             if (errors.length > 0 && errors.length <= 5) {
               alert(resultMsg + '\n\nError details:\n' + errors.join('\n'));
             } else if (errors.length > 5) {
               alert(resultMsg + `\n\nFirst 5 errors:\n${errors.slice(0, 5).join('\n')}`);
             } else {
               alert(resultMsg);
             }

             if (playersFileInputRef.current) {
               playersFileInputRef.current.value = '';
             }
           },
           error: (error) => {
             alert('Error parsing CSV: ' + error.message);
           }
         });
       };
       ```

    7. Fix BUG-03: Update updateGlobalPurse to propagate to all teams:
       ```typescript
       const updateGlobalPurse = async () => {
         try {
           // Update tournament_settings
           const { error: settingsError } = await supabase
             .from("tournament_settings")
             .update({ global_purse: parseInt(globalPurse) })
             .eq("id", settings.id);

           if (settingsError) throw settingsError;

           // Update all teams' starting_purse in auction_rules
           const { error: rulesError } = await supabase
             .from("auction_rules")
             .update({ starting_purse: parseInt(globalPurse) })
             .not('team_id', 'is', null);

           if (rulesError) throw rulesError;

           queryClient.invalidateQueries({ queryKey: ["settings"] });
           queryClient.invalidateQueries({ queryKey: ["rules"] });
           alert(`Global purse updated to ₹${parseInt(globalPurse).toLocaleString()} for all teams`);
         } catch (err: any) {
           alert('Error updating global purse: ' + err.message);
         }
       };
       ```

    8. Install Zod if not already installed:
       ```bash
       npm install zod
       ```
  </action>
  <verify>
    <automated>npm run build && grep -n "EraseAllConfirmationModal\|eraseAllPlayers\|PlayerCSVSchema" app/admin/page.tsx</automated>
    <manual>Test CSV import with valid and invalid rows. Verify errors are reported. Test erase all players and confirm all players are deleted. Test global purse update and verify all teams' starting_purse is updated.</manual>
    <sampling_rate>run after task commits</sampling_rate>
  </verify>
  <done>Admin can bulk import players via CSV with validation, erase all players with confirmation, and update global purse for all teams</done>
</task>

</tasks>

<verification>
- "Erase All" button triggers confirmation modal with warning about permanent deletion
- Erasing all players removes all rows from players table
- CSV import validates all 12 required fields using Zod schema
- CSV import shows detailed success/skip/error counts
- CSV import shows specific error messages for invalid rows (max 5)
- Global purse update modifies tournament_settings and all auction_rules rows
- UI reflects updated global purse and team starting purses immediately
</verification>

<success_criteria>
1. Admin can erase all players with confirmation and all players are removed from database
2. Admin can upload CSV with all player fields and all fields are correctly validated and imported
3. CSV import reports success count, skip count (duplicates), and error count with error details
4. Admin can update global purse to 30,00,000 and click "Apply Global" to update all teams
5. All changes persist to Supabase database and UI updates immediately
</success_criteria>

<output>
After completion, create `.planning/phases/phase-1/1-foundation-02-SUMMARY.md`
</output>
