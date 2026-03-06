---
phase: 1-foundation
plan: 03
type: execute
wave: 1
depends_on: []
files_modified: [app/admin/page.tsx]
autonomous: true
requirements: [DATA-03, ADMIN-01]
user_setup: []

must_haves:
  truths:
    - "Admin tries to add 10th player to a team and sees clear error message"
    - "System prevents adding more than 9 players to any team roster"
    - "Admin can type in search box in Live Controller and see filtered player list"
    - "Admin can filter players by category, role, or gender in Live Controller"
    - "Admin selects a player from filtered list and clicks Deploy"
  artifacts:
    - path: "app/admin/page.tsx"
      provides: "Live Controller with search functionality and roster limit enforcement"
      min_lines: 2200
      contains: "enforceMaxRosterSize", "filteredUnsoldPlayers", "playerSearch", "playerCategoryFilter", "playerRoleFilter", "playerGenderFilter"
    - path: "lib/validation/rosterRules.ts"
      provides: "Roster validation logic for team size limits"
      exports: ["checkRosterLimit", "enforceMaxPlayersPerTeam"]
  key_links:
    - from: "app/admin/page.tsx"
      to: "lib/validation/rosterRules.ts"
      via: "enforceMaxRosterSize called before adding player to team"
      pattern: "checkRosterLimit.*team_id.*player_id"
    - from: "app/admin/page.tsx (LiveControllerTab)"
      to: "player list rendering"
      via: "filteredUnsoldPlayers computed from search and filters"
      pattern: "filter.*search.*category.*role.*gender"
</context>

<objective>
Enforce max 9 players per team roster limit and add search functionality in Live Controller.

Purpose: DATA-03 requires system to prevent adding more than 9 players to any team and show clear error. ADMIN-01 requires search functionality in Live Controller to select players by name, category, role, or gender.

Output: Roster size enforcement with clear error messages, and searchable/filterable player queue in Live Controller.
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
@.planning/research/ARCHITECTURE.md
</context>

<tasks>

<task type="auto">
  <name>Implement roster limit enforcement and Live Controller search</name>
  <files>app/admin/page.tsx</files>
  <action>
    1. Create roster validation utility (create lib/validation/rosterRules.ts):
       ```typescript
       import { supabase } from '@/lib/supabase';

       export async function checkRosterLimit(teamId: string): Promise<{ canAdd: boolean; currentCount: number; maxCount: number; errorMessage?: string }> {
         const maxPlayers = 9;

         // Count current players on team (excluding captains)
         const { data: existingPlayers, error } = await supabase
           .from('players')
           .select('id')
           .eq('sold_to_team_id', teamId)
           .eq('is_captain', false);

         if (error) throw error;

         const currentCount = existingPlayers?.length || 0;
         const canAdd = currentCount < maxPlayers;

         return {
           canAdd,
           currentCount,
           maxCount,
           errorMessage: canAdd ? undefined : `Cannot add player: Team already has ${currentCount}/${maxPlayers} players (max 9 allowed)`
         };
       }

       export async function enforceMaxPlayersPerTeam(teamId: string, playerId?: string): Promise<boolean> {
         const limitCheck = await checkRosterLimit(teamId);

         if (!limitCheck.canAdd) {
           throw new Error(limitCheck.errorMessage);
         }

         return true;
       }
       ```

    2. Modify markSold function in LiveControllerTab to enforce roster limit:
       ```typescript
       import { enforceMaxPlayersPerTeam } from '@/lib/validation/rosterRules';

       const markSold = async () => {
         if (!auctionState?.current_player_id || !auctionState?.current_bidder_team_id) return;

         try {
           // Enforce roster limit before marking player as sold
           await enforceMaxPlayersPerTeam(auctionState.current_bidder_team_id);

           // 1. Mark player sold
           await supabase.from("players").update({
             is_sold: true,
             sold_to_team_id: auctionState.current_bidder_team_id,
             sold_price: auctionState.current_bid
           }).eq("id", auctionState.current_player_id);

           // 2. Mark winning bid
           const { data: highestBid } = await supabase.from("bids")
             .select("id")
             .eq("player_id", auctionState.current_player_id)
             .eq("team_id", auctionState.current_bidder_team_id)
             .order("bid_amount", { ascending: false }).limit(1).single();

           if (highestBid) {
             await supabase.from("bids").update({ is_winning_bid: true }).eq("id", highestBid.id);
           }

           // TRIGGER CONFETTI
           confetti({
             particleCount: 150,
             spread: 70,
             origin: { y: 0.6 },
             colors: ['#FFD700', '#FFFFFF', '#3b82f6']
           });

           // 3. Reset state
           await supabase.from("auction_state").update({
             current_player_id: null,
             current_bid: 0,
             current_bidder_team_id: null,
             status: "waiting",
             updated_at: new Date().toISOString()
           }).eq("id", auctionState.id);

         } catch (err: any) {
           alert(err.message || 'Failed to mark player as sold');
         }
       };
       ```

    3. Add search and filter state to LiveControllerTab:
       ```typescript
       const [playerSearch, setPlayerSearch] = useState("");
       const [playerCategoryFilter, setPlayerCategoryFilter] = useState("All");
       const [playerRoleFilter, setPlayerRoleFilter] = useState("All");
       const [playerGenderFilter, setPlayerGenderFilter] = useState("All");
       ```

    4. Create filtered unsold players list in LiveControllerTab:
       ```typescript
       const filteredUnsoldPlayers = unsoldPlayers.filter((p: any) => {
         // Search by name
         if (playerSearch && !p.name.toLowerCase().includes(playerSearch.toLowerCase())) {
           return false;
         }

         // Filter by category
         if (playerCategoryFilter !== "All" && p.category !== playerCategoryFilter) {
           return false;
         }

         // Filter by role
         if (playerRoleFilter !== "All" && p.playing_role !== playerRoleFilter) {
           return false;
         }

         // Filter by gender
         if (playerGenderFilter !== "All" && p.gender !== playerGenderFilter) {
           return false;
         }

         return true;
       });
       ```

    5. Add search and filter controls in LiveControllerTab (before the player queue):
       ```typescript
       {/* Search and Filters */}
       <div className="flex flex-col gap-4 mb-6">
         <div className="flex gap-4">
           <div className="relative flex-1 group">
             <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
             <input
               type="text"
               placeholder="Search players by name..."
               value={playerSearch}
               onChange={e => setPlayerSearch(e.target.value)}
               className="w-full bg-slate-900/60 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-600 font-sans"
             />
           </div>
         </div>

         <div className="flex flex-wrap gap-3">
           <div className="relative group min-w-[140px]">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-hover:text-gold transition-colors" />
             <select
               value={playerCategoryFilter}
               onChange={e => setPlayerCategoryFilter(e.target.value)}
               className="appearance-none w-full bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-8 py-3 text-xs focus:border-gold/30 focus:bg-slate-900 outline-none transition-all font-display font-bold text-slate-300"
             >
               <option value="All">All Categories</option>
               <option value="A+">Platinum (A+)</option>
               <option value="A">Gold (A)</option>
               <option value="B">Silver (B)</option>
               <option value="C">Standard (C)</option>
               <option value="F">Female (F)</option>
             </select>
           </div>

           <div className="relative group min-w-[140px]">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-hover:text-primary transition-colors" />
             <select
               value={playerRoleFilter}
               onChange={e => setPlayerRoleFilter(e.target.value)}
               className="appearance-none w-full bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-8 py-3 text-xs focus:border-primary/30 focus:bg-slate-900 outline-none transition-all font-display font-bold text-slate-300"
             >
               <option value="All">All Roles</option>
               <option value="Batsman">Batsman</option>
               <option value="Bowler">Bowler</option>
               <option value="All-rounder">All-rounder</option>
               <option value="Wicket-keeper">Wicket-keeper</option>
             </select>
           </div>

           <div className="relative group min-w-[140px]">
             <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-hover:text-accent transition-colors" />
             <select
               value={playerGenderFilter}
               onChange={e => setPlayerGenderFilter(e.target.value)}
               className="appearance-none w-full bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-8 py-3 text-xs focus:border-accent/30 focus:bg-slate-900 outline-none transition-all font-display font-bold text-slate-300"
             >
               <option value="All">All Genders</option>
               <option value="Male">Male</option>
               <option value="Female">Female</option>
             </select>
           </div>

           <button
             onClick={() => {
               setPlayerSearch("");
               setPlayerCategoryFilter("All");
               setPlayerRoleFilter("All");
               setPlayerGenderFilter("All");
             }}
             className="px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-slate-400 hover:text-white border border-white/5 hover:border-white/10 transition-colors"
           >
             CLEAR FILTERS
           </button>
         </div>

         <p className="text-[10px] text-slate-600 font-black uppercase tracking-[0.2em]">
           {filteredUnsoldPlayers.length} players available
         </p>
       </div>
       ```

    6. Update player queue to use filteredUnsoldPlayers instead of unsoldPlayers:
       ```typescript
       {/* Player Queue - Right Col */}
       <div className="w-1/2 glass-card bg-slate-950/40 border border-white/5 rounded-[2.5rem] flex flex-col min-h-0 relative z-10">
         <div className="p-8 border-b border-white/5 shrink-0 flex justify-between items-center">
           <h3 className="font-display text-2xl font-black text-white tracking-tight uppercase">Operational Queue</h3>
           <span className="glass px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 tracking-widest uppercase">{filteredUnsoldPlayers.length} Units</span>
         </div>
         <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
           <div className="space-y-3">
             {filteredUnsoldPlayers.length === 0 ? (
               <div className="text-center py-10 text-slate-700">
                 <p className="font-display text-sm uppercase tracking-[0.2em] opacity-40">No players match filters</p>
               </div>
             ) : (
               filteredUnsoldPlayers.map((p: any) => (
                 <div key={p.id} className="group bg-slate-950/40 border border-white/5 p-4 rounded-3xl flex items-center justify-between hover:border-primary/40 hover:bg-slate-900 transition-all duration-300">
                   {/* ... player card content ... */}
                 </div>
               ))
             )}
           </div>
         </div>
       </div>
       ```

    7. Add additional roster size display in Live Controller:
       ```typescript
       {/* Add team roster counts in the current bid display */}
       {auctionState?.current_bidder_team_id && (
         <div className="mt-4 bg-slate-900/40 border border-white/5 rounded-xl p-4">
           <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Winning Team Roster</p>
           <div className="flex items-center gap-2">
             <Users className="w-4 h-4 text-slate-400" />
             <span className="text-white font-bold">
               {(() => {
                 const teamPlayers = players?.filter((p: any) => p.sold_to_team_id === auctionState.current_bidder_team_id && !p.is_captain).length || 0;
                 return `${teamPlayers}/9 players`;
               })()}
             </span>
           </div>
         </div>
       )}
       ```
  </action>
  <verify>
    <automated>npm run build && grep -n "checkRosterLimit\|enforceMaxPlayersPerTeam\|filteredUnsoldPlayers\|playerSearch" app/admin/page.tsx</automated>
    <manual>Test roster limit: Try to add 10th player to a team - should see error. Test search: Type name in search box - list should filter. Test filters: Apply category/role/gender filters - list should filter. Test Deploy: Click Deploy on filtered player - should work.</manual>
    <sampling_rate>run after task commits</sampling_rate>
  </verify>
  <done>System enforces 9 player max per team with clear error messages, and Live Controller has working search/filter functionality</done>
</task>

</tasks>

<verification>
- When admin tries to mark 10th player as sold, system rejects with error message showing current count (9/9)
- Error message is clear: "Cannot add player: Team already has 9/9 players (max 9 allowed)"
- Roster check happens before database update (prevents partial transactions)
- Live Controller search box filters players by name (case-insensitive)
- Live Controller category filter shows correct options (A+, A, B, C, F)
- Live Controller role filter shows correct options (Batsman, Bowler, All-rounder, Wicket-keeper)
- Live Controller gender filter shows correct options (Male, Female)
- "Clear Filters" button resets all filters to default
- Filtered player count updates in real-time
- Player queue displays only filtered players or "No players match filters" message
- Team roster count displays in current bid section showing X/9 players
</verification>

<success_criteria>
1. System prevents adding 10th player to any team and shows clear error with current/max count
2. Admin can search players by name in Live Controller and see filtered results
3. Admin can filter players by category in Live Controller and see filtered results
4. Admin can filter players by role in Live Controller and see filtered results
5. Admin can filter players by gender in Live Controller and see filtered results
6. All filters work together (search + category + role + gender)
7. Admin can clear all filters with one button
8. Filtered player count updates in real-time
9. Team roster count displays in current bid section
</success_criteria>

<output>
After completion, create `.planning/phases/phase-1/1-foundation-03-SUMMARY.md`
</output>
