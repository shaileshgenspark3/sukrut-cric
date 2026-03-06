# Sukrut Premier League Auction System

## What This Is

A real-time cricket tournament auction management platform for organizing and executing player auctions with complex bidding rules, team composition restrictions, and purse management. Admins manage players, teams, and live auction flow, while captains bid in real-time with category-based pricing and roster limitations.

## Core Value

Transparent, fair, and rule-compliant cricket auction where every bid respects team purse limits, category restrictions, and ensures all teams can complete a balanced roster.

## Requirements

### Validated

✓ Tournament settings configuration — existing
✓ Player catalog with categories (A+, A, B, C, F) — existing
✓ Team and captain management — existing
✓ Live auction bidding with real-time updates — existing
✓ Role-based access (Admin/Captain) — existing
✓ Auction rules and purse management — existing
✓ Player roster tracking — existing
✓ Real-time Supabase subscriptions — existing
✓ Landing page with auction status — existing
✓ Admin dashboard with Overview, Players, Rules, Live Controller tabs — existing
✓ Captain dashboard with purse visualization and bidding interface — existing

### Active

- [ ] Fix Edit/Delete buttons in Admin Overview and Players tabs (buttons present but not functional)
- [ ] Add CSV upload functionality for bulk player import (supporting all player fields)
- [ ] Add "Erase All Players" button with confirmation in Players tab
- [ ] Enforce max 9 players per team limit during player addition
- [ ] Add search functionality in Live Controller for selecting players to deploy (search by name)
- [ ] Fix purse amount update bug (change from 30,000 to 30,00,000, "apply global" not working)
- [ ] Create Captain Selection tab to assign captains from player list to teams
- [ ] Implement captain category-wise purse deduction logic (A+=5,00,000, A=2,00,000, B/F=0)
- [ ] Mark selected captains as forbidden from auction (cannot be deployed, cannot be bid on)
- [ ] Auto-add captains to their team's roster with sold_price=0
- [ ] Allow admin to manually deduct purse in Auction Rules tab
- [ ] Configure category-wise base prices (A+=5,00,000, A=2,00,000, B=1,00,000, F=50,000)
- [ ] Display detailed player info to captains (Name, Height, Handy, Type, Earlier Seasons, Achievements, Age, Category prominently)
- [ ] Implement 3-second bidding cooldown after each bid
- [ ] Configure bid increment to 25,000 per bid
- [ ] Add configurable timers: 30 seconds for first bid, 15 seconds after first bid
- [ ] Show countdown timer in Admin Live Controller and Captain Dashboard
- [ ] Handle timer expiry with no bids: ask admin to confirm "keep unsold" or "re-auction"
- [ ] Handle timer expiry with bids: ask admin to confirm or modify sale before finalizing
- [ ] Add Pause/Resume auction functionality (halts bidding, freezes timers)
- [ ] Make timer settings configurable by admin during live auction
- [ ] Display top 3 bids prominently with team name, logo, captain image
- [ ] Display bid history from 4th bid onwards (team name and amount)
- [ ] Clear captain display screen between players (show purchase details when sold/unsold, blank until next player)
- [ ] Create Log Entries tab in Admin (record of every sold/unsold player)
- [ ] Add Download CSV/Excel button in Log Entries tab
- [ ] Add Delete Entry functionality in Log Entries (reverses sale, restores purse, makes player available again)
- [ ] Enforce team composition restrictions (Male: A+=1, A=3, B=4; Female: F=1)
- [ ] Calculate max bid per player: `Funds available - (Category base prices for remaining roster slots) + Current player category base price`, use max of actual purchase price or base price
- [ ] Show red alert to captain when bid exceeds max bid or category limit: "You can max bid this much only" or "You are not eligible to bid in this player as you have X number of X category player"
- [ ] Mark ineligible teams in Admin Live Controller as RED
- [ ] Allow admin to manually ban specific teams from bidding on current player (temporary, resets after player sold/unsold)
- [ ] Add Manual Sale button in Admin (select player, team, amount, mode selection)
- [ ] Implement Strict mode (enforces all rules) and Override mode (bypasses limits) for manual sales
- [ ] Prevent sold players from being deployed to auction again
- [ ] Allow re-auctioning of unsold players
- [ ] Prevent captains from being selected for auction
- [ ] Validate manual sales: category limits, purse calculations, max bid validation

### Out of Scope

- Mobile native applications (web-first)
- Video streaming capabilities
- Multiple concurrent auctions (single auction at a time)
- Player performance statistics post-auction
- Team formation builder (post-auction roster arrangement)

## Context

This is an enhancement to an existing Next.js + Supabase cricket auction system. Current system has basic auction flow but lacks complex rule enforcement, detailed player information display, bid validation, and comprehensive auction logging. Admins are requesting these enhancements to support real-world auction scenarios with fairness enforcement and data safety (CSV exports for backup, reverse sales capability).

## Constraints

- **Tech Stack**: Next.js 16.1.6, React 19.2.3, Supabase (PostgreSQL), Tailwind CSS 4, Framer Motion 12.35.0, TanStack Query 5.90.21
- **Real-time**: Must leverage Supabase Realtime for bid/price updates across all clients
- **Purse**: Base purse changed from 30,000 to 30,00,000 (₹30 lakhs)
- **Category Limits**: Teams restricted to 1 captain + 8 players total (Male max 7, Female max 2)
- **Role System**: Core Admin only (simplify from current core_admin/regular admin split)
- **Database**: Must maintain existing schema compatibility (additions only, no breaking changes)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use max of actual price or base price for calculations | Safer to prevent overspending based on real spending | — Pending |
| Both auto-alert + manual ban for team restrictions | System prevents most violations, admin has override for edge cases | — Pending |
| Auto-add captains to roster | Captains are part of team, should be visible | — Pending |
| CSV upload all player fields | Flexibility for data entry, matches database schema | — Pending |
| Strict vs Override mode for manual sales | Admin has control while maintaining safety checks | — Pending |
| Single admin type | Simplify permission model, reduce complexity | — Pending |

---
*Last updated: 2026-03-06 after project initialization*
