## Database Schema Fix Required

The deploy error is caused by missing database columns and table. Please follow these steps:

### Step 1: Open Supabase SQL Editor

Go to: https://app.supabase.com/project/sobluwbgolausglcsrbs/sql/new

### Step 2: Execute the following SQL:

```sql
-- Fix missing tournament_settings columns and create dashboard_presence table

-- Add missing max_total_players column
ALTER TABLE public.tournament_settings
  ADD COLUMN IF NOT EXISTS max_total_players INTEGER NOT NULL DEFAULT 9;

-- Add timer settings columns
ALTER TABLE public.tournament_settings
  ADD COLUMN IF NOT EXISTS first_bid_timer_seconds INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS subsequent_bid_timer_seconds INTEGER NOT NULL DEFAULT 20;

-- Create dashboard_presence table
CREATE TABLE IF NOT EXISTS public.dashboard_presence (
  session_id TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.dashboard_presence ENABLE ROW LEVEL SECURITY;

-- Allow public access
CREATE POLICY IF NOT EXISTS "Public can view dashboard presence" ON public.dashboard_presence
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Public can upsert dashboard presence" ON public.dashboard_presence
  FOR INSERT WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "Public can delete dashboard presence" ON public.dashboard_presence
  FOR DELETE USING (true);

-- Create index
CREATE INDEX IF NOT EXISTS dashboard_presence_last_seen_idx ON public.dashboard_presence(last_seen);
```

### Step 3: Click "Run" button

### Step 4: After running the SQL, let me know and I'll redeploy the application

---

**Why this fixes the error:**
- The app is trying to query columns that don't exist (`max_total_players`, `first_bid_timer_seconds`, `subsequent_bid_timer_seconds`)
- The dashboard is trying to update a table that doesn't exist (`dashboard_presence`)
- These errors cause the Server Component to fail during render
