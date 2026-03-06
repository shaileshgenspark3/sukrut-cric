# Architecture Research

**Domain:** Real-time Auction System
**Researched:** 2026-03-06
**Confidence:** HIGH

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           Client Layer (Next.js)                        │
├──────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐│
│  │   Admin UI   │  │  Captain UI  │  │  Landing UI  │  │  Auth UI     ││
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘│
│         │                  │                  │                 │         │
├─────────┼──────────────────┼──────────────────┼─────────────────┼─────────┤
│         │   ┌──────────────────────────────────────────────┐         │         │
│         │   │     Supabase Realtime (Postgres Changes)     │         │         │
│         │   │  Bid sync, Timer updates, State propagation   │         │         │
│         │   └──────────────────────────────────────────────┘         │         │
├─────────┼──────────────────┼──────────────────┼─────────────────┼─────────┤
│  ┌──────▼───────┐  ┌───────▼───────┐  ┌───────▼───────┐  ┌─────▼─────┐│
│  │ Query Hooks  │  │ Timer Service│  │ CSV Service   │  │ Auth Hook  ││
│  └──────┬───────┘  └───────┬───────┘  └───────┬───────┘  └─────┬─────┘│
└─────────┼──────────────────┼──────────────────┼─────────────────┼─────────┘
          │                  │                  │                 │
          └──────────────────┼──────────────────┼─────────────────┘
                             │                  │
┌────────────────────────────┼──────────────────┼──────────────────────────────────┐
│  Server Actions (Next.js)  │                  │                                  │
│  ┌───────────────────────┐ │                  │                                  │
│  │  Bid Validation       │ │                  │                                  │
│  │  Timer Control        │ │                  │                                  │
│  │  Captain Assignment   │ │                  │                                  │
│  │  Log Entry Operations │ │                  │                                  │
│  │  CSV Import/Export    │ │                  │                                  │
│  │  Manual Sales         │ │                  │                                  │
│  └───────────┬───────────┘                  │                                  │
└──────────────┼──────────────────────────────┼──────────────────────────────────┘
               │                              │
┌──────────────┼──────────────────────────────┼──────────────────────────────────┐
│         Supabase PostgreSQL + Edge Functions │                                  │
│  ┌───────────────────────────────────────────┐                                  │
│  │  Database Layer                           │                                  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │                                  │
│  │  │  Tables  │ │  RLS     │ │ Triggers │  │                                  │
│  │  └──────────┘ └──────────┘ └──────────┘  │                                  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │                                  │
│  │  │  Views   │ │  RPCs    │ │  Pubs    │  │                                  │
│  │  └──────────┘ └──────────┘ └──────────┘  │                                  │
│  └───────────────────────────────────────────┘                                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Admin UI | Live auction control, player management, log operations, captain assignment | React Server Components + Client Components with Framer Motion |
| Captain UI | Bidding interface, purse visualization, max bid alerts, bid cooldown display | React Client Components with real-time subscriptions |
| Query Hooks (TanStack Query) | Data fetching, caching, invalidation, optimistic updates | Custom hooks using @tanstack/react-query |
| Realtime Service | Subscribe to Postgres changes, broadcast events, presence tracking | Supabase Realtime Postgres Changes |
| Timer Service | Countdown management, pause/resume state, expiry handling | Client-side interval + Server Actions for state sync |
| CSV Service | Parse imports, format exports, validate data | papaparse library |
| Server Actions | Bid validation, rule enforcement, database transactions | Next.js Server Actions with Zod validation |
| PostgreSQL | Data persistence, RLS enforcement, constraints, triggers | Supabase PostgreSQL with row-level security |

## Recommended Project Structure

```
src/
├── app/
│   ├── admin/
│   │   ├── page.tsx                    # Admin dashboard (Overview, Players, Rules tabs)
│   │   ├── captain-selection/          # NEW: Captain assignment UI
│   │   ├── log-entries/                # NEW: Auction log with CSV export/reverse
│   │   └── live-auction/               # Live controller with timer, ban controls
│   ├── captain/
│   │   └── page.tsx                    # Captain dashboard with bidding
│   └── layout.tsx
├── components/
│   ├── admin/
│   │   ├── LiveAuctionController.tsx   # Timer, player deployment, ban controls
│   │   ├── PlayerCard.tsx             # Detailed player display
│   │   ├── BidHistory.tsx             # Top 3 + history list
│   │   ├── CaptainSelector.tsx        # NEW: Assign captains to teams
│   │   ├── CSVUploader.tsx            # NEW: Bulk player import
│   │   ├── LogEntriesTable.tsx        # NEW: Auction log with actions
│   │   └── ManualSaleDialog.tsx       # NEW: Manual sale with strict/override modes
│   ├── captain/
│   │   ├── BidButton.tsx               # Bid button with cooldown indicator
│   │   ├── MaxBidAlert.tsx             # NEW: Red alert for max bid exceeded
│   │   ├── PurseDisplay.tsx            # Purse visualization
│   │   └── CategoryRestrictionAlert.tsx # NEW: Alert for category limits
│   └── shared/
│       ├── TimerDisplay.tsx            # Countdown timer (pause/resume)
│       └── RealtimeProvider.tsx        # Supabase realtime setup
├── hooks/
│   ├── useRealtime.ts                  # Existing: Realtime subscription hook
│   ├── useAuctionState.ts              # NEW: Auction state with timer
│   ├── useBids.ts                      # NEW: Bid history with real-time updates
│   ├── useTimer.ts                     # NEW: Timer management (pause/resume/expiry)
│   ├── useBidValidation.ts             # NEW: Bid validation with max bid calc
│   └── useTeamRestrictions.ts          # NEW: Category/purse checks
├── services/
│   ├── timer/
│   │   └── timerService.ts             # Timer state management
│   ├── auction/
│   │   ├── bidValidation.ts            # NEW: Complex bid validation logic
│   │   ├── maxBidCalculator.ts         # NEW: Max bid calculation algorithm
│   │   └── teamRestrictions.ts         # NEW: Category/purse rule enforcement
│   └── csv/
│       ├── csvParser.ts                # NEW: CSV parsing/validation
│       └── csvExporter.ts              # NEW: CSV formatting/export
├── actions/
│   ├── auction.ts                      # Existing: Auction actions
│   ├── timer.ts                        # NEW: Timer control (start/pause/resume)
│   ├── bids.ts                         # NEW: Place bid with cooldown check
│   ├── captain.ts                      # NEW: Captain assignment operations
│   ├── players.ts                      # Existing + NEW: CSV import, erase all
│   ├── log-entries.ts                  # NEW: Log CRUD operations (reverse sale)
│   └── manual-sales.ts                 # NEW: Manual sale with validation
└── lib/
    ├── supabase.ts                     # Existing: Supabase client
    ├── validators/
    │   ├── bidValidator.ts             # NEW: Bid validation schemas
    │   ├── csvValidator.ts             # NEW: CSV validation schemas
    │   └── timerValidator.ts           # NEW: Timer config validation
    └── types/
        └── auction.ts                  # Type definitions for auction entities
```

### Structure Rationale

- **`components/admin/`**: Admin-specific components requiring higher privileges
- **`components/captain/`**: Captain-specific UI with restricted access
- **`hooks/`**: Custom hooks for state management, reusing TanStack Query patterns
- **`services/`**: Business logic separation from UI, testable in isolation
- **`actions/`**: Server actions for database operations with validation
- **`lib/validators/`**: Zod schemas for request validation, preventing bad data

## Architectural Patterns

### Pattern 1: Single Source of Truth (Auction State)

**What:** All auction state lives in PostgreSQL (`auction_state` table). Clients subscribe to changes via Supabase Realtime.

**When to use:** Any state that needs synchronization across multiple clients (timer, current bid, player status).

**Trade-offs:**
- **Pros:** Consistent state, no race conditions, easy debugging, built-in persistence
- **Cons:** Additional network latency, requires careful RLS design

**Example:**
```typescript
// hooks/useAuctionState.ts
export function useAuctionState() {
  return useQuery({
    queryKey: ['auctionState'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auction_state')
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// Subscribe to changes
export function useAuctionStateRealtime() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel('auction_state_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'auction_state',
      }, (payload) => {
        queryClient.setQueryData(['auctionState'], payload.new);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [queryClient]);
}
```

### Pattern 2: Client-Side Timer with Server Sync

**What:** Timer countdown runs on client-side for responsiveness, but authoritative state lives in database. Periodic sync via server actions.

**When to use:** Real-time countdowns with pause/resume where precision isn't critical but user experience is.

**Trade-offs:**
- **Pros:** Smooth animations, low latency, works offline briefly
- **Cons:** Clients can desync, requires conflict resolution

**Example:**
```typescript
// hooks/useTimer.ts
export function useTimer() {
  const [localTimer, setLocalTimer] = useState<number | null>(null);
  const [isPaused, setIsPaused] = useState(false);

  // Sync with database periodically
  const syncTimer = async () => {
    const { data } = await supabase
      .from('auction_state')
      .select('timer_end, is_paused')
      .single();
    if (data?.timer_end) {
      const remaining = Math.max(0, new Date(data.timer_end).getTime() - Date.now());
      setLocalTimer(remaining / 1000);
      setIsPaused(data.is_paused);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isPaused && localTimer !== null && localTimer > 0) {
        setLocalTimer(localTimer - 0.1); // 100ms tick
      }
    }, 100);

    const syncInterval = setInterval(syncTimer, 5000); // Sync every 5s

    return () => {
      clearInterval(interval);
      clearInterval(syncInterval);
    };
  }, [localTimer, isPaused]);

  const pauseTimer = async () => {
    await supabase.rpc('pause_auction_timer');
    setIsPaused(true);
  };

  const resumeTimer = async () => {
    await supabase.rpc('resume_auction_timer');
    setIsPaused(false);
  };

  return { localTimer, isPaused, pauseTimer, resumeTimer };
}
```

### Pattern 3: Validated Server Actions

**What:** All mutations go through Server Actions with Zod validation before database operations.

**When to use:** Any state mutation (bids, timer changes, manual sales, CSV imports).

**Trade-offs:**
- **Pros:** Type safety, validation before DB, security, better error messages
- **Cons:** Additional code overhead, requires schema definitions

**Example:**
```typescript
// actions/bids.ts
import { z } from 'zod';
import { supabase } from '@/lib/supabase';

const PlaceBidSchema = z.object({
  playerId: z.string().uuid(),
  teamId: z.string().uuid(),
  bidAmount: z.number().int().positive(),
});

export async function placeBid(formData: z.infer<typeof PlaceBidSchema>) {
  const validated = PlaceBidSchema.parse(formData);

  // Check cooldown
  const { data: lastBid } = await supabase
    .from('bids')
    .select('created_at')
    .eq('team_id', validated.teamId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (lastBid && Date.now() - new Date(lastBid.created_at).getTime() < 3000) {
    throw new Error('Bid cooldown active. Wait 3 seconds.');
  }

  // Check max bid
  const { data: maxBid } = await supabase
    .rpc('calculate_max_bid', { team_id: validated.teamId });

  if (validated.bidAmount > maxBid) {
    throw new Error(`Bid exceeds maximum allowed: ${maxBid}`);
  }

  // Check category restrictions
  const { data: categoryCheck } = await supabase
    .rpc('can_bid_for_player', {
      team_id: validated.teamId,
      player_id: validated.playerId,
      bid_amount: validated.bidAmount,
    });

  if (!categoryCheck.can_bid) {
    throw new Error(categoryCheck.reason || 'Cannot bid: category limit reached.');
  }

  // Place bid in transaction
  const { error } = await supabase.rpc('place_bid_transaction', {
    p_player_id: validated.playerId,
    p_team_id: validated.teamId,
    p_bid_amount: validated.bidAmount,
  });

  if (error) throw error;

  revalidatePath('/admin');
  revalidatePath('/captain');
}
```

## Data Flow

### Request Flow

```
[Captain clicks bid]
    ↓
[Client: useTimer check cooldown]
    ↓
[Client: useBidValidation check max bid]
    ↓
[Server Action: placeBid()]
    ↓
[Zod Schema Validation]
    ↓
[RPC: check_cooldown()]
    ↓
[RPC: calculate_max_bid()]
    ↓
[RPC: can_bid_for_player()]
    ↓
[RPC: place_bid_transaction()]
    ↓
[PostgreSQL: INSERT bids, UPDATE auction_state]
    ↓
[Supabase Realtime: broadcasts change]
    ↓
[All clients receive update]
    ↓
[TanStack Query: invalidates queries]
    ↓
[UI re-renders with new state]
```

### State Management

```
[PostgreSQL Database]
    ↓ (Supabase Realtime Postgres Changes)
[TanStack Query Cache]
    ↓ (useQuery hooks)
[React Components]
    ↓ (Server Actions + Zod validation)
[RPC Functions + Database Transactions]
    ↓
[PostgreSQL Database]
```

### Key Data Flows

1. **Bid Placement Flow:**
   - Client validates locally (cooldown, max bid)
   - Server action validates via RPCs (cooldown, max bid, category, purse)
   - Transaction inserts bid, updates auction_state
   - Realtime broadcasts to all clients
   - Admin UI shows top 3, Captain UI shows alert if over max

2. **Timer Flow:**
   - Client maintains local countdown (100ms intervals)
   - Periodic sync with database (every 5s) to prevent drift
   - Server action handles pause/resume via RPC
   - Timer expiry triggers server action that asks admin for decision

3. **Captain Assignment Flow:**
   - Admin selects captain from player list → assigns to team
   - Server action updates teams table (captain_id, captain_deduction)
   - Server action updates auction_rules (captain_deduction)
   - Server action marks player as `is_captain = true` in players
   - Server action adds player to roster with sold_price=0
   - Realtime broadcasts changes
   - Captain UI shows updated purse

4. **Log Entry Flow (Reverse Sale):**
   - Admin deletes log entry
   - Server action restores team purse (auction_rules.current_purse)
   - Server action frees player (players.sold_to_team_id = NULL, is_sold = false)
   - Server action removes player from team roster
   - Realtime broadcasts changes
   - Player becomes available for auction

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-100 users | Current monolith is fine. Supabase Free tier handles this easily. |
| 100-1,000 users | Consider separate "bids" and "auction_state" publications to reduce load. Optimize RLS policies. |
| 1,000-10,000 users | Use Supabase Broadcast instead of Postgres Changes for high-frequency updates. Implement rate limiting on bid placement. |
| 10,000+ users | Consider dedicated timer service (Edge Function) for authoritative time. Separate read replicas for auction dashboard queries. |

### Scaling Priorities

1. **First bottleneck:** Postgres Changes throughput at high subscriber count. RLS checks on every change become expensive.
   - **Fix:** Use separate public tables without RLS for high-frequency data (bids). Or use Broadcast for non-sensitive updates.

2. **Second bottleneck:** Timer synchronization across clients with network latency.
   - **Fix:** Move timer to Edge Function with WebSocket broadcasting. Clients only display, not compute.

## Anti-Patterns

### Anti-Pattern 1: Client-Side Timer Authority

**What people do:** Implement timer entirely in React state with `setInterval`, syncing only occasionally.

**Why it's wrong:** Clients can desync due to network delays, device performance, or deliberate manipulation. Timer expiry becomes inconsistent across clients.

**Do this instead:** Store authoritative timer state in database (`auction_state.timer_end`). Clients only display countdown based on server state. Use server-side RPCs for pause/resume/expiry.

### Anti-Pattern 2: Race Conditions in Bid Validation

**What people do:** Check max bid in client, then place bid in separate request without transaction.

**Why it's wrong:** Multiple clients can check simultaneously, see same "available funds," and both place bids that exceed purse. Race condition causes overspending.

**Do this instead:** Use PostgreSQL RPC function with transactional validation. All checks (cooldown, max bid, category, purse) happen atomically with bid placement.

### Anti-Pattern 3: No Bid Cooldown Enforcement

**What people do:** Allow rapid-fire bidding with only UI button disabling (no server check).

**Why it's wrong:** Malicious clients can bypass UI restrictions, spam bids, and overwhelm the auction. Disrupts other participants' experience.

**Do this instead:** Enforce cooldown server-side with timestamp check on last bid. Reject bids within cooldown period with error.

### Anti-Pattern 4: Direct CSV Parsing Without Validation

**What people do:** Parse CSV and directly insert into database without schema validation.

**Why it's wrong:** Malformed data, wrong types, missing required fields, or invalid categories corrupt the database. Hard to recover from.

**Do this instead:** Use Zod schema to validate each row before insertion. Batch valid rows, reject invalid rows with clear error messages. Show preview before import.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase Realtime | Postgres Changes subscriptions for bids, auction_state, players, teams | Already integrated via useRealtime.ts hook. Need to add timer_sync channel for timer updates. |
| papaparse | Client-side CSV parsing | For admin CSV import. Use PapaParse with header row validation. |
| Supabase Storage (optional) | Team logos, captain images | Not in scope for this milestone, but architecture supports it. |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| Admin UI ↔ Captain UI | Supabase Realtime (bid synchronization, timer state) | Both subscribe to same channels. Admin has write access, Captain has limited write. |
| Client Components ↔ Server Actions | HTTP POST (Next.js Server Actions) | All mutations go through actions. No direct database access from client. |
| Timer Service ↔ Auction State | PostgreSQL RPC calls (pause/resume) | Timer state stored in auction_state table. Client polls for sync. |
| Bid Validation ↔ Database | PostgreSQL RPC functions with transactions | Atomic validation + bid placement prevents race conditions. |

## Database Schema Considerations for NEW Features

### Captain Assignment System

**New columns needed:**
```sql
-- Add to players table
ALTER TABLE players ADD COLUMN is_captain BOOLEAN DEFAULT FALSE;
ALTER TABLE players ADD COLUMN captain_team_id UUID REFERENCES teams(id);

-- Add to teams table
ALTER TABLE teams ADD COLUMN captain_player_id UUID REFERENCES players(id);

-- New view for captain assignment
CREATE VIEW captains_assignment_view AS
SELECT 
  t.id AS team_id,
  t.team_name,
  p.id AS captain_player_id,
  p.name AS captain_name,
  p.category AS captain_category,
  ar.captain_deduction
FROM teams t
LEFT JOIN players p ON t.captain_player_id = p.id
LEFT JOIN auction_rules ar ON t.id = ar.team_id;
```

**Indexes:**
```sql
CREATE INDEX idx_players_is_captain ON players(is_captain);
CREATE INDEX idx_players_captain_team_id ON players(captain_team_id);
CREATE INDEX idx_teams_captain_player_id ON teams(captain_player_id);
```

### Timer Management System

**New columns in auction_state:**
```sql
ALTER TABLE auction_state
ADD COLUMN timer_end TIMESTAMPTZ,
ADD COLUMN initial_timer_seconds INTEGER DEFAULT 30,
ADD COLUMN first_bid_timer_seconds INTEGER DEFAULT 30,
ADD COLUMN subsequent_bid_timer_seconds INTEGER DEFAULT 15,
ADD COLUMN is_paused BOOLEAN DEFAULT FALSE,
ADD COLUMN paused_at TIMESTAMPTZ,
ADD COLUMN last_bid_at TIMESTAMPTZ;
```

**RPC functions:**
```sql
-- Start/resume timer
CREATE OR REPLACE FUNCTION start_auction_timer(
  p_initial_seconds INTEGER DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_initial INTEGER;
BEGIN
  IF p_initial_seconds IS NOT NULL THEN
    UPDATE auction_state 
    SET initial_timer_seconds = p_initial_seconds;
  END IF;

  SELECT initial_timer_seconds INTO v_initial FROM auction_state;
  
  UPDATE auction_state 
  SET timer_end = now() + (v_initial || ' seconds')::interval,
      is_paused = FALSE,
      paused_at = NULL;
END;
$$ LANGUAGE plpgsql;

-- Pause timer
CREATE OR REPLACE FUNCTION pause_auction_timer() RETURNS void AS $$
BEGIN
  UPDATE auction_state 
  SET is_paused = TRUE,
      paused_at = timer_end;
END;
$$ LANGUAGE plpgsql;

-- Resume timer (adjust timer_end by pause duration)
CREATE OR REPLACE FUNCTION resume_auction_timer() RETURNS void AS $$
DECLARE
  v_pause_duration INTERVAL;
  v_remaining_seconds NUMERIC;
BEGIN
  -- Calculate how long timer was paused
  SELECT EXTRACT(EPOCH FROM (paused_at - now())) INTO v_pause_duration
  FROM auction_state;
  
  -- Adjust timer_end by pause duration
  UPDATE auction_state 
  SET timer_end = timer_end + v_pause_duration,
      is_paused = FALSE,
      paused_at = NULL;
END;
$$ LANGUAGE plpgsql;

-- Check if timer expired
CREATE OR REPLACE FUNCTION is_timer_expired() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auction_state 
    WHERE timer_end IS NOT NULL 
      AND timer_end <= now()
      AND is_paused = FALSE
      AND status IN ('bidding', 'waiting_for_first_bid')
  );
END;
$$ LANGUAGE plpgsql;
```

### Bid Cooldown Mechanism

**New index for efficient cooldown checks:**
```sql
CREATE INDEX idx_bids_team_created ON bids(team_id, created_at DESC);
```

**RPC function:**
```sql
CREATE OR REPLACE FUNCTION check_bid_cooldown(
  p_team_id UUID,
  p_cooldown_seconds INTEGER DEFAULT 3
) RETURNS JSON AS $$
DECLARE
  v_last_bid_time TIMESTAMPTZ;
  v_can_bid BOOLEAN;
  v_remaining_seconds NUMERIC;
BEGIN
  SELECT created_at INTO v_last_bid_time
  FROM bids
  WHERE team_id = p_team_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_last_bid_time IS NULL THEN
    v_can_bid := TRUE;
    v_remaining_seconds := 0;
  ELSE
    v_remaining_seconds := p_cooldown_seconds - EXTRACT(EPOCH FROM (now() - v_last_bid_time));
    v_can_bid := v_remaining_seconds <= 0;
    IF v_remaining_seconds < 0 THEN
      v_remaining_seconds := 0;
    END IF;
  END IF;

  RETURN json_build_object(
    'can_bid', v_can_bid,
    'remaining_seconds', v_remaining_seconds
  );
END;
$$ LANGUAGE plpgsql;
```

### Complex Max Bid Calculation

**RPC function:**
```sql
CREATE OR REPLACE FUNCTION calculate_max_bid(
  p_team_id UUID
) RETURNS INTEGER AS $$
DECLARE
  v_current_purse INTEGER;
  v_team_players JSONB;
  v_category_counts JSONB;
  v_male_count INTEGER;
  v_female_count INTEGER;
  v_slots_remaining INTEGER;
  v_max_slot_cost INTEGER;
  v_base_prices JSONB;
  v_player_category TEXT;
  v_current_player_price INTEGER;
BEGIN
  -- Get current purse
  SELECT current_purse INTO v_current_purse
  FROM auction_rules
  WHERE team_id = p_team_id;

  -- Get roster composition
  SELECT jsonb_agg(
    jsonb_build_object(
      'category', p.category,
      'sold_price', COALESCE(p.sold_price, p.base_price)
    )
  ) INTO v_team_players
  FROM players p
  WHERE p.sold_to_team_id = p_team_id AND p.is_captain = FALSE;

  -- Count by category
  SELECT jsonb_object_agg(category, count) INTO v_category_counts
  FROM (
    SELECT category, COUNT(*) as count
    FROM players
    WHERE sold_to_team_id = p_team_id AND is_captain = FALSE
    GROUP BY category
  ) t;

  -- Gender counts
  SELECT 
    COUNT(*) FILTER (WHERE gender = 'Male' AND is_captain = FALSE) INTO v_male_count,
    COUNT(*) FILTER (WHERE gender = 'Female' AND is_captain = FALSE) INTO v_female_count
  FROM players
  WHERE sold_to_team_id = p_team_id;

  -- Calculate remaining slots
  v_slots_remaining := 8 - (v_male_count + v_female_count);

  -- Base prices by category
  v_base_prices := '{"A+": 500000, "A": 200000, "B": 100000, "F": 50000}'::jsonb;

  -- Calculate cost of filling remaining slots with cheapest options
  -- (Simplified: assume remaining slots are all category B for estimation)
  v_max_slot_cost := v_slots_remaining * (v_base_prices->>'B')::INTEGER;

  -- Max bid = current purse - cost of remaining slots + current player's price
  -- This ensures team can still fill roster after this bid
  RETURN v_current_purse - v_max_slot_cost;
END;
$$ LANGUAGE plpgsql;
```

### Reverse Sale (Log Entries) System

**New table:**
```sql
CREATE TABLE auction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES players(id),
  player_name TEXT NOT NULL,
  player_category TEXT NOT NULL,
  team_id UUID NOT NULL REFERENCES teams(id),
  team_name TEXT NOT NULL,
  sold_price INTEGER NOT NULL,
  sold_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_manual_sale BOOLEAN DEFAULT FALSE,
  mode TEXT CHECK (mode IN ('strict', 'override')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE auction_log ENABLE ROW LEVEL SECURITY;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE auction_log;

-- Indexes
CREATE INDEX idx_auction_log_team_id ON auction_log(team_id);
CREATE INDEX idx_auction_log_player_id ON auction_log(player_id);
CREATE INDEX idx_auction_log_sold_at ON auction_log(sold_at DESC);
```

**RPC function for reverse sale:**
```sql
CREATE OR REPLACE FUNCTION reverse_sale(
  p_log_id UUID
) RETURNS void AS $$
DECLARE
  v_log auction_log%ROWTYPE;
  v_deduction INTEGER;
BEGIN
  -- Get log entry
  SELECT * INTO v_log FROM auction_log WHERE id = p_log_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Log entry not found';
  END IF;

  -- Calculate deduction based on category
  v_deduction := CASE v_log.player_category
    WHEN 'A+' THEN 500000
    WHEN 'A' THEN 200000
    WHEN 'B' THEN 100000
    WHEN 'F' THEN 50000
    ELSE 100000
  END;

  -- Restore team purse
  UPDATE auction_rules
  SET current_purse = current_purse + v_log.sold_price
  WHERE team_id = v_log.team_id;

  -- Free player
  UPDATE players
  SET is_sold = FALSE,
      sold_to_team_id = NULL,
      sold_price = NULL
  WHERE id = v_log.player_id;

  -- Delete log entry
  DELETE FROM auction_log WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql;
```

### CSV Bulk Operations

**No schema changes needed.** Use papaparse on client-side, validate with Zod, batch insert via server action.

### Team Restriction Enforcement

**RPC function for comprehensive bid validation:**
```sql
CREATE OR REPLACE FUNCTION can_bid_for_player(
  p_team_id UUID,
  p_player_id UUID,
  p_bid_amount INTEGER
) RETURNS JSON AS $$
DECLARE
  v_current_purse INTEGER;
  v_max_bid INTEGER;
  v_player players%ROWTYPE;
  v_male_count INTEGER;
  v_female_count INTEGER;
  v_category_counts JSONB;
  v_a_plus_count INTEGER;
  v_a_count INTEGER;
  v_b_count INTEGER;
  v_f_count INTEGER;
  v_result JSONB := '{"can_bid": true}'::jsonb;
BEGIN
  -- Get player info
  SELECT * INTO v_player FROM players WHERE id = p_player_id;

  -- Get current purse
  SELECT current_purse INTO v_current_purse
  FROM auction_rules
  WHERE team_id = p_team_id;

  -- Check if team can afford bid
  IF p_bid_amount > v_current_purse THEN
    v_result := jsonb_set(v_result, '{can_bid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"Insufficient purse"'::jsonb);
    RETURN v_result;
  END IF;

  -- Calculate max bid
  SELECT calculate_max_bid(p_team_id) INTO v_max_bid;

  IF p_bid_amount > v_max_bid THEN
    v_result := jsonb_set(v_result, '{can_bid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', 
      ('Bid exceeds maximum allowed: ' || v_max_bid)::jsonb
    );
    RETURN v_result;
  END IF;

  -- Get current roster composition
  SELECT 
    COUNT(*) FILTER (WHERE gender = 'Male' AND is_captain = FALSE) INTO v_male_count,
    COUNT(*) FILTER (WHERE gender = 'Female' AND is_captain = FALSE) INTO v_female_count
  FROM players
  WHERE sold_to_team_id = p_team_id;

  -- Check roster limits
  IF v_player.gender = 'Male' AND v_male_count >= 7 THEN
    v_result := jsonb_set(v_result, '{can_bid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"Male roster full (max 7)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_player.gender = 'Female' AND v_female_count >= 2 THEN
    v_result := jsonb_set(v_result, '{can_bid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"Female roster full (max 2)"'::jsonb);
    RETURN v_result;
  END IF;

  -- Check category limits
  SELECT jsonb_object_agg(category, count) INTO v_category_counts
  FROM (
    SELECT category, COUNT(*) as count
    FROM players
    WHERE sold_to_team_id = p_team_id AND is_captain = FALSE
    GROUP BY category
  ) t;

  v_a_plus_count := COALESCE((v_category_counts->>'A+')::INTEGER, 0);
  v_a_count := COALESCE((v_category_counts->>'A')::INTEGER, 0);
  v_b_count := COALESCE((v_category_counts->>'B')::INTEGER, 0);
  v_f_count := COALESCE((v_category_counts->>'F')::INTEGER, 0);

  IF v_player.category = 'A+' AND v_a_plus_count >= 1 THEN
    v_result := jsonb_set(v_result, '{can_bid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"A+ category full (max 1)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_player.category = 'A' AND v_a_count >= 3 THEN
    v_result := jsonb_set(v_result, '{can_bid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"A category full (max 3)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_player.category = 'B' AND v_b_count >= 4 THEN
    v_result := jsonb_set(v_result, '{can_bid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"B category full (max 4)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_player.category = 'F' AND v_f_count >= 1 THEN
    v_result := jsonb_set(v_result, '{can_bid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"F category full (max 1)"'::jsonb);
    RETURN v_result;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

### Manual Sale System

**RPC function:**
```sql
CREATE OR REPLACE FUNCTION manual_sale(
  p_player_id UUID,
  p_team_id UUID,
  p_sold_price INTEGER,
  p_mode TEXT DEFAULT 'strict' -- 'strict' or 'override'
) RETURNS void AS $$
DECLARE
  v_validation JSON;
BEGIN
  -- Validate if strict mode
  IF p_mode = 'strict' THEN
    SELECT can_bid_for_player(p_team_id, p_player_id, p_sold_price) INTO v_validation;
    
    IF NOT (v_validation->>'can_bid')::BOOLEAN THEN
      RAISE EXCEPTION 'Manual sale validation failed: %', v_validation->>'reason';
    END IF;
  END IF;

  -- Perform sale
  PERFORM place_bid_transaction(p_player_id, p_team_id, p_sold_price);
  
  -- Mark player as sold
  UPDATE players
  SET is_sold = TRUE,
      sold_to_team_id = p_team_id,
      sold_price = p_sold_price
  WHERE id = p_player_id;

  -- Create log entry
  INSERT INTO auction_log (
    player_id, player_name, player_category, team_id, team_name, sold_price, is_manual_sale, mode
  )
  SELECT 
    p.id, p.name, p.category, t.id, t.team_name, p_sold_price, TRUE, p_mode
  FROM players p
  JOIN teams t ON t.id = p_team_id
  WHERE p.id = p_player_id;
END;
$$ LANGUAGE plpgsql;
```

## Sources

- Supabase Realtime Architecture (HIGH): https://supabase.com/docs/guides/realtime/architecture
- Supabase Postgres Changes (HIGH): https://supabase.com/docs/guides/realtime/postgres-changes
- PostgreSQL Date/Time Functions (HIGH): https://www.postgresql.org/docs/current/functions-datetime.html
- Next.js Server Actions (HIGH): https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations
- TanStack Query (HIGH): https://tanstack.com/query/latest
- Zod Validation (HIGH): https://zod.dev
- PapaParse CSV (HIGH): https://www.papaparse.com

---
*Architecture research for: Real-time Cricket Auction System*
*Researched: 2026-03-06*
