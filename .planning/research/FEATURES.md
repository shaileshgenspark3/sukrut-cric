# Feature Research

**Domain:** Cricket Auction Systems
**Researched:** 2026-03-06
**Confidence:** MEDIUM

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Real-time bid broadcasting | Auctions are live events; all participants must see bids instantly | HIGH | Requires WebSocket/Realtime infrastructure; Supabase subscriptions in this stack |
| Purse/balance tracking | Teams cannot bid beyond budget; displays what they can spend | MEDIUM | Deduct as bids placed; show remaining funds (IPL displays: "Funds Remaining ₹2,40,00,000") |
| Player roster display | Show who team has purchased; enforce squad size limits | MEDIUM | IPL shows "Total Players: 25" per team; enforce max limit (9 players in this project) |
| Player categorization (capped/uncapped or categories) | Different rules apply to different player types | LOW | IPL uses "Capped/Uncapped"; this project uses A+, A, B, C, F categories |
| Base price and winning bid tracking | Auction starting point and final sale amount | LOW | IPL displays both; critical for auction transparency |
| Sold/unsold player lists | Post-auction record of outcomes | LOW | IPL has "Sold Players" and "Unsold Players" tabs; export functionality |
| Admin controls (start, pause, stop auction) | Auction flow needs orchestration | MEDIUM | Admin drives auction phases; pause allows for adjustments or breaks |
| Bid history | Transparency of who bid what and when | LOW | IPL shows player purchase history; top bids prominent |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Category-wise purse deduction | Captains cost different amounts based on skill level; more realistic than flat fees | MEDIUM | A+=5,00,000, A=2,00,000, B/F=0; enforces roster planning strategy |
| Automatic bid validation with max bid alerts | Prevents overspending before it happens; saves admin intervention | HIGH | Calculates "Funds available - (Category base prices for remaining slots) + Current player base price" |
| Team composition enforcement | Ensures balanced rosters (e.g., 1 A+, 3 A, 4 B per team) | HIGH | Prevents all-star teams; promotes competitive balance |
| Configurable timers and cooldowns | Different auctions need different pacing; flexible to event needs | MEDIUM | 30s first bid, 15s after, 3s cooldown between bids |
| Strict vs Override modes for manual sales | Admin control vs rule enforcement; flexibility for special cases | MEDIUM | Manual sale button with mode selection; override bypasses validation |
| CSV export/reverse sales | Data safety and undo capability; critical for live events | LOW | Export logs; delete entry restores purse and player availability |
| Captain assignment workflow | Designate team leaders from player pool; cannot be auctioned | LOW | Auto-add to roster with sold_price=0; forbidden from auction |
| Search in live controller | Quick player deployment in fast-paced auctions | LOW | Search by name; reduces time between player changes |
| Manual purse deduction | Adjust for penalties or special expenses | LOW | Admin override for non-standard deductions |
| Ban specific teams from bidding | Admin override for edge cases | LOW | Temporary ban per player; resets after sold/unsold |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Video streaming integration | "Show live video of auction" | Bandwidth-heavy, complex to host, not core auction functionality | Separate video platform or embed third-party |
| Mobile native apps | "Everyone uses phones" | Doubles development cost, web app already mobile-responsive | Progressive Web App (PWA) |
| Multiple concurrent auctions | "Host multiple leagues at once" | Database complexity, admin confusion, user overload | Single auction per instance; separate deployments for parallel events |
| Automatic bid escalation (bot bidding) | "Let teams set max bids and auto-bid" | Removes human element, defeats real-time excitement, fairness concerns | Max bid alerts only; let humans decide |
| Anonymous bidding | "Hide who bid until sale" | Transparency is critical in cricket auctions; IPL shows team names | Full bid transparency with team identification |
| Real-time chat/annotation | "Let teams discuss during auction" | Distraction, potential collusion, administrative burden | Separate communication channels (Slack, WhatsApp) |

## Feature Dependencies

```
[Player Categorization]
    └──requires──> [Category-wise Purse Deduction]
                       └──requires──> [Purse/Balance Tracking]

[Team Composition Rules]
    └──requires──> [Player Categorization]
    └──enhances──> [Automatic Bid Validation]

[Automatic Bid Validation]
    └──requires──> [Purse/Balance Tracking]
    └──requires──> [Team Composition Rules]
    └──requires──> [Category-wise Purse Deduction]

[Real-time Bid Broadcasting]
    └──requires──> [Purse/Balance Tracking] (to update all clients)

[CSV Export/Reverse Sales]
    └──requires──> [Log Entries] (transaction history)

[Manual Sale Mode]
    └──requires──> [Automatic Bid Validation] (for Strict mode)
```

### Dependency Notes

- **[Player Categorization] requires [Category-wise Purse Deduction]:** Cannot deduct different amounts without categories defined first
- **[Team Composition Rules] requires [Player Categorization]:** Limits are category-specific (e.g., max 1 A+ player)
- **[Automatic Bid Validation] requires [Purse/Balance Tracking], [Team Composition Rules], [Category-wise Purse Deduction]:** Complex calculation needs all three data points
- **[CSV Export/Reverse Sales] requires [Log Entries]:** Export needs transaction history; reverse needs logs to identify transaction to undo
- **[Manual Sale Mode] requires [Automatic Bid Validation]:** Strict mode uses same validation logic; Override bypasses it

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept.

- [x] **Real-time bid broadcasting** — Core auction experience; Supabase subscriptions already in place
- [x] **Purse/balance tracking** — Essential for auction fairness; prevent overspending
- [x] **Player roster display** — Show purchased players; enforce max 9 players
- [x] **Player categorization (A+, A, B, C, F)** — Differentiates player tiers; needed for rules
- [x] **Base price and winning bid tracking** — Auction transparency
- [x] **Admin controls (start, pause, stop)** — Auction flow orchestration
- [x] **Bid history** — Post-auction record; audit trail
- [x] **Captain assignment workflow** — Designate team leaders; auto-add to roster
- [x] **Category-wise purse deduction** — Realistic captain pricing; strategic roster building
- [x] **Category-wise base prices** — A+=5,00,000, A=2,00,000, B=1,00,000, F=50,000
- [x] **Automatic bid validation with max bid alerts** — Prevent overspending; show red alerts
- [x] **Team composition enforcement** — Male: 1 A+, 3 A, 4 B; Female: 1 F; enforce balance
- [x] **Configurable timers** — 30s first bid, 15s after; display countdown
- [x] **Bidding cooldown (3s)** — Prevent spam bidding
- [x] **Pause/Resume auction** — Admin control for breaks or adjustments
- [x] **Sold/unsold player management** — Re-auction unsold; prevent sold from re-deploying
- [x] **Manual sale with Strict/Override modes** — Admin flexibility with safety checks
- [x] **Log Entries tab** — Record all sales/unsold events
- [x] **CSV export/reverse sales** — Data safety; undo capability
- [x] **Search in live controller** — Quick player deployment
- [x] **Manual purse deduction** — Admin override for adjustments
- [x] **Ban specific teams from bidding** — Admin override per player
- [x] **Detailed player info display** — Name, Height, Handy, Type, Earlier Seasons, Achievements, Age, Category

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] **Top 3 bids prominence** — Show team name, logo, captain image for leading bids
- [ ] **Bid history from 4th bid onwards** — Full transparency of all bids
- [ ] **Clear captain display screen between players** — Show purchase details when sold/unsold, blank until next
- [ ] **Enhanced visualizations** — Better purse management visualization charts
- [ ] **Bulk player CSV import** — Streamline player data entry

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] **Multiple concurrent auctions** — Parallel leagues with separate databases
- [ ] **Video streaming integration** — Third-party embed or P2P
- [ ] **Mobile native apps** — If web app proves insufficient
- [ ] **Post-auction analytics** — Player performance tracking, roster optimization suggestions
- [ ] **Team formation builder** — Visual roster arrangement tool

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Real-time bid broadcasting | HIGH | HIGH | P1 |
| Purse/balance tracking | HIGH | MEDIUM | P1 |
| Player roster display | HIGH | MEDIUM | P1 |
| Player categorization (A+, A, B, C, F) | HIGH | LOW | P1 |
| Base price and winning bid tracking | HIGH | LOW | P1 |
| Admin controls (start, pause, stop) | HIGH | MEDIUM | P1 |
| Bid history | HIGH | LOW | P1 |
| Captain assignment workflow | MEDIUM | LOW | P1 |
| Category-wise purse deduction | MEDIUM | MEDIUM | P1 |
| Category-wise base prices | MEDIUM | LOW | P1 |
| Automatic bid validation with max bid alerts | HIGH | HIGH | P1 |
| Team composition enforcement | HIGH | HIGH | P1 |
| Configurable timers | MEDIUM | MEDIUM | P1 |
| Bidding cooldown (3s) | MEDIUM | LOW | P1 |
| Pause/Resume auction | MEDIUM | MEDIUM | P1 |
| Sold/unsold player management | HIGH | MEDIUM | P1 |
| Manual sale with Strict/Override modes | MEDIUM | MEDIUM | P1 |
| Log Entries tab | HIGH | MEDIUM | P1 |
| CSV export/reverse sales | MEDIUM | LOW | P1 |
| Search in live controller | MEDIUM | LOW | P1 |
| Manual purse deduction | LOW | LOW | P2 |
| Ban specific teams from bidding | LOW | LOW | P2 |
| Detailed player info display | MEDIUM | LOW | P1 |
| Top 3 bids prominence | MEDIUM | MEDIUM | P2 |
| Bid history from 4th bid onwards | LOW | MEDIUM | P2 |
| Clear captain display screen between players | LOW | LOW | P2 |
| Enhanced visualizations | LOW | MEDIUM | P3 |
| Bulk player CSV import | LOW | MEDIUM | P2 |
| Multiple concurrent auctions | MEDIUM | HIGH | P3 |
| Video streaming integration | LOW | HIGH | P3 |
| Mobile native apps | MEDIUM | HIGH | P3 |
| Post-auction analytics | MEDIUM | HIGH | P3 |
| Team formation builder | LOW | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | IPL Auction | Generic Sports Auction Platforms | Our Approach |
|---------|--------------|----------------------------------|--------------|
| Real-time bid broadcasting | ✓ (Live event) | ✓ (Most platforms) | ✓ (Supabase Realtime) |
| Purse display | ✓ (Shows funds remaining) | ✓ (Balance tracking) | ✓ (₹30 lakhs base, category deductions) |
| Player roster limits | ✓ (Max 25 players, 8 overseas) | ✓ (Varies by league) | ✓ (Max 9 players: 1 captain + 8) |
| Player categorization | ✓ (Capped/Uncapped) | ✓ (Various tiers) | ✓ (A+, A, B, C, F categories) |
| Timer management | ✓ (30s/15s phases) | ✓ (Configurable) | ✓ (30s first bid, 15s after, 3s cooldown) |
| Bid validation | ✓ (Cannot exceed purse) | ✓ (Budget enforcement) | ✓ (Max bid calculation + category limits) |
| CSV export/reverse | ✗ (No public export) | ✓ (Data exports) | ✓ (CSV export + reverse sales) |
| Manual sale modes | ✓ (Admin override) | ✓ (Admin controls) | ✓ (Strict/Override modes) |
| Video streaming | ✓ (TV broadcast) | Some platforms | ✗ (Out of scope v1) |
| Mobile apps | ✓ (IPL app) | Many have apps | ✗ (Web-responsive first) |
| Team composition rules | ✓ (Overseas caps) | Some leagues | ✓ (Category limits: A+, A, B, F) |

## Sources

- IPLT20.com auction page (HIGH confidence) — https://www.iplt20.com/auction — Shows live auction interface with funds remaining, overseas player limits (8), total player limits (25), base prices, winning bids, capped/uncapped categorization, sold/unsold tabs
- PROJECT.md (HIGH confidence) — Current project requirements and validated features
- General auction management patterns (LOW confidence) — Training data on online auction systems (may be outdated)

---
*Feature research for: Cricket Auction Systems*
*Researched: 2026-03-06*
