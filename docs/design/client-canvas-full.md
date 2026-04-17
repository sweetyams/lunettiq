# Client Canvas — Full Design Doc

**Status:** DRAFT
**Route:** `/crm/clients/[id]` (replaces current profile)
**Source:** lunettiq_client_canvas_bw_marie_dubois.html

---

## Architecture

Server component fetches all data, passes to a single `ClientCanvas` client component. New CSS file `canvas.css` for the B/W design system.

**File:** `src/app/crm/clients/[id]/page.tsx` — server component (rebuild)
**File:** `src/app/crm/clients/[id]/ClientCanvas.tsx` — main client component (new)
**File:** `src/app/crm/clients/[id]/canvas.css` — canvas-specific styles (new)

---

## Server Data Loading

The server component fetches everything in parallel and passes as props:

```ts
const [client, orders, interactions, prefs, feedback, sessions, links, creditBalance] = await Promise.all([
  // customer from customersProjection
  // orders from ordersProjection (last 50)
  // interactions from interactions table (last 100)
  // preferences from preferencesDerived
  // feedback from productFeedback for this customer
  // sessions from tryOnSessions (last 10)
  // links from clientLinks + customer names
  // credit balance SUM from creditsLedger
]);
```

Compute derived stats server-side:
- `returnRate` — returned items / total items
- `daysIdle` — days since last order
- `avgSpend` — total_spent / order_count
- `cadence` — avg days between orders

---

## Component Breakdown (11 blocks)

### 1. TopBar
Breadcrumb + Cmd+K trigger + Share button. Static, no new data.

### 2. HeroBar
**Data:** client name, pronouns, tier (from tags), member since (createdAt), home location, LTV, credits, return rate, days idle
**Interactions:** Name click → inline edit. Stats are read-only.

### 3. ModeTabs
Tabs: Overview, Story, Fitting room, Commercial, Clinical, + custom
**V1:** Only Overview is functional. Others show "Coming soon". Tab state stored in component.

### 4. AIStyler
**Data:** None initially — fetched on demand
**API:** POST `/api/crm/clients/[id]/ai-styler` (new)
- Sends: client summary (name, tier, preferences, recent orders, recent interactions, feedback)
- Claude returns: insight text with product mentions, suggested quick actions
- Uses `claude-haiku-4-5-20251001` for speed
- Logs to `ai_requests`
**UI:** Thought bubble with clickable product mentions, action chips, ask input
**V1 simplification:** Pre-generate on page load. Chips are static suggestions.

### 5. FrameDeck
**Data:** `productFeedback` + `productInteractions` + `ordersProjection` (for owned frames)
Build a merged list:
- Owned: from orders line items
- Loved/liked: from productFeedback where sentiment = love/like
- Tried: from productInteractions where type = tried_on
- Returned: from orders with returned line items
- Disliked: from productFeedback where sentiment = dislike

Each card: product image, name, colour variant, price/owned status, sentiment icon, try count/date.
Horizontal scroll container. Last card = "+ AI picks for next visit" (calls suggestions API).

**Data source mapping:**
```
Product image → productsProjection.images
Sentiment → productFeedback.sentiment
Try count → COUNT productInteractions WHERE type=tried_on GROUP BY productId
Owned → ordersProjection.lineItems WHERE productId matches
```

### 6. Timeline (compose + filter + entries)
**Data:** Fetched client-side from `/api/crm/clients/[id]/timeline` (already built)
**Compose bar:** Inline input at top. On enter: POST to `/api/crm/interactions` with type=note. Refreshes timeline.
**Filter tabs:** Everything, Conversations, Commerce, System — maps to timeline filter param:
- Conversations → note,call,visit
- Commerce → order,credit
- System → appointment
**Entries:** Same as current ActivityTimeline but with the canvas styling.

### 7. Vitals Grid (right sidebar)
**Data:** Computed server-side, passed as props
- Cadence (avg days between orders)
- Avg spend (total_spent / order_count)
- Open rate (placeholder — needs Klaviyo integration, show "—" for V1)
- Pairs owned (count distinct products from orders)

### 8. ContactBlock
**Data:** client email, phone, address (defaultAddress), birthday, language (metafield)
**Interactions:** Consent flags (on/off) — click opens ConsentToggle confirmation modal
Same data as current identity column, different layout.

### 9. RelationshipGraph
**Data:** `clientLinks` (already fetched) + staff interactions
**V1:** Simple list view (not SVG graph). Show linked clients with relationship type + link to their profile.
**V2:** SVG graph visualization.

### 10. FitMeasurements
**Data:** client metafields (frame_width_mm, bridge_width_mm, temple_length_mm, face_shape, rx_on_file)
Read-only display in 2×2 grid. Rx note below.

### 11. LearnedSignals
**Data:** Derived from interactions + feedback patterns
**V1:** Static section showing preferences from `preferencesDerived` as signal bars.
**V2:** AI-generated behavioral patterns.

---

## New API

### POST `/api/crm/clients/[id]/ai-styler`
**Auth:** `org:recs:read`
**Body:** `{ context?: string }` (optional user question)
**Logic:**
1. Build client summary: name, tier, preferences, last 5 orders, last 5 interactions, top feedback
2. Send to Claude Haiku with stylist persona prompt
3. Return `{ thought: string, chips: string[] }`
4. Log to ai_requests

---

## New CSS

`canvas.css` — B/W design tokens matching the HTML mockup:
- `--lq-ink: #0A0A0A`
- `--lq-paper: #FFFFFF`
- `--lq-line: rgba(10,10,10,0.12)`
- `--lq-mute: rgba(10,10,10,0.55)`
- `--lq-shade: #F4F4F2`

All canvas components use these vars. Coexists with existing CRM vars.

---

## Files Summary

| File | Action | Component |
|---|---|---|
| `clients/[id]/page.tsx` | Rebuild | Server data loader |
| `clients/[id]/ClientCanvas.tsx` | New | Main canvas layout |
| `clients/[id]/canvas.css` | New | B/W design tokens + styles |
| `components/crm/canvas/HeroBar.tsx` | New | #2 |
| `components/crm/canvas/ModeTabs.tsx` | New | #3 |
| `components/crm/canvas/AIStyler.tsx` | New | #4 |
| `components/crm/canvas/FrameDeck.tsx` | New | #5 |
| `components/crm/canvas/CanvasTimeline.tsx` | New | #6 |
| `components/crm/canvas/VitalsGrid.tsx` | New | #7 |
| `components/crm/canvas/ContactBlock.tsx` | New | #8 |
| `components/crm/canvas/RelationshipGraph.tsx` | New | #9 |
| `components/crm/canvas/FitMeasurements.tsx` | New | #10 |
| `components/crm/canvas/LearnedSignals.tsx` | New | #11 |
| `api/crm/clients/[id]/ai-styler/route.ts` | New | AI endpoint |

14 files total (13 new, 1 rebuild). No new DB tables — uses all existing data.

---

## Build Order

1. CSS + layout shell (ClientCanvas with grid)
2. HeroBar + ModeTabs (static, fast)
3. ContactBlock + FitMeasurements + VitalsGrid (right sidebar, data display)
4. CanvasTimeline with compose bar (replaces ActivityTimeline)
5. FrameDeck (horizontal scroll, needs feedback data)
6. RelationshipGraph + LearnedSignals (V1 simple versions)
7. AIStyler + API endpoint (last, depends on all other data)
