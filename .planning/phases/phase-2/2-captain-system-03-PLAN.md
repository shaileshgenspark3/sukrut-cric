---
phase: 2-captain-system
plan: 03
type: execute
wave: 2
depends_on: [2-captain-system-01]
files_modified:
  - app/admin/page.tsx
  - lib/actions/rules.ts
autonomous: true
requirements: [CAPT-05, RULE-01]
user_setup: []

must_haves:
  truths:
    - "Admin can manually deduct team purse with amount and reason"
    - "Manual deduction persists to database (auction_rules.current_purse)"
    - "Base prices are configurable in Rules tab (A+=5,00,000, A=2,00,000, B=1,00,000, F=50,000)"
    - "Base price changes persist to tournament_settings table"
    - "Current purse displays correctly after deductions"
  artifacts:
    - path: "app/admin/page.tsx"
      provides: "Manual deduction UI and base price configuration"
      contains: "manualDeduction, base_price_A_plus"
    - path: "lib/actions/rules.ts"
      provides: "Purse deduction and base price update actions"
      exports: ["manualPurseDeduction", "updateBasePrices"]
  key_links:
    - from: "RulesTab manual deduction form"
      to: "manualPurseDeduction action"
      via: "form submission"
      pattern: "manualPurseDeduction.*onSubmit"
    - from: "RulesTab base price inputs"
      to: "updateBasePrices action"
      via: "button click"
      pattern: "updateBasePrices.*onClick"
</key_links>
---

<objective>
Add manual purse deduction and base price configuration to Rules tab

Purpose: Enable admins to manually deduct team purses with reason tracking, and configure category-wise base prices for auction calculations
Output: Enhanced Rules tab with manual deduction and base price configuration UI
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

# Phase 1 summaries for patterns (UI updates, query invalidation)
@.planning/phases/phase-1/1-foundation-02-SUMMARY.md

# Phase 2 Plan 1 for database schema (current_purse, base price columns)
@.planning/phases/phase-2/2-captain-system-01-PLAN.md
</context>

<tasks>

<task type="auto">
  <name>task 1: Create rules server actions for purse and base price management</name>
  <files>lib/actions/rules.ts</files>
  <action>
Create `lib/actions/rules.ts` with:

1. manualPurseDeduction function:
   ```typescript
   export async function manualPurseDeduction(teamId: string, amount: number, reason: string) {
     const { data: rules } = await supabase
       .from("auction_rules")
       .select("current_purse")
       .eq("team_id", teamId)
       .single();

     const newPurse = rules.current_purse - amount;

     if (newPurse < 0) {
       throw new Error("Deduction would result in negative purse");
     }

     await supabase
       .from("auction_rules")
       .update({ current_purse: newPurse })
       .eq("team_id", teamId);

     // Log deduction (optional: create auction_log entry for audit)
     await supabase
       .from("manual_deductions")
       .insert({
         team_id: teamId,
         amount: amount,
         reason: reason,
         deducted_at: new Date().toISOString()
       });

     revalidatePath("/admin");
     revalidatePath("/captain");

     return { success: true, newPurse };
   }
   ```

2. updateBasePrices function:
   ```typescript
   export async function updateBasePrices(basePrices: {
     A_plus: number;
     A: number;
     B: number;
     F: number;
   }) {
     await supabase
       .from("tournament_settings")
       .update({
         base_price_A_plus: basePrices.A_plus,
         base_price_A: basePrices.A,
         base_price_B: basePrices.B,
         base_price_F: basePrices.F,
         updated_at: new Date().toISOString()
       })
       .neq("id", null); // Update all rows (should be single row)

     revalidatePath("/admin");
     revalidatePath("/captain");

     return { success: true };
   }
   ```

3. Import supabase from @/lib/supabase
4. Export both functions

Note: manual_deductions table may not exist yet. If needed, create it in a separate migration (deferred to Phase 5 logging).
  </action>
  <verify>
    <automated>cat lib/actions/rules.ts 2>/dev/null | grep -q "export async function manualPurseDeduction" && echo "manualPurseDeduction function exists" || echo "MISSING: manualPurseDeduction function"</automated>
    <automated>cat lib/actions/rules.ts 2>/dev/null | grep -q "export async function updateBasePrices" && echo "updateBasePrices function exists" || echo "MISSING: updateBasePrices function"</automated>
  </verify>
  <done>
    - manualPurseDeduction function deducts amount from team's current_purse
    - manualPurseDeduction validates for negative purse
    - manualPurseDeduction logs deduction with reason and timestamp
    - updateBasePrices function updates all category base prices
    - Both functions invalidate relevant queries
  </done>
</task>

<task type="auto">
  <name>task 2: Add manual deduction UI to Rules tab</name>
  <files>app/admin/page.tsx</files>
<action>
In `app/admin/page.tsx` RulesTab component:

1. Add state for manual deduction form:
   ```typescript
   const [deductionTeamId, setDeductionTeamId] = useState("");
   const [deductionAmount, setDeductionAmount] = useState("");
   const [deductionReason, setDeductionReason] = useState("");
   ```

2. Add manualDeduction handler:
   ```typescript
   const handleManualDeduction = async () => {
     if (!deductionTeamId || !deductionAmount || !deductionReason) {
       alert("Please fill all fields");
       return;
     }

     try {
       const result = await manualPurseDeduction(
         deductionTeamId,
         parseInt(deductionAmount),
         deductionReason
       );
       if (result.success) {
         queryClient.invalidateQueries({ queryKey: ["rules"] });
         alert(`Deduction successful. New purse: ₹${result.newPurse.toLocaleString()}`);
         // Reset form
         setDeductionTeamId("");
         setDeductionAmount("");
         setDeductionReason("");
       }
     } catch (err: any) {
       alert("Error processing deduction: " + err.message);
     }
   };
   ```

3. Add manual deduction section to RulesTab (after global purse section, before teams table):
   ```jsx
   <div className="glass-card bg-slate-900/60 p-6 rounded-[2rem] border-white/5">
     <h3 className="text-sm font-display font-black text-gold tracking-[0.2em] mb-4 uppercase">Manual Purse Deduction</h3>
     <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
       <div>
         <label className="text-[10px] text-slate-500 font-black tracking-[0.3em] mb-2 block uppercase">Team</label>
         <select
           value={deductionTeamId}
           onChange={e => setDeductionTeamId(e.target.value)}
           className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-gold/30 transition-all"
         >
           <option value="">Select team</option>
           {rules?.map((r: any) => (
             <option key={r.team_id} value={r.team_id}>
               {r.team?.team_name}
             </option>
           ))}
         </select>
       </div>
       <div>
         <label className="text-[10px] text-slate-500 font-black tracking-[0.3em] mb-2 block uppercase">Amount</label>
         <div className="relative">
           <span className="absolute left-3 top-1/2 -translate-y-1/2 text-destructive font-bold text-sm">-₹</span>
           <input
             type="number"
             value={deductionAmount}
             onChange={e => setDeductionAmount(e.target.value)}
             placeholder="0"
             className="w-full bg-slate-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-destructive transition-all"
           />
         </div>
       </div>
       <div className="md:col-span-2">
         <label className="text-[10px] text-slate-500 font-black tracking-[0.3em] mb-2 block uppercase">Reason</label>
         <input
           type="text"
           value={deductionReason}
           onChange={e => setDeductionReason(e.target.value)}
           placeholder="Reason for deduction"
           className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-white/20 transition-all"
         />
       </div>
     </div>
     <button
       onClick={handleManualDeduction}
       className="mt-4 bg-destructive hover:bg-destructive/90 text-white font-display font-black text-xs tracking-widest px-6 rounded-xl h-[42px] shadow-[0_4px_15px_rgba(239,68,68,0.2)] transition-all hover:scale-105 active:scale-95 uppercase"
     >
       Apply Deduction
     </button>
   </div>
   ```

4. Style: Match existing glass-card aesthetic with destructive color for deduction UI
</action>
  <verify>
    <automated>grep -q "manualDeduction" app/admin/page.tsx && echo "Manual deduction state exists" || echo "MISSING: Manual deduction state"</automated>
    <automated>grep -q "handleManualDeduction" app/admin/page.tsx && echo "handleManualDeduction handler exists" || echo "MISSING: handleManualDeduction handler"</automated>
  </verify>
  <done>
    - Manual deduction form added to Rules tab
    - Team dropdown shows all teams
    - Amount input with -₹ prefix
    - Reason input for audit trail
    - Form validation before submission
    - Success/error alerts with feedback
    - Form resets after successful deduction
  </done>
</task>

<task type="auto">
  <name>task 3: Add base price configuration to Rules tab</name>
  <files>app/admin/page.tsx</files>
<action>
In `app/admin/page.tsx` RulesTab component:

1. Add state for base prices:
   ```typescript
   const [basePrices, setBasePrices] = useState({
     A_plus: settings?.base_price_A_plus?.toString() || "500000",
     A: settings?.base_price_A?.toString() || "200000",
     B: settings?.base_price_B?.toString() || "100000",
     F: settings?.base_price_F?.toString() || "50000"
   });
   ```

2. Add updateBasePrices handler:
   ```typescript
   const handleUpdateBasePrices = async () => {
     try {
       const result = await updateBasePrices({
         A_plus: parseInt(basePrices.A_plus),
         A: parseInt(basePrices.A),
         B: parseInt(basePrices.B),
         F: parseInt(basePrices.F)
       });
       if (result.success) {
         queryClient.invalidateQueries({ queryKey: ["settings"] });
         alert("Base prices updated successfully!");
       }
     } catch (err: any) {
       alert("Error updating base prices: " + err.message);
     }
   };
   ```

3. Add base price configuration section to RulesTab (after manual deduction, before teams table):
   ```jsx
   <div className="glass-card bg-slate-900/60 p-6 rounded-[2rem] border-white/5">
     <h3 className="text-sm font-display font-black text-gold tracking-[0.2em] mb-4 uppercase">Category Base Prices</h3>
     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
       {[
         { key: "A_plus", label: "A+ Category", default: "500000" },
         { key: "A", label: "A Category", default: "200000" },
         { key: "B", label: "B Category", default: "100000" },
         { key: "F", label: "F Category", default: "50000" }
       ].map((category) => (
         <div key={category.key}>
           <label className="text-[10px] text-slate-500 font-black tracking-[0.3em] mb-2 block uppercase">{category.label}</label>
           <div className="relative">
             <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold font-display font-black text-sm">₹</span>
             <input
               type="number"
               value={basePrices[category.key as keyof typeof basePrices]}
               onChange={e => setBasePrices({ ...basePrices, [category.key]: e.target.value })}
               className="w-full bg-slate-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 font-display font-black text-white outline-none focus:border-gold/30 transition-all"
             />
           </div>
         </div>
       ))}
     </div>
     <button
       onClick={handleUpdateBasePrices}
       className="mt-4 bg-gold hover:bg-gold/90 text-black font-display font-black text-xs tracking-widest px-6 rounded-xl h-[42px] shadow-[0_4px_15px_rgba(255,215,0,0.2)] transition-all hover:scale-105 active:scale-95 uppercase"
     >
       Update Base Prices
     </button>
   </div>
   ```

4. Update teams table to show current_purse instead of calculated value:
   - Change: "Available Start Balance" column to show `r.current_purse` instead of `r.starting_purse - r.captain_deduction`

5. Update teams table header to show "Current Purse" instead of "Available Start Balance"
</action>
  <verify>
    <automated>grep -q "basePrices" app/admin/page.tsx && echo "Base prices state exists" || echo "MISSING: Base prices state"</automated>
    <automated>grep -q "handleUpdateBasePrices" app/admin/page.tsx && echo "handleUpdateBasePrices handler exists" || echo "MISSING: handleUpdateBasePrices handler"</automated>
    <automated>grep -q "base_price_A_plus\|base_price_A\|base_price_B\|base_price_F" app/admin/page.tsx && echo "Base price inputs exist" || echo "MISSING: Base price inputs"</automated>
  </verify>
  <done>
    - Base price configuration section added to Rules tab
    - All 4 category inputs with proper default values
    - Update button saves changes to database
    - Teams table shows current_purse from database
    - Query invalidation updates UI after changes
    - Success/error alerts provide feedback
  </done>
</task>

</tasks>

<verification>
- Manual deduction form displays in Rules tab
- Team dropdown populates with all teams
- Amount input validates for positive values
- Reason input is required
- Deduction updates current_purse in database
- Base price configuration displays all 4 categories
- Base price inputs pre-populated from database
- Update button saves changes to tournament_settings
- Teams table shows current_purse instead of calculated value
- All changes persist correctly
</verification>

<success_criteria>
- Admin can select team and enter deduction amount
- Admin can enter reason for manual deduction
- Manual deduction updates team's current_purse
- Base prices can be configured for all 4 categories
- Base price changes persist to database
- Teams table shows current purse correctly
- Query invalidation updates UI immediately
- Error handling prevents invalid operations
- Success alerts confirm changes
</success_criteria>

<output>
After completion, create `.planning/phases/phase-2/2-captain-system-03-SUMMARY.md`
</output>
