# Lunettiq — Search Specification

**Implementation:** Neon Postgres + pg_trgm (free, already deployed)
**Endpoint:** `GET /api/storefront/search?q={query}&limit=8`
**Personalization:** Logged-in members get weighted results via existing `scoreForYou` logic

---

## 1. Scope — What's Searchable

### 1.1 Products (primary)
- Product title, handle, SKU
- Description text
- Tags (shape, colour, material, size, type, collection)
- Metafields (material detail, origin, acetate source)
- Variant options (colour names)

### 1.2 Collections (secondary)
- Collection title
- Collection description

### 1.3 Journal articles (tertiary, V2+)
- Article title, author, pillar, body content (lightly weighted)

---

## 2. Architecture

### API Route

```
GET /api/storefront/search?q={query}&limit=8&customerId={optional}
```

**Query pipeline:**
1. Normalize query (trim, lowercase, strip diacritics, collapse plurals)
2. Run pg_trgm similarity search across `products_projection` (title, vendor, tags via unnest)
3. Run ILIKE fallback for exact substring matches
4. Score results: textual relevance × business factors × personalization
5. Return top N products + matching collections
6. Async: log query to `search_queries` table via Inngest event

**Response shape:**
```json
{
  "products": [{ "id", "handle", "title", "imageUrl", "price", "vendor", "colourCount", "tags" }],
  "collections": [{ "handle", "title", "imageUrl" }],
  "suggestions": [{ "text", "type" }],
  "meta": { "total", "query", "personalized" }
}
```

---

## 3. Search Overlay — Interaction Design

### 3.1 Trigger
- Nav: "Search" label opens full-screen overlay (desktop) or bottom sheet (mobile)
- Keyboard shortcut: `/` or `⌘K` on desktop

### 3.2 Overlay layout (desktop)

```
┌────────────────────────────────────────────────────────┐
│ [Lunettiq logo]       [Search input]            [✕]    │
├────────────────────────────────────────────────────────┤
│                                                        │
│ [Suggestions area — dynamic based on query state]      │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- Full-width overlay, top-aligned
- Background: brand off-white `#F5F2EC`
- Search input: centred, large (32px type), placeholder "Search frames, colours, shapes"
- Close: `esc` key or × button top-right
- Prevent body scroll while open

### 3.3 Empty state (focus without query)

Three sections before the user types:

**Popular searches** (4-5 pills)
- "Round frames", "Tortoise", "Signature collection", "Small size", "New arrivals"
- V1 hardcoded, V2 CMS-driven

**Recent searches** (per-user, localStorage or logged-in)
- Last 5 searches
- "Clear history" option

**Quick categories** (4 tiles with thumbnails)
- Optical, Sun, Collaborations, Archives

### 3.4 Typeahead state (query in progress)

After 2 characters typed, results appear. Three sections vertically:

**Products section** (primary)
- 6 product cards, 2 columns
- Each card: image, name, price, colour count
- Hover: slight scale
- "See all [N] products →" link at bottom

**Collections section**
- 3 collection chips: thumbnail + name
- Only shown if collections match

**Suggestions section**
- Text-only: "round · shape", "tortoise · colour", "acetate · material"
- Clicking applies a filter instead of text search
- Only shown if query matches known facets

### 3.5 Full results state (Enter or "See all")

Route: `/search?q=[query]`

- Query echo at top: "Showing results for 'tortoise acetate'"
- Applied filters as removable pills
- "Refine" button → filter drawer (shape, colour, material, size)
- Sort: relevance default
- 3-column grid matching PLP layout
- Empty state if zero results (see §6)

### 3.6 Close behaviour
- `esc` → close, return to previous scroll position
- Click outside → close
- Click a result → navigate to PDP, overlay closes
- "See all" → navigate to `/search?q=...`, overlay closes

### 3.7 Anti-patterns to avoid
- No promoted/sponsored results
- No "People also searched for" in typeahead
- No aggressive autocomplete — suggest, don't assume
- No result count badge on search button
- No category filters in typeahead (belongs on results page)
- No recent searches persisting across shared devices

---

## 4. Query Handling

### 4.1 Query normalization
Before hitting the DB:
- Trim whitespace
- Lowercase (preserve original for display)
- Strip diacritics: "café" matches "cafe"
- Singular/plural collapse: "frames" → "frame"
- Remove stopwords: "the", "a", "for", "with"

### 4.2 Typo tolerance
pg_trgm handles this natively:
- "senna" → exact match
- "sena" → matches "Senna" (similarity threshold)
- "torttoise" → matches "tortoise"
- Threshold: `similarity >= 0.3` for inclusion, ranked by score

### 4.3 Synonyms
Maintained as a lookup table in the DB. Applied at query time by expanding the search.

**Category synonyms:**
- "sunglasses" ↔ "sun" ↔ "shades"
- "glasses" ↔ "eyeglasses" ↔ "spectacles" ↔ "frames"
- "prescription" ↔ "Rx" ↔ "optical"
- "blue light" ↔ "screen" ↔ "computer"

**Shape synonyms:**
- "cat-eye" ↔ "cats eye" ↔ "cateye"
- "round" ↔ "circle"
- "square" ↔ "rectangular"

**Colour synonyms:**
- "tortoise" ↔ "tortoiseshell" ↔ "havana"
- "clear" ↔ "transparent" ↔ "crystal"
- "black" ↔ "noir"

**Material synonyms:**
- "acetate" ↔ "plastic"
- "metal" ↔ "titanium" ↔ "stainless"

### 4.4 Facet detection
When a query matches a known facet (shape, colour, material), surface it as a clickable suggestion: "round · shape filter". Clicking applies the filter instead of running a text search.

### 4.5 Multi-term queries
"round tortoise acetate" → AND logic. Match products with all three attributes.

Fallback: if strict AND returns zero results, fall back to OR with a note: "No exact matches for 'round tortoise acetate'. Showing frames matching any of these."

---

## 5. Ranking and Relevance

### 5.1 Scoring formula

```
final_score = textual_relevance + business_boost + personalization_boost
```

**Textual relevance** (from pg_trgm):
- Exact match on title: highest
- Prefix match on title: high
- Match in tags: medium
- Match in vendor: medium
- Match in description: low
- Fewer typos → higher similarity score

**Business boost factors:**
- `inventory > 0` → +5 (don't bury in-stock behind out-of-stock)
- Tag `new` (within 2 weeks) → +2
- Tag `collection:signature` → +2
- Purchase count (last 90 days) → +1 per 5 sales (capped at +4)

**Demotion factors:**
- Out of stock → -5 (not hidden)
- Archive collection → -3 (unless "archives" in query)
- Already purchased by this member → -10

### 5.2 Editorial override (V2)
A search term can be associated with curated products:
- "new collab" → manually set 4 frames from latest collaboration
- "gift" → curated gift guide selection
- Managed via Shopify metaobject `search_overrides`

---

## 6. Empty States and Zero-Result Handling

### 6.1 Zero-result page

```
"No frames matching 'xyz'."

"You might try:"
[4 suggested alternatives — partial match or popular searches]

"Or browse by:"
[Optical · Sun · Collections]

"Still not finding it?"
[Book a styling consultation] [Contact us]
```

### 6.2 Fallback logic
1. Strip most specific term: "round tortoise lightweight" → "round tortoise"
2. Match on any facet in the query, surface those products
3. Show 4 most popular products in catalogue

### 6.3 "Did you mean" corrections
- Show when query is close to something with results
- Clickable — replaces query
- Based on edit distance + popularity
- Don't show when current query returns reasonable results

---

## 7. Personalization Layer

For logged-in members with 2+ orders (uses existing `MemberContext` from `/api/account/personalization`):

### 7.1 What personalizes
- Boost: products matching derived shapes, materials, colours
- Boost: products in member's price band
- Boost: products matching stated preferences
- Demote: products on avoid list
- Demote heavily: products already purchased
- Size-filter (soft): member's size appears first, others remain visible

### 7.2 What doesn't personalize
- The query itself (never change what the customer typed)
- The set of matching products (same catalogue, same matches)
- Category fallback on zero results (stays universal)
- Editorial overrides (manual curation wins)

### 7.3 Crossover handling
If member searches a category they've never bought from ("sunglasses" for optical-only member): boost their usual category slightly, but don't hide what they asked for.

### 7.4 Privacy
- Personalization signals stay server-side
- Never exposed in query params or URLs
- Shared URLs show generic version

### 7.5 Non-member behaviour
- Base ranking (no personalization)
- Popular searches in empty state
- No recent searches unless localStorage has history

---

## 8. Mobile-Specific Considerations

### 8.1 Entry point
Search icon in mobile nav → full-screen bottom sheet

### 8.2 Keyboard handling
- Auto-focus on open, keyboard appears
- `enter` submits to full results
- Results area resizes above keyboard

### 8.3 Result density
- Two columns for products (not three)
- Minimum 44pt tap targets
- Horizontal scroll for collection chips

### 8.4 Browser back handling
Overlay closes on back gesture, not navigation.

---

## 9. Analytics and Feedback Loop

### 9.1 Dual-write pattern
Every search:
1. Queries Postgres for results (non-blocking, <50ms)
2. Fires Inngest event → async write to `search_queries` table

The write never blocks the response. Failed writes log to console, not to the customer.

### 9.2 What gets stored per query
- Raw query text + normalized form
- Result count
- Whether personalization was applied
- Whether a synonym rule fired (and which)
- Zero-result flag
- Clicked product IDs and positions
- Time to first click
- Applied filters
- Customer ID (logged-in) or session ID (anonymous)
- Device type
- Timestamp

**Not stored:** IP addresses, full result lists, click-through from SERP.

---

## 10. Accessibility

- Overlay traps focus while open
- `esc` closes overlay
- Results navigable via arrow keys
- `aria-live` region announces result count on query change
- All images have alt text
- Minimum contrast ratios met on all text

---

## 11. Performance Budgets

| Metric | Target |
|---|---|
| Time to first result (typeahead) | < 150ms |
| Full results page load | < 300ms |
| Overlay open animation | < 200ms |
| Search index freshness | < 5 min (webhook sync) |
| Bundle size (search overlay) | < 15KB gzipped |

---

## 12. Data Model Additions

### 12.1 search_queries table

```sql
search_queries
  id                uuid
  query_raw         text
  query_normalized  text
  result_count      integer
  personalized      boolean
  synonym_fired     text (nullable)
  zero_results      boolean
  clicked_products  jsonb (array of {productId, position})
  time_to_click_ms  integer (nullable)
  filters_applied   jsonb (nullable)
  customer_id       text (nullable)
  session_id        text
  device_type       text (desktop | mobile | tablet)
  created_at        timestamp
```

### 12.2 search_synonyms table

```sql
search_synonyms
  id          uuid
  terms       text[] (array of equivalent terms)
  active      boolean
  created_by  text
  created_at  timestamp
```

---

## 13. Implementation Scope

### V1 (launch)
- Search API endpoint with pg_trgm
- Search overlay component (desktop + mobile)
- Typeahead with product images
- Popular searches (hardcoded)
- Recent searches (localStorage)
- Full results page at `/search?q=`
- Query logging (async)
- Zero-result fallback

### V2 (post-launch)
- Personalization weighting for logged-in members
- Synonym expansion
- Facet detection suggestions
- Editorial overrides
- "Did you mean" corrections
- CRM search analytics dashboard
- Journal article results

---

## 14. CRM Dashboard — `/crm/reports/search`

New report module. Permission: `org:reports:read`.

### 14.1 Top queries panel

- Toggle: last 30 days / last 7 days / last 24 hours
- Columns: query text, count, CTR, avg. position clicked, zero-result rate
- Sortable by any column
- Click a query → drill-down showing all sessions for that query

### 14.2 Zero-result queries panel

- Queries that returned 0 results, last 30 days
- Count per query
- First seen date / last seen date
- Action buttons per row: **Add synonym** · **Flag as catalogue gap** · **Dismiss as noise**
- Flagged gaps generate a task for Benjamin / merchandising lead

### 14.3 Low-CTR queries panel

- Queries with volume >10 in last 30 days and CTR <30%
- Ranked by `volume × (1 - CTR)` to prioritize impact
- Suggests ranking review or editorial override as the likely fix

### 14.4 Query abandonment panel

- Queries where the customer typed, saw results, and left without clicking
- Different from zero-result — results existed but weren't compelling
- Grouped by query to identify systematic issues

### 14.5 Trend view

- Query volume over time
- New queries this week (never seen before)
- Rising queries (week-over-week growth >50%)
- Falling queries (week-over-week drop >50%)
- Used for editorial planning and collection merchandising

### 14.6 Individual customer drill-down

- On any client profile (CRM), a "Search history" panel shows that customer's recent searches
- Last 20 queries, each linking to whether they clicked, whether they purchased
- Context for sessions: "They searched for 'titanium' three times last month and never bought anything — why?"

---

## 15. Actions Triggered from the Dashboard

Each panel has direct actions, not just viewing.

### Add synonym from zero-result query
Opens the synonym editor pre-filled with the zero-result query as a variant. One-click: pick the canonical term from an autocomplete. Saves to `search_synonyms` table.

### Create editorial override from low-CTR query
Opens the overrides editor pre-filled with the query as the match term. SA picks 4 products to pin. Active date range defaults to next 30 days.

### Flag catalogue gap
Creates a task in the CRM task system (or Slack notification to Benjamin if tasks aren't built). Includes: query, volume, first-seen date.

### Export query set
CSV export of any filtered view for deeper external analysis.

---

## 16. Weekly Review Cadence

- **Monday morning:** Content lead (or Benjamin) reviews the CRM search dashboard
- **15 minutes max:** Zero-result queries → synonyms or catalogue flags; rising queries → editorial planning notes
- **Monthly:** Export top queries, review against merchandising calendar; look for missed opportunities

---

## 17. Merchandising Feedback Loop

When a search term shows significant volume but the catalogue has no good match, it's a signal worth acting on.

Example: customers search "titanium" but the catalogue has only acetate. That's either:
- A synonym problem (existing metal frames have titanium components but aren't tagged)
- A genuine product gap

The dashboard makes this cycle fast: see the signal on Monday, add the synonym or brief the product team same day, validate the fix in next week's data.
