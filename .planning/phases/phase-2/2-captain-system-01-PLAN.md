---
phase: 2-captain-system
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/20260306000000_add_captain_system_columns.sql
  - supabase/migrations/20260306000001_add_base_prices_and_current_purse.sql
autonomous: true
requirements: [CAPT-02, RULE-01, RULE-06, ADMIN-03]
user_setup: []

must_haves:
  truths:
    - "players table has is_captain and captain_team_id columns"
    - "teams table has captain_player_id column"
    - "auction_rules table has current_purse column"
    - "tournament_settings table has category base price columns"
    - "user_roles only uses core_admin role (admin role removed)"
  artifacts:
    - path: "supabase/migrations/20260306000000_add_captain_system_columns.sql"
      provides: "Captain-related columns and admin role simplification"
      contains: "is_captain, captain_team_id, captain_player_id"
    - path: "supabase/migrations/20260306000001_add_base_prices_and_current_purse.sql"
      provides: "Base price and purse tracking columns"
      contains: "current_purse, base_price_A_plus, base_price_A, base_price_B, base_price_F"
  key_links:
    - from: "players.is_captain"
      to: "teams.captain_player_id"
      via: "foreign key reference"
      pattern: "REFERENCES public.teams"
---

<objective>
Add database schema for captain assignment, base price configuration, and simplified admin role system

Purpose: Establish database foundation for captain assignment functionality, category-wise pricing rules, and simplified permission model
Output: Database migrations with all required columns for captain system, base prices, and admin roles
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

# Phase 1 summaries for patterns
@.planning/phases/phase-1/1-foundation-01-SUMMARY.md
@.planning/phases/phase-1/1-foundation-02-SUMMARY.md
@.planning/phases/phase-1/1-foundation-03-SUMMARY.md
</context>

<tasks>

<task type="auto">
  <name>task 1: Add captain system columns and simplify admin roles</name>
  <files>supabase/migrations/20260306000000_add_captain_system_columns.sql</files>
  <action>
Create migration file `supabase/migrations/20260306000000_add_captain_system_columns.sql` with:

1. Add to players table:
   - `is_captain BOOLEAN DEFAULT FALSE` - marks player as captain
   - `captain_team_id UUID REFERENCES public.teams(id)` - links captain to team

2. Add to teams table:
   - `captain_player_id UUID REFERENCES public.players(id)` - links team to captain player

3. Simplify user_roles by removing regular admin role:
   - Update app_role ENUM to only have 'core_admin' and 'captain' (remove 'admin')
   - Delete any existing user_roles with role='admin'
   - Update RLS policies to reference only core_admin and captain roles

4. Add indexes for performance:
   - CREATE INDEX idx_players_is_captain ON players(is_captain);
   - CREATE INDEX idx_players_captain_team_id ON players(captain_team_id);
   - CREATE INDEX idx_teams_captain_player_id ON teams(captain_player_id);

5. Add comments for documentation:
   - COMMENT ON COLUMN public.players.is_captain IS 'True if this player is a team captain (cannot be auctioned)';
   - COMMENT ON COLUMN public.players.captain_team_id IS 'Team this captain belongs to (for roster visibility)';
   - COMMENT ON COLUMN public.teams.captain_player_id IS 'Player ID of the assigned captain';

Do NOT remove existing data or modify foreign key constraints in a way that breaks existing data.
  </action>
  <verify>
    <automated>cat supabase/migrations/20260306000000_add_captain_system_columns.sql | grep -q "ALTER TABLE public.players ADD COLUMN IF NOT EXISTS is_captain" && echo "Migration includes is_captain column" || echo "MISSING: is_captain column"</automated>
    <automated>cat supabase/migrations/20260306000000_add_captain_system_columns.sql | grep -q "ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS captain_player_id" && echo "Migration includes captain_player_id column" || echo "MISSING: captain_player_id column"</automated>
  </verify>
  <done>
    - Migration file created with all captain system columns
    - Admin role simplified to only core_admin and captain
    - Indexes added for query performance
    - Comments added for documentation
  </done>
</task>

<task type="auto">
  <name>task 2: Add base prices and current purse tracking</name>
  <files>supabase/migrations/20260306000001_add_base_prices_and_current_purse.sql</files>
  <action>
Create migration file `supabase/migrations/20260306000001_add_base_prices_and_current_purse.sql` with:

1. Add to auction_rules table:
   - `current_purse INTEGER NOT NULL DEFAULT 30000` - tracks current available purse after deductions
   - Set initial value to starting_purse via UPDATE statement

2. Add to tournament_settings table:
   - `base_price_A_plus INTEGER NOT NULL DEFAULT 500000` - A+ category base price (₹5,00,000)
   - `base_price_A INTEGER NOT NULL DEFAULT 200000` - A category base price (₹2,00,000)
   - `base_price_B INTEGER NOT NULL DEFAULT 100000` - B category base price (₹1,00,000)
   - `base_price_F INTEGER NOT NULL DEFAULT 50000` - F category base price (₹50,000)

3. Initialize current_purse from starting_purse:
   - UPDATE auction_rules SET current_purse = starting_purse WHERE current_purse IS NULL;

4. Add comments:
   - COMMENT ON COLUMN public.auction_rules.current_purse IS 'Current available purse after all deductions (captain, manual)';
   - COMMENT ON COLUMN public.tournament_settings.base_price_A_plus IS 'Base price for A+ category players (₹5,00,000)';
   - COMMENT ON COLUMN public.tournament_settings.base_price_A IS 'Base price for A category players (₹2,00,000)';
   - COMMENT ON COLUMN public.tournament_settings.base_price_B IS 'Base price for B category players (₹1,00,000)';
   - COMMENT ON COLUMN public.tournament_settings.base_price_F IS 'Base price for F category players (₹50,000)';

5. Update existing tournament_settings row with default base prices:
   - UPDATE tournament_settings SET base_price_A_plus = 500000, base_price_A = 200000, base_price_B = 100000, base_price_F = 50000;
  </action>
  <verify>
    <automated>cat supabase/migrations/20260306000001_add_base_prices_and_current_purse.sql | grep -q "ALTER TABLE public.auction_rules ADD COLUMN IF NOT EXISTS current_purse" && echo "Migration includes current_purse column" || echo "MISSING: current_purse column"</automated>
    <automated>cat supabase/migrations/20260306000001_add_base_prices_and_current_purse.sql | grep -q "base_price_A_plus.*500000" && echo "Migration includes A+ base price" || echo "MISSING: A+ base price"</automated>
  </verify>
  <done>
    - Migration file created with current_purse and base price columns
    - All category base prices configured with correct values
    - current_purse initialized from starting_purse for existing teams
    - Comments added for documentation
  </done>
</task>

</tasks>

<verification>
- Both migration files exist with correct table and column names
- All required columns added with correct data types and defaults
- Foreign key relationships properly defined
- Indexes created for performance
- Admin role simplified to only core_admin and captain
- Migration files are idempotent (can be run multiple times safely)
</verification>

<success_criteria>
- Database migrations can be applied successfully without errors
- players table has is_captain, captain_team_id columns
- teams table has captain_player_id column
- auction_rules table has current_purse column
- tournament_settings table has all 4 base price columns
- user_roles table no longer has 'admin' role entries
- All foreign key references are valid
- Indexes created for performance optimization
</success_criteria>

<output>
After completion, create `.planning/phases/phase-2/2-captain-system-01-SUMMARY.md`
</output>
