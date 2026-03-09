#!/bin/bash

# Fix missing database columns and table

echo "Connecting to Supabase to fix database schema..."

# Extract connection details from .env
SUPABASE_URL=$(grep SUPABASE_URL .env | cut -d '=' -f2)
SUPABASE_ANON_KEY=$(grep SUPABASE_ANON_KEY .env | cut -d '=' -f2)

# Extract project ref from URL
PROJECT_REF=$(echo $SUPABASE_URL | grep -oP 'supabase\.co/\K[^/]+')

echo "Project ref: $PROJECT_REF"

# Read migration SQL
MIGRATION_SQL=$(cat supabase/migrations/20260309000000_fix_missing_columns_and_table.sql)

# Create SQL file for psql
cat > /tmp/fix_migration.sql << EOF
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
EOF

echo "Migration SQL prepared. Please run this SQL manually in the Supabase SQL Editor:"
echo ""
echo "Open: https://app.supabase.com/project/$PROJECT_REF/sql/new"
echo "Then paste the contents of /tmp/fix_migration.sql"
echo ""
cat /tmp/fix_migration.sql
