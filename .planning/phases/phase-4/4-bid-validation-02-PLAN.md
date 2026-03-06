---
phase: 4-bid-validation
plan: 02
type: execute
wave: 2
depends_on: ["4-bid-validation-01"]
files_modified:
  - lib/validation/bidValidation.ts
  - app/admin/page.tsx
  - app/captain/page.tsx
autonomous: true
requirements: [VALID-03, VALID-04, VALID-05, ADMIN-02]
must_haves:
  truths:
    - "Captain receives red alert when category limit reached"
    - "Team is marked RED in Admin Live Controller when ineligible"
    - "Admin can view list of eligible teams to bid"
  artifacts:
    - path: "lib/validation/bidValidation.ts"
      provides: "Category limit checking logic"
      contains: "checkCategoryEligibility|getTeamEligibility"
---

<objective>
Implement category restrictions and team eligibility tracking for bid validation.

Purpose: Enforce team composition rules at bid time - prevent bidding when category limits reached. Show eligibility status in both Captain and Admin dashboards.

Output: Updated validation logic, Admin Live Controller with eligibility indicators, Captain UI with category alerts.
</objective>

<tasks>

<task type="auto">
  <name>task 1: Add category eligibility checking</name>
  <files>lib/validation/bidValidation.ts</files>
  <action>
Extend lib/validation/bidValidation.ts:

1. checkCategoryEligibility(teamId, playerCategory, playerGender):
   - Get roster for team
   - Count players by category:
     - Male: A+=1 max, A=3 max, B=4 max
     - Female: F=2 max (from RULE-06)
   - Check if adding this player would exceed limits
   - Return { eligible: boolean, currentCount: number, maxAllowed: number, reason?: string }

2. getTeamEligibility(teamId, playerId):
   - Combine: category check + max bid check + purse check
   - Return { canBid: boolean, reasons: string[], maxBid?: number }

3. getEligibleTeams(playerId):
   - For current player, get all teams
   - Filter to eligible teams
   - Return list with eligibility status
</action>
  <verify>
grep -r "checkCategoryEligibility\|getTeamEligibility" lib/validation/bidValidation.ts
</verify>
  <done>Category eligibility checking added</done>
</task>

<task type="auto">
  <name>task 2: Update Admin Live Controller with eligibility display</name>
  <files>app/admin/page.tsx</files>
  <action>
Update Admin Live Controller:

1. Show team eligibility status:
   - Green checkmark: Team can bid
   - Red X: Team cannot bid (show reason)
   - Display reasons: "Max bid exceeded", "Category limit reached", "Insufficient purse"

2. List all teams with eligibility:
   - In side panel, show team-by-team status
   - Filter to show only eligible teams option

3. Color coding:
   - Eligible teams: default/green
   - Ineligible teams: red background/indicator

4. Real-time updates:
   - Recalculate eligibility when bids come in
</action>
  <verify>
grep -r "eligibility\|eligibleTeams\|canBid" app/admin/page.tsx
</verify>
  <done>Admin Live Controller updated with eligibility display</done>
</task>

<task type="auto">
  <name>task 3: Update Captain Dashboard with category alerts</name>
  <files>app/captain/page.tsx</files>
  <action>
Update Captain Dashboard:

1. Show category limit warnings:
   - If team has X players in category and limit reached
   - "You are not eligible to bid in this player as you have X number of X category player"

2. Disable bid button when:
   - Category limit reached
   - Max bid exceeded
   - Purse insufficient

3. Show clear error messages:
   - Red alert styling
   - Specific reason for ineligibility

4. Real-time updates:
   - Recalculate when roster changes
</action>
  <verify>
grep -r "category.*limit\|categoryLimit\|ineligible" app/captain/page.tsx
</verify>
  <done>Captain dashboard updated with category alerts</done>
</task>

</tasks>

<verification>
1. Captain sees category limit warnings
2. Admin shows ineligible teams in red
3. Eligibility list updates in real-time
</verification>

<success_criteria>
1. Captain receives red alert when category limit reached and bid is rejected
2. Team is marked RED in Admin Live Controller when ineligible to bid
3. Admin can view list of eligible teams to bid on current player
</success_criteria>
