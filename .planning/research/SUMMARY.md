# Project Research Summary

**Project:** Real-time Cricket Auction Management System Enhancement
**Domain:** Real-time Auction System
**Researched:** 2026-03-06
**Confidence:** HIGH

## Executive Summary

This project is a real-time cricket auction system that requires synchronous state management across multiple participants with complex business rules. Research indicates the recommended approach is a database-driven architecture with PostgreSQL as the single source of truth, Supabase Realtime for state propagation, and comprehensive server-side validation for all auction operations. The system must handle race conditions (simultaneous bids), prevent timer desynchronization (critical for fair auctions), and enforce complex rules (category limits, purse constraints, roster composition) at the database level.

Key risks identified center on race conditions in bidding logic, timer drift during pause/resume cycles, and incorrect max bid calculations that could allow teams to overspend. Mitigation strategies include implementing `SELECT FOR UPDATE` locking for bid transactions, storing timer expiry timestamps in the database rather than client-side state, and creating comprehensive database functions for validation before accepting any bid. The research indicates that client-side validations are insufficient and all critical auction logic must be enforced server-side with immutable audit trails for dispute resolution.

## Key Findings

### Recommended Stack

Existing Next.js 16.1.6 + React 19.2.3 + Supabase 2.98.0 + TypeScript 5 stack is well-suited for real-time auction requirements. NEW features require targeted additions: react-timer-hook 4.0.4 for countdown management (pause/resume/expiry), Zod 4 for TypeScript-first schema validation of complex business rules, and SheetJS/xlsx for Excel export functionality. TanStack Query should be used with optimistic updates for bid synchronization, and Supabase Realtime Postgres Changes is the correct mechanism for state propagation (not Broadcast).

**Core technologies:**
- **Next.js 16.1.6 / React 19.2.3** — Existing framework, supports SSR and App Router for auction UI
- **Supabase 2.98.0** — Database + Realtime (Postgres Changes) for bid synchronization
- **TypeScript 5** — Type safety for complex business rules and validation
- **react-timer-hook 4.0.4** — Configurable countdown timers with pause/resume/restart (latest release Mar 2025)
- **Zod 4** — Schema validation for team composition, max bid calculations, CSV imports
- **TanStack Query** — Data fetching with optimistic updates to prevent UI jank

### Expected Features

All v1 features are already implemented per the research. The MVP includes real-time bid broadcasting, purse/balance tracking, player roster display (max 9), player categorization (A+, A, B, C, F), admin controls, bid history, and all differentiators that provide competitive advantage. v1.x features (top 3 bids prominence, enhanced visualizations) and v2+ features (video streaming, mobile apps, post-auction analytics) are deferred until product-market fit is validated.

**Must have (table stakes):**
- Real-time bid broadcasting — Auctions are live events; participants need instant updates
- Purse/balance tracking — Teams cannot exceed budget; critical for fairness
- Player categorization & roster limits — Different rules per category, enforce squad size (9 max)
- Admin controls (start/pause/stop) — Orchestrate auction phases
- Bid history & sold/unsold lists — Transparency and audit trail

**Should have (competitive):**
- Automatic bid validation with max bid alerts — Prevents overspending before it happens
- Category-wise purse deduction — Realistic pricing (A+=5L, A=2L, B=1L, F=50k)
- Team composition enforcement — Balanced rosters (Male: 1 A+, 3 A, 4 B; Female: 1 F)
- Configurable timers & cooldown — 30s first bid, 15s after, 3s cooldown between bids
- CSV export/reverse sales — Data safety and undo capability for live events

**Defer (v2+):**
- Video streaming integration — Not core auction functionality; bandwidth-heavy
- Mobile native apps — Web app already mobile-responsive; PWA sufficient
- Multiple concurrent auctions — Database complexity for parallel events
- Post-auction analytics — Nice-to-have after product-market fit

### Architecture Approach

Database-driven architecture with PostgreSQL as single source of truth, Supabase Realtime for state propagation, and comprehensive server-side validation via Next.js Server Actions. Components are clearly separated: Admin UI for auction orchestration, Captain UI for bidding, Timer Service for countdown management, and CSV Service for bulk operations. All mutations go through validated server actions with Zod schemas, and state synchronization relies on Postgres Changes subscriptions (not Broadcast).

**Major components:**
1. **Client Layer (Next.js)** — Admin UI, Captain UI, Landing UI, Auth UI with React Server + Client components
2. **Supabase Realtime** — Postgres Changes for bid sync, timer updates, state propagation to all clients
3. **Server Actions** — Bid validation, timer control, captain assignment, log operations, CSV import/export, manual sales
4. **PostgreSQL + Edge Functions** — Database persistence, RLS enforcement, constraints, triggers, RPCs for complex validation

### Critical Pitfalls

Seven critical pitfalls identified that could break auction integrity or cause disputes. Most significant are race conditions on simultaneous bids (multiple teams think they won), timer desynchronization during pause/resume (clients show different remaining times), and incorrect max bid calculation allowing overspending. Each pitfall has clear prevention strategies and warning signs.

1. **Race condition on simultaneous bids** — Implement server-side `SELECT FOR UPDATE` locking with optimistic concurrency token (current_bid check)
2. **Timer desynchronization during pause/resume** — Store timer expiry timestamp in database, not just duration; sync clients to server timestamp
3. **Incorrect max bid calculation** — Implement database-level validation before bid acceptance; use materialized view for roster counts
4. **Reverse sale doesn't restore purse correctly** — Create immutable auction_log table; restore from original sale record, not current state
5. **Sold player reappears in auction** — Add database constraint preventing UPDATE if player is sold; always filter `is_sold = false`
6. **CSV import corrupts data** — Validate all rows before insertion with Zod schema; show preview with errors
7. **Bid cooldown bypass via rapid clicks** — Enforce server-side throttling with `last_bid_time` per team; client-side UI is insufficient

## Implications for Roadmap

Based on research dependencies and architectural patterns, suggested phase structure prioritizes foundation (data integrity) before real-time features, validation logic before user flows, and comprehensive logging before reverse functionality.

### Phase 1: Foundation & Data Integrity
**Rationale:** Database schema, constraints, and validation logic must be established before real-time synchronization can work correctly. Without proper foundation, all advanced features build on shaky ground.
**Delivers:** Complete database schema with all new tables (auction_log, enhanced auction_state), indexes, constraints, and RPC functions for captain assignment, max bid calculation, and bid validation.
**Addresses:** Player categorization, team composition rules, category-wise purse deduction, automatic bid validation, sold player state management
**Avoids:** Pitfall #5 (sold player reappears), Pitfall #3 (incorrect max bid calculation)

### Phase 2: Timer & State Management
**Rationale:** Timer synchronization is the foundation of auction fairness. Must be implemented with server-side authority before adding real-time bidding.
**Delivers:** Timer management system with server-side timer_expiry, pause/resume RPCs, countdown display, timer expiry handling, and admin controls for timer state.
**Uses:** react-timer-hook for client-side display, PostgreSQL TIMESTAMPTZ for server-side authority
**Implements:** Client-side timer with server sync pattern from ARCHITECTURE.md
**Avoids:** Pitfall #2 (timer desynchronization)

### Phase 3: Live Auction Core (Bid Synchronization)
**Rationale:** Real-time bid broadcasting is the heart of the auction system. Requires all validation logic (Phase 1) and timer state (Phase 2) to be in place.
**Delivers:** Supabase Realtime subscriptions for bids, bid placement with server-side validation, cooldown enforcement, optimistic updates, admin display of top 3 bids, captain bidding interface with alerts.
**Uses:** TanStack Query with optimistic updates, Postgres Changes with filters
**Implements:** Single source of truth pattern, bid placement flow
**Avoids:** Pitfall #1 (race conditions), Pitfall #7 (bid cooldown bypass)

### Phase 4: Auction Logging & Data Integrity
**Rationale:** Comprehensive logging enables reverse functionality, dispute resolution, and audit trails. Should be implemented after core bidding works but before admin workflows that depend on it.
**Delivers:** Immutable auction_log table, reverse sale RPC function, log entries UI, CSV export (Excel), manual sale modes (strict/override), bulk player CSV import with validation.
**Uses:** Zod for CSV validation, SheetJS for Excel export, PapaParse for CSV import
**Implements:** Log entry flow, reverse sale flow, CSV parsing pattern
**Avoids:** Pitfall #4 (reverse sale doesn't restore purse), Pitfall #6 (CSV import corrupts data)

### Phase 5: Admin Workflows & Polish
**Rationale:** All core functionality (Phase 1-4) is complete. Final phase focuses on admin orchestration, captain assignment workflow, search functionality, and UX improvements.
**Delivers:** Captain assignment UI, player deployment with search, manual purse deduction, ban specific teams, clear captain display screen between players, enhanced visualizations, bulk player management.
**Implements:** Captain assignment flow, admin orchestration patterns

### Phase Ordering Rationale

- **Foundation first:** Database schema, constraints, and RPC functions (Phase 1) are prerequisites for all other phases. Without these, validation logic would need to be rewritten.
- **State before sync:** Timer management (Phase 2) establishes server-side authority before adding real-time bid synchronization (Phase 3). This prevents timer desynchronization issues.
- **Validation before flows:** Comprehensive validation (Phase 1) ensures that when bid synchronization (Phase 3) is added, all race conditions are handled correctly.
- **Logging before reverse:** Auction logging (Phase 4) must exist before reverse functionality can work. Attempting to implement reverse without comprehensive logs creates data corruption risks.
- **Core before polish:** All critical auction functionality (Phases 1-3) is complete before adding admin workflows and polish (Phase 5). This ensures the auction engine works before adding convenience features.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Timer & State Management):** Timer synchronization edge cases (pause during countdown resume, clock drift across time zones, network latency during timer expiry). Research should verify exact PostgreSQL timestamp handling and client-server sync strategy.
- **Phase 3 (Live Auction Core):** Supabase Realtime performance characteristics under load (what happens when 100 clients subscribe to bids table, how to optimize RLS policies for high-frequency updates). Research should include load testing guidelines.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation & Data Integrity):** Well-documented PostgreSQL patterns (constraints, indexes, RPC functions). ARCHITECTURE.md provides complete SQL for all needed functions.
- **Phase 4 (Auction Logging & Data Integrity):** Standard CRUD operations with immutable audit trail pattern. CSV parsing with Zod validation is established practice.
- **Phase 5 (Admin Workflows & Polish):** Standard React form patterns and UI components. No novel technical challenges identified.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified with official docs (GitHub, Supabase, Zod). Libraries have recent releases and active maintenance. |
| Features | HIGH | Feature analysis based on IPL auction page (public, verified) and PROJECT.md requirements. Table stakes and differentiators are well-defined. |
| Architecture | HIGH | Patterns supported by Supabase Realtime documentation, Next.js Server Actions docs, and PostgreSQL best practices. Complete SQL and TypeScript examples provided. |
| Pitfalls | MEDIUM | 7 critical pitfalls identified with prevention strategies, but some (race conditions, timer drift) are based on expert inference and general auction system patterns, not specific case studies. |

**Overall confidence:** HIGH

### Gaps to Address

- **Timer sync edge cases:** Research provides pattern but doesn't cover all edge cases (e.g., pause exactly at 0.1 seconds, resume after hours-long pause, clock drift across different devices). Validate during Phase 2 implementation with comprehensive testing.
- **Performance under load:** Research notes Supabase Realtime is single-threaded and may have bottlenecks at 1,000+ users. Current project scale (small auction) should be fine, but consider load testing if scaling is planned.
- **Postgres Changes RLS behavior:** Research indicates RLS doesn't apply to realtime subscriptions. Verify exact channel-level authorization needed during Phase 3 implementation.

## Sources

### Primary (HIGH confidence)
- **Supabase Realtime Documentation** — Postgres Changes architecture, filters, performance notes, RLS limitations
- **Supabase Postgres Changes** — Subscribe to INSERT/UPDATE events, replica identity requirements
- **react-timer-hook GitHub** — Latest release v4.0.4 (Mar 18, 2025), pause/resume/restart API, React 19 compatibility
- **Zod Official Docs** — Zod 4 stable release, TypeScript-first validation, refine/superRefine for custom rules
- **SheetJS GitHub** — Apache 2.0 license, 315k dependents, json_to_sheet and writeFile API
- **PapaParse Official Docs** — Streaming, worker threads, chunking, error handling
- **IPLT20.com Auction Page** — Live auction interface showing real-time bidding, purse tracking, roster limits, capped/uncapped categorization, sold/unsold tabs
- **PostgreSQL Date/Time Functions** — TIMESTAMPTZ, EXTRACT(EPOCH FROM), interval calculations

### Secondary (MEDIUM confidence)
- **TanStack Query Documentation** — Optimistic updates, query invalidation patterns
- **Next.js Server Actions** — Mutations with Zod validation, revalidatePath
- **PROJECT.md** — Current project requirements and validated features

### Tertiary (LOW confidence)
- **General auction management patterns** — Training data on online auction systems (may be outdated, specific to e-commerce not sports auctions)
- **Domain knowledge: Race conditions in auction systems** — Expert inference based on current codebase and common real-time system patterns (no external source)
- **Domain knowledge: Timer synchronization challenges** — Expert inference based on client-server time sync best practices (no external source)

---
*Research completed: 2026-03-06*
*Ready for roadmap: yes*
