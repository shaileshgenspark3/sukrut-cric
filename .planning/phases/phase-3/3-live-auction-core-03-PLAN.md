---
phase: 3-live-auction-core
plan: 03
type: execute
wave: 3
depends_on: ["3-live-auction-core-02"]
files_modified:
  - src/components/admin/BidHistory.tsx
  - src/components/captain/page.tsx
  - src/components/admin/LiveAuctionController.tsx
  - src/hooks/useBids.ts
  - supabase/migrations/20260306_bid_history.sql
autonomous: true
requirements: [DISPLAY-01, DISPLAY-02]
must_haves:
  truths:
    - "Top 3 bids are displayed prominently with team name, logo, captain image, and bid amount to all captains"
    - "Bid history from 4th bid onwards is displayed with team name and amount only"
    - "Bid history updates in real-time as captains place bids"
    - "Admin Live Controller shows all bids with team details"
    - "Captain Dashboard shows top 3 prominently and history from 4th onwards"
  artifacts:
    - path: "src/components/admin/BidHistory.tsx"
      provides: "Bid history display component for admin"
      contains: "BidHistory"
    - path: "src/hooks/useBids.ts"
      provides: "Real-time bid history hook"
      exports: ["useBids"]
    - path: "src/components/captain/page.tsx"
      provides: "Captain dashboard with top 3 bids and history"
      contains: "top 3 bids|bid history"
  key_links:
    - from: "src/components/admin/BidHistory.tsx"
      to: "src/hooks/useBids.ts"
      via: "useBids hook import"
      pattern: "useBids"
    - from: "src/components/captain/page.tsx"
      to: "src/hooks/useBids.ts"
      via: "useBids hook import"
      pattern: "useBids"
    - from: "src/hooks/useBids.ts"
      to: "bids table"
      via: "Supabase Realtime subscription"
      pattern: "supabase.*from.*bids.*on.*postgres_changes"
---

<objective>
Implement real-time bid history display with top 3 bids prominently shown with team details, and history from 4th bid onwards.

Purpose: Provide transparency in auction by showing all bids to participants, with enhanced visual prominence for top 3 bids (team name, logo, captain image, amount) and compact display for subsequent bids (team name, amount only).

Output: BidHistory component, useBids hook for real-time subscriptions, updated Admin Live Controller and Captain Dashboard with bid display.
</objective>

<execution_context>
@~/.config/opencode/get-shit-done/workflows/execute-plan.md
@~/.config/opencode/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/research/ARCHITECTURE.md

# Existing bids table structure (assumed from current system)
# Need to ensure bids table has: player_id, team_id, bid_amount, created_at
# Teams table has: team_name, logo_url (for display)
# Players table has captain_image_url (if available) or can use team captain info
</context>

<tasks>

<task type="auto">
  <name>task 1: Verify and update bids table schema</name>
  <files>supabase/migrations/20260306_bid_history.sql</files>
  <action>
Create migration file to verify and ensure bids table has required columns:

1. Check if bids table exists, if not create:
   - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
   - player_id UUID REFERENCES players(id)
   - team_id UUID REFERENCES teams(id)
   - bid_amount INTEGER NOT NULL
   - created_at TIMESTAMPTZ NOT NULL DEFAULT now()

2. Add index on (player_id, created_at DESC) for efficient top bid queries

3. Add index on team_id for team-specific bid history

4. Enable Realtime on bids table:
   - ALTER PUBLICATION supabase_realtime ADD TABLE bids;

5. Ensure teams table has logo_url column (add if missing):
   - ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url TEXT;

6. Ensure auction_rules table has captain_image_url (or similar) column for displaying captain image:
   - ALTER TABLE auction_rules ADD COLUMN IF NOT EXISTS captain_image_url TEXT;
   - Alternatively, use teams.team_logo if captain images not available

Reference ARCHITECTURE.md line 590 for bid cooldown index (can reuse same index).
</action>
  <verify>
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'supabase_migrations'
  AND table_name = '20260306_bid_history'
);
</verify>
  <done>Bids table schema verified with required columns and indexes</done>
</task>

<task type="auto">
  <name>task 2: Create useBids hook for real-time bid history</name>
  <files>src/hooks/useBids.ts</files>
  <action>
Create src/hooks/useBids.ts hook with real-time bid subscription:

Function signature:
export function useBids(playerId: string | null)

Logic:
1. If playerId is null, return empty bid list
2. Fetch bids for player ordered by created_at DESC:
   - Query: bids table with filter player_id=eq.{playerId}
   - Join with teams table to get team_name, logo_url
   - Order by created_at DESC, bid_amount DESC
   - Limit to 50 most recent bids (or all if needed)
3. Subscribe to INSERT and UPDATE events on bids table for current player:
   - Use Supabase Realtime Postgres Changes
   - Filter: player_id=eq.{playerId}
   - On INSERT: prepend new bid to local state
   - On UPDATE: update existing bid in local state (if bid amounts can be modified)
4. Return:
   - bids: Array of bid objects with team info
   - topBids: First 3 bids (highest amounts, most recent)
   - historyBids: All bids from index 3 onwards
   - isLoading: boolean

Bid object structure:
```typescript
{
  id: string;
  playerId: string;
  teamId: string;
  teamName: string;
  teamLogoUrl?: string;
  captainImageUrl?: string;
  bidAmount: number;
  createdAt: Date;
}
```

Use TanStack Query for data fetching and caching:
```typescript
const { data: bids, isLoading } = useQuery({
  queryKey: ['bids', playerId],
  queryFn: fetchBids,
  enabled: !!playerId,
});
```

Realtime subscription updates query cache via queryClient.setQueryData.

Reference ARCHITECTURE.md lines 372-378 for bid flow pattern.
</action>
  <verify>
grep -r "export.*useBids" src/hooks/useBids.ts
grep -r "postgres_changes\|Realtime.*bids" src/hooks/useBids.ts
</verify>
  <done>useBids hook created with real-time subscription</done>
</task>

<task type="auto">
  <name>task 3: Create BidHistory component for admin display</name>
  <files>src/components/admin/BidHistory.tsx</files>
<action>
Create src/components/admin/BidHistory.tsx component:

Props:
- bids: Bid[] (from useBids hook)
- currentBidAmount: number (current highest bid)

Display layout:

Section 1: Top 3 Bids (Prominent):
- Card layout with 3 large bid cards
- Each card shows:
  - Team logo (large, left side)
  - Captain image (right side, if available)
  - Team name (below logo, bold)
  - Captain name (below captain image, if available)
  - Bid amount (very large, prominent, centered)
  - Gold/silver/bronze badge for rank (1st, 2nd, 3rd)
- 1st place: Gold border/background, largest size
- 2nd place: Silver border/background, medium-large size
- 3rd place: Bronze border/background, medium size

Section 2: Bid History (4th onwards):
- Compact list view
- Each row shows:
  - Rank number (4, 5, 6, ...)
  - Team name
  - Bid amount
- Scrollable if > 10 bids
- Click to view full details (expand to show captain info)

Section 3: Bid Summary:
- Total bids count
- Current highest bid (from top 1)
- Last bid timestamp

Styling:
- Use Tailwind for responsive grid
- Top 3: 3-column grid on desktop, 1-column on mobile
- History: Table-like layout with hover effects
- Animation: New bid entry slides in with Framer Motion

If no bids:
- Display "No bids yet" message
- Show base price as reference
</action>
  <verify>
grep -r "export.*BidHistory" src/components/admin/BidHistory.tsx
grep -r "team.*logo\|captain.*image\|bid.*amount" src/components/admin/BidHistory.tsx
</verify>
  <done>BidHistory component created with top 3 prominent display and history list</done>
</task>

<task type="auto">
  <name>task 4: Update Captain Dashboard with bid display</name>
  <files>src/components/captain/page.tsx</files>
<action>
Update src/components/captain/page.tsx:

1. Integrate useBids hook:
   - Call useBids(currentPlayerId) when player deployed
   - Get topBids (first 3) and historyBids (index 3+)

2. Top 3 Bids Display (DISPLAY-01):
   - Position prominently on captain dashboard (above player card or side panel)
   - 3 large cards with team info:
     - Team logo (left)
     - Captain image (right)
     - Team name
     - Bid amount (very large)
   - 1st place: Highlighted with gold border
   - 2nd place: Silver border
   - 3rd place: Bronze border
   - Show "Top Bid" label on highest bid

3. Bid History Display (DISPLAY-02):
   - Below top 3, show compact list from 4th bid onwards
   - Each row: Team name + bid amount
   - Maximum 10 entries visible, scrollable for more
   - Simple list view (no captain images to save space)

4. Real-time Updates:
   - Bids appear instantly as captains place them
   - New bids animate in (Framer Motion slide effect)
   - Reorder top 3 automatically when new higher bid comes in

5. My Team's Bids:
   - Highlight bids from captain's own team
   - Show "Your bid" badge on own team's entries
   - Show remaining cooldown if placed bid recently (deferred to Phase 4)

6. Bid Increment Info:
   - Show "Next bid: ₹{topBid + 25000}" if bids exist
   - Show "Starting bid: ₹{basePrice}" if no bids

Layout (mobile-first):
- Top 3: 3-column grid (or stacked on mobile)
- History: Compact list below
- Player card above or below (design choice: side-by-side on desktop, stacked on mobile)

Ensure captain can see all bids but can only see their own cooldown status (deferred to Phase 4).
</action>
  <verify>
grep -r "useBids\|topBids\|historyBids" src/components/captain/page.tsx
grep -r "Top 3|bid history|team.*logo" src/components/captain/page.tsx
</verify>
  <done>Captain dashboard updated with top 3 bids and bid history display</done>
</task>

<task type="auto">
  <name>task 5: Update Admin Live Controller with bid display</name>
  <files>src/components/admin/LiveAuctionController.tsx</files>
<action>
Update src/components/admin/LiveAuctionController.tsx:

1. Integrate useBids hook:
   - Call useBids(currentPlayerId) when player deployed
   - Get topBids and historyBids

2. Top 3 Bids Display:
   - Use BidHistory component or similar layout
   - Show all 3 with team logos, captain images, bid amounts
   - Highlight top bid with gold badge

3. Full Bid History:
   - Show all bids (not limited to 10)
   - Include bid timestamp
   - Include captain name/image for all bids
   - Table or list view with sorting options

4. Admin-Specific Features:
   - View all bids with full team and captain details
   - See bid timestamps for audit trail
   - Export bid history (deferred to Phase 5)
   - Delete invalid bids (if needed, defer to Phase 5)

5. Sale Confirmation Integration:
   - When timer expires, show top bidder info prominently
   - "Confirm Sale" modal should display:
     - Winning team name and logo
     - Winning bid amount
     - Captain name and image
     - Bid timestamp
   - "Modify Bid/Team" option allows admin to adjust before finalizing

Layout:
- Left panel: Timer, controls, player card
- Right panel: Top 3 bids + full history
- Or: Player card top, timer and controls middle, bid history bottom
</action>
  <verify>
grep -r "useBids\|BidHistory\|topBids" src/components/admin/LiveAuctionController.tsx
</verify>
  <done>Admin Live Controller updated with bid display and integration</done>
</task>

</tasks>

<verification>
1. Bids table has required columns and indexes
2. Realtime subscription works (new bids appear instantly on admin and captain dashboards)
3. Top 3 bids display prominently with team name, logo, captain image, bid amount
4. Bid history from 4th onwards displays with team name and amount only
5. Captain dashboard shows top 3 in prominent cards and history in compact list
6. Admin Live Controller shows all bids with full details
7. Bids reorder automatically when new higher bids come in
8. New bids animate in with slide effect
9. My team's bids are highlighted on captain dashboard
</verification>

<success_criteria>
1. Top 3 bids are displayed prominently with team name, logo, captain image, and bid amount to all captains
2. Bid history from 4th bid onwards is displayed with team name and amount only
3. Bid history updates in real-time as captains place bids
4. Admin Live Controller shows all bids with team details
5. Captain Dashboard shows top 3 prominently and history from 4th onwards
</success_criteria>

<output>
After completion, create `.planning/phases/phase-3/3-live-auction-core-03-SUMMARY.md`
</output>
