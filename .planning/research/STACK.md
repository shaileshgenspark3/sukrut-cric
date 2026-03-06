# Stack Research

**Domain:** Real-time Cricket Auction Management System
**Researched:** 2025-03-06
**Confidence:** HIGH

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Next.js** | 16.1.6 (existing) | Core framework | Already in use, React 19.2.3 with SSR and App Router |
| **React** | 19.2.3 (existing) | UI library | Latest version with improved concurrent features |
| **Supabase** | 2.98.0 (existing) | Database & Real-time | Existing integration, Postgres Changes for bid sync |
| **TypeScript** | 5 (existing) | Type safety | Required for complex business rules and validation |

### Supporting Libraries (NEW Features Only)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **react-timer-hook** | 4.0.4 | Countdown timer with pause/resume/restart | For auction timers (30s first bid, 15s after), 3s bidding cooldown |
| **Zod** | 4 (stable) | TypeScript-first schema validation | For team composition rules, max bid calculations, manual sale validation |
| **SheetJS (xlsx)** | ^0.18.5 | Excel export for auction logs | For Download CSV/Excel in Log Entries tab |
| **PapaParse** | 5.5.3 (existing) | CSV import for bulk player upload | Already installed, supports streaming and worker threads for large files |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **TanStack Query** | Data fetching and caching | Already installed, use optimistic updates for bid synchronization |
| **Supabase Realtime** | Real-time bid/price updates | Postgres Changes with filters (INSERT/UPDATE on bids table) |

## Installation

```bash
# NEW libraries for enhanced features only
npm install react-timer-hook@^4.0.4 zod@^4.0.0 xlsx@^0.18.5

# Type definitions (if needed)
npm install -D @types/xlsx@^0.0.36
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| react-timer-hook | use-timer | When you need simpler timer without pause/resume (not our case) |
| react-timer-hook | react-countdown-circle | When you need visual circle animations (can add later) |
| Zod | Yup | When migrating from older codebase (Zod is more modern and TS-first) |
| SheetJS | exceljs | When you need advanced Excel features like formulas/styling (not required) |
| PapaParse (CSV export) | Papa.unparse | Already in package.json, use for CSV export if Excel not required |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **react-timer** | Deprecated, no updates since 2021 | react-timer-hook (actively maintained, latest Mar 2025) |
| **yup** | Less TypeScript integration, smaller ecosystem | Zod (TS-first, 2kb gzipped, better error handling) |
| **custom setInterval** | Hard to manage pause/resume, race conditions | react-timer-hook (tested, handles edge cases) |
| **Supabase Broadcast** | Broadcast is for client-to-client, not for bid state | Postgres Changes (database-driven, conflict-resistant) |
| **Manual date calculations** | Prone to bugs in countdown logic | react-timer-hook (provides days/hours/minutes/seconds/totalSeconds) |
| **Form libraries (React Hook Form)** | Overkill for validation-only needs | Zod (schema-only validation, no form bloat) |

## Stack Patterns by Variant

**If implementing countdown timer:**
- Use `useTimer` from react-timer-hook
- Set `expiryTimestamp` to target Date
- Enable `interval: 20` or `100` for smooth millisecond updates if needed
- Use `pause()` and `resume()` for pause/resume auction functionality
- Use `restart(newTime)` to reset timer for new player or re-auction
- **Because**: Handles edge cases, provides granular time values, tested by 621 stars

**If validating team composition:**
- Define Zod schema with `z.object()` and custom validators
- Use `z.refine()` for category limits (e.g., "Male: A+=1, A=3, B=4")
- Use `z.superRefine()` for max bid calculation with access to all fields
- **Because**: Type-safe validation, excellent error messages, TypeScript inference

**If exporting auction logs:**
- Use SheetJS `XLSX.utils.json_to_sheet()` for converting JSON to worksheet
- Use `XLSX.writeFile()` for downloading XLSX file
- Use PapaParse `Papa.unparse()` only if CSV format is specifically required
- **Because**: SheetJS is industry standard (315k dependents), supports Excel features

**If synchronizing bids in real-time:**
- Subscribe to `INSERT` and `UPDATE` events on bids table with Postgres Changes
- Use filters: `filter: 'player_id=eq.<current_player>'`
- Implement optimistic updates with TanStack Query
- **Because**: Postgres Changes guarantees database truth, filters reduce noise, RLS protects data

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| react-timer-hook@4.0.4 | React@19.2.3 | Tested, latest release Mar 18 2025 |
| Zod@4 | TypeScript@5 | Requires `strict: true` in tsconfig.json (already set) |
| xlsx@^0.18.5 | Node.js@20 | Works in browser and Node.js for server-side export |
| Papaparse@5.5.3 | React@19.2.3 | Streaming support for large files, worker thread capable |

## Detailed Rationale for Each Choice

### react-timer-hook
**Why needed**: Auction system requires configurable countdown timers (30s for first bid, 15s after), pause/resume during auction flow, 3-second bidding cooldown between bids.

**Why this library**:
- Latest version 4.0.4 released March 18, 2025 (HIGH confidence - official GitHub)
- Provides `useTimer` hook with `pause()`, `resume()`, `restart()` methods
- Returns granular values: `totalSeconds`, `seconds`, `minutes`, `hours`, `isRunning`
- Configurable `interval` parameter for millisecond precision
- React 19 compatible, 621 GitHub stars, actively maintained
- TypeScript support included

**Alternatives considered**:
- use-timer: Simpler but lacks restart functionality
- react-countdown-circle: Visual focus, less control over timer state
- Custom setInterval: Higher complexity, more edge cases, harder to test

### Zod
**Why needed**: Complex business rules requiring validation:
- Team composition: Male (A+=1, A=3, B=4), Female (F=1)
- Max bid calculation: `Funds available - (Category base prices for remaining slots) + Current category base price`
- Category limits per team
- Manual sale validation (category limits, purse, max bid)

**Why this library**:
- Zod 4 is now stable (HIGH confidence - official docs March 2025)
- TypeScript-first with automatic type inference
- Zero external dependencies, 2kb gzipped
- `z.refine()` and `z.superRefine()` for custom business rules
- Excellent error messages and localization support
- Works with React Hook Form if form UI is added later
- `z.transform()` for computed values like max bid calculation

**Alternatives considered**:
- Yup: Less TypeScript integration, verbose error handling
- Joi: Node.js focused, not TS-first
- io-ts: More complex API, steeper learning curve

### SheetJS (xlsx)
**Why needed**: Export auction logs to Excel format for backup and record-keeping.

**Why this library**:
- SheetJS Community Edition is Apache 2.0 licensed (HIGH confidence - official GitHub)
- Industry standard with 315k dependents and 36.2k GitHub stars
- Supports XLSX, XLS, and CSV export
- `XLSX.utils.json_to_sheet()` converts auction log JSON to worksheet
- `XLSX.writeFile()` downloads file client-side
- Works in browser (for client-side export) and Node.js (server-side export)
- Used by major companies (Autodesk, Courier, Liblab)

**Alternatives considered**:
- exceljs: More features (formulas, styling) but larger bundle
- PapaParse.unparse: Only CSV, no Excel support
- FileSaver.js: Only handles file saving, not Excel generation

### PapaParse (Existing)
**Status**: Already installed in package.json (version 5.5.3)

**Why it's suitable for bulk player import**:
- Supports streaming with `step` callback (process rows as parsed)
- Web Worker support via `worker: true` (keeps UI responsive)
- Chunked processing via `chunk` callback (handles large files without memory issues)
- Configurable: `delimiter`, `header`, `dynamicTyping`, `skipEmptyLines`
- Error handling: returns errors array with row numbers and error codes
- Remote file parsing via `download: true`
- Works in browser and Node.js

**Bulk operation suitability**:
- Default `LocalChunkSize: 10 MB` and `RemoteChunkSize: 5 MB` for large files
- Can pause parsing with `parser.pause()` and resume with `parser.resume()`
- Fast mode for CSVs without quotes

**When to use PapaParse vs SheetJS**:
- Use PapaParse for **importing** player CSVs (bulk upload)
- Use PapaParse `unparse()` for simple CSV export
- Use SheetJS for **Excel export** when users want .xlsx format

### Supabase Realtime (Existing Enhancement)
**Current state**: Postgres Changes already used for bid/price updates

**Enhancements needed for complex bid synchronization**:
- Use filters to reduce noise: `filter: 'player_id=eq.<current_player>'`
- Subscribe to both `INSERT` and `UPDATE` events on bids table
- Set `replica identity full` on bids table to receive both `old` and `new` values on UPDATE
- Implement optimistic updates with TanStack Query to prevent UI jank
- Use RLS policies to ensure captains only see current player's bids

**Why Postgres Changes over Broadcast**:
- Broadcast is for client-to-client messaging (e.g., typing indicators)
- Postgres Changes guarantees database truth (source of truth is database)
- Filters reduce bandwidth (only relevant changes sent)
- RLS protects data automatically

**Performance considerations**:
- Postgres Changes processes on single thread (from official docs)
- Use separate "public" table without RLS for high-throughput scenarios
- For 100 users, single insert triggers 100 reads (one per user)
- Current scale (small auction system) will not hit performance bottlenecks

## Confidence Assessment

| Library | Confidence | Source |
|---------|-----------|---------|
| react-timer-hook | HIGH | Official GitHub (latest release Mar 18, 2025) |
| Zod | HIGH | Official docs (Zod 4 stable release) |
| SheetJS | HIGH | Official GitHub (315k dependents, Apache 2.0) |
| PapaParse | HIGH | Official docs (installed version 5.5.3) |
| Supabase Realtime | HIGH | Official docs (Postgres Changes architecture) |

## Sources

- **react-timer-hook** — Official GitHub documentation (verified latest release v4.0.4, Mar 18 2025)
- **Zod** — Official docs (verified Zod 4 stable release)
- **SheetJS** — Official GitHub and docs (verified Apache 2.0 license, 315k dependents)
- **PapaParse** — Official docs (verified streaming, worker thread, chunking capabilities)
- **Supabase Realtime** — Official docs (verified Postgres Changes filters, performance notes)

---
*Stack research for: Real-time Cricket Auction Management System Enhancement*
*Researched: 2025-03-06*
