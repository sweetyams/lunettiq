# Lunettiq — Site Search Specification

**Status:** Draft for review
**Last updated:** April 2026
**Cross-references:** `lunettiq-functionality-spec.md` §3.2 (nav), §5 (PLP), §12 decision 5 (search scope) · `lunettiq-crm-spec.md` §7 (preferences), §8 (product catalogue) · `lunettiq-personalization-strategy.md` §2.5 (search weighting) · `05-product-recs.md` (suggestions algorithm)

---

## Framing

Search on eyewear sites is usually terrible. Most brands treat it as a last resort — a text box people fall back to when navigation fails. At Lunettiq's register, that framing is wrong. Search is how a customer with a specific intent ("round tortoise acetate", "small frames", "Draper") bypasses the editorial browsing and gets to the answer. It deserves first-class treatment.

The simplicity benchmark here is not the big DTC players. Warby Parker's search is mediocre. Zenni's search is fast but clinical. The best eyewear search experience on the web right now is Oliver Peoples — overlay opens fast, shows frames with images, offers category shortcuts, respects the editorial tone of the rest of the site. That's the target.

**Design principles:**
- Search respects the brand register. No clinical "results matched" copy. No aggressive upsell.
- Products first, everything else second. Customers search for frames, not for content.
- Show images. Text-only search results on an eyewear site are a failure of imagination.
- Typo tolerance is table stakes. "Sennna", "akay-eye", "torttoise" should all work.
- Logged-in members get subtle personalization. Not separate results, just weighted ones.
- Fast. Perceived latency matters more than raw query time.

---

## Contents

1. [Scope — what's searchable](#1-scope--whats-searchable)
2. [Architecture by phase](#2-architecture-by-phase)
3. [Search overlay — interaction design](#3-search-overlay--interaction-design)
4. [Query handling](#4-query-handling)
5. [Ranking and relevance](#5-ranking-and-relevance)
6. [Empty states and zero-result handling](#6-empty-states-and-zero-result-handling)
7. [Personalization layer](#7-personalization-layer)
8. [Mobile-specific considerations](#8-mobile-specific-considerations)
9. [Analytics and feedback loop](#9-analytics-and-feedback-loop)
10. [Accessibility](#10-accessibility)
11. [Performance budgets](#11-performance-budgets)
12. [Data model additions](#12-data-model-additions)
13. [V1 scope vs V2 roadmap](#13-v1-scope-vs-v2-roadmap)
14. [Open decisions](#14-open-decisions)

---

## 1. Scope — what's searchable

Three tiers of content, searched together, weighted differently.

### 1.1 Products (primary)

Everything a customer might type a product name or attribute for:
- Product title (e.g., "Draper", "Senna")
- Product handle and SKU
- Description text
- Tags (shape, colour, material, size, type, collection)
- Metafields (material detail, origin)
- Variant options (colour names, lens types)

### 1.2 Collections (secondary)

For queries like "signature", "archives", "collaborations":
- Collection title
- Collection description

### 1.3 Journal articles (tertiary, V2+)

Once the journal ships (see next-improvements spec §1):
- Article title
- Author
- Pillar name
- Body content (indexed but lightly weighted)

### 1.4 Out of scope

- Policy pages, help pages, FAQ — these belong in the footer and in a help widget, not in product search
- Customer profiles (internal CRM only, different surface)
- Staff-facing content

---

## 2. Architecture by phase

### 2.1 V1 — Shopify Predictive Search API

Use the built-in Shopify Storefront Predictive Search. It handles the 80% case at zero cost:

**What it does well:**
- Real-time typeahead on product title, type, vendor, variant, tags
- Fast (< 200ms p95)
- Included in Shopify Storefront API, no extra service
- Supports filtering by resource type (products only, or products + collections + articles)

**What it doesn't do:**
- No typo tolerance beyond basic stemming
- No custom ranking boost
- No personalization
- No synonym handling
- No "did you mean" suggestions
- Description text is indexed but not weighted well

Acceptable for launch. Not acceptable long-term.

### 2.2 V2 — Typesense

Once traffic and catalogue size justify it, move to Typesense:

**Why Typesense over alternatives (Algolia, Meilisearch, Elasticsearch):**
- Open source — no vendor lock-in, full data portability
- Closest feature parity to Algolia for e-commerce use cases (merchandising, faceted filtering, typo tolerance, synonyms, curation)
- Predictable pricing — cluster-based, not per-search or per-record
- InstantSearch compatibility via the Typesense-InstantSearch adapter — UI components built against Algolia's React InstantSearch work with minimal changes
- Sub-50ms search performance consistently
- Self-host or managed cloud — both viable paths
- C++ engine, mature and battle-tested at scale

**Why not Algolia:** Pricing scales with catalogue and search volume. At Lunettiq's projected growth, the premium over Typesense (roughly 4-5x) doesn't buy enough additional value to justify the lock-in. The Algolia dev experience is slightly better, but the gap has narrowed significantly.

**Why not Meilisearch:** E-commerce feature maturity lags Typesense. Sort orders require duplicate indices (same quirk as Algolia). Less battle-tested in e-commerce deployments specifically.

**Why not Elasticsearch/OpenSearch:** Operational burden is disproportionate to Lunettiq's catalogue size (200-500 products). Built for terabytes of data, not product catalogues.

**Data sync approach:**
- Shopify → Postgres projection (already happening per CRM spec §4)
- Postgres → Typesense via Inngest job (on product update webhook + nightly full reindex)
- Typesense collection schema matches projection schema, with denormalized search-optimized fields

**Deployment options:**

*Option A: Self-hosted.* Typesense runs as a single binary. Minimum viable deployment: small VPS (4GB RAM, 2 vCPU) at ~$20-30/month. Requires someone to manage the VM, upgrades, and backups.

*Option B: Typesense Cloud.* Managed hosting with cluster-based pricing. At Lunettiq's scale (200-500 products, expected search volume), smallest cluster tier runs ~$30-50/month. No ops burden. Recommended unless there's specific reason to self-host.

**Cost comparison:**
| Solution | Monthly cost at Lunettiq scale |
|---|---|
| Algolia | $100-150 |
| Typesense Cloud | $30-50 |
| Typesense self-hosted | $20-30 (plus ops time) |
| Meilisearch Cloud | $50-70 |

### 2.3 CRM-internal search

Separate from the customer-facing search. The CRM and mobile apps query Postgres directly (CRM spec §8.3) for staff-facing catalogue browsing. Uses SQL `ILIKE` and tag filters. No Typesense dependency internally.

---

## 3. Search overlay — interaction design

### 3.1 Trigger

From the nav, "Search" label opens a full-screen overlay (desktop) or bottom sheet (mobile).

Keyboard shortcut: `/` or `⌘K` on desktop opens search.

### 3.2 Overlay layout (desktop)

```
┌────────────────────────────────────────────────────────┐
│  [Lunettiq logo]              [Search input]    [✕]    │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [Suggestions area — dynamic based on query state]    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

Layout rules:
- Full-width overlay, top-aligned
- Background: brand off-white `#F5F2EC`
- Search input: centred, large (32px type), placeholder "Search frames, colours, shapes"
- Close: `esc` key or × button top-right
- Prevent body scroll while open

### 3.3 Empty state (focus without query)

Before the user types anything, the overlay shows useful shortcuts — not a blank space.

**Three sections:**

**Popular searches** (curated, 4-5 pills)
- Examples: "Round frames", "Tortoise", "Signature collection", "Small size", "New arrivals"
- Set in Shopify admin (V1 hardcoded, V2 CMS-driven)

**Recent searches** (per-user, if logged in or localStorage)
- Last 5 searches the user ran
- "Clear history" option

**Quick categories** (4 tiles)
- Optical, Sun, Collaborations, Archives
- Visual — small thumbnail image per category

### 3.4 Typeahead state (query in progress)

After 2 characters typed, results start appearing below the input. Three sections, vertically stacked:

**Products section (primary)**
- 6 product cards, 2 columns
- Each card: image (smallest aspect ratio), name, price, colour count
- Hover: slight scale, nothing aggressive
- "See all [N] products →" link at the bottom of the section → full results page

**Collections section**
- 3 collection chips: image thumbnail + name
- Only shown if any collections match the query

**Suggestions section**
- Text-only suggestions: "round · shape", "tortoise · colour", "acetate · material"
- Let the customer click to apply a filter in one tap
- Only shown if the query matches known facets

### 3.5 Full results state (Enter pressed or "See all" clicked)

Search dedicated route: `/search?q=[query]`

Layout matches PLP (3-column grid) but with:
- Query echo at top: "Showing results for 'tortoise acetate'"
- Applied filters visible as pills (removable)
- "Refine" button to open the filter drawer (shape, colour, material, size, etc.)
- Sort control (relevance is default, not featured)
- Empty state if zero results (see §6)

### 3.6 Close behaviour

- `esc` key → close overlay, return to previous scroll position
- Clicking outside the overlay → close
- Clicking a result → navigate to PDP, overlay closes
- "See all" → navigate to `/search?q=...`, overlay closes

### 3.7 Anti-patterns to avoid

Things Lunettiq specifically shouldn't do:

- **Promoted/sponsored results.** Clashes with the curated brand tone.
- **"People also searched for" in typeahead.** Feels like Amazon.
- **Aggressive autocomplete.** Don't complete words the customer isn't typing. Suggest, don't assume.
- **Result count as a badge on the search button.** "Search (127)" is clutter.
- **Category filters in the typeahead.** Filter controls belong on the results page, not cluttering the typeahead.
- **Recent searches that persist across shared devices.** If in a public or shared context, this is a privacy leak.

---

## 4. Query handling

### 4.1 Query normalization

Before hitting the index, queries get cleaned:

- Trim whitespace
- Lowercase (except for the display echo)
- Strip diacritics for matching (but preserve in display) — "café" matches "cafe"
- Singular/plural collapse: "frames" → "frame" for matching
- Remove common stopwords for matching: "the", "a", "for", "with"

### 4.2 Typo tolerance

V1 (Shopify Predictive Search): minimal. Customers who typo get fewer results. Accept this.

V2 (Typesense): tolerance of 1 edit distance for queries 4+ characters, 2 edits for 8+ characters. Typesense's defaults work well for the category. Per-field typo tolerance can be tuned — tighter on product names (fewer allowed typos), looser on descriptions.

Example behaviours (V2):
- "senna" matches "Senna" exactly
- "sena" → "Senna" (1 edit)
- "akay-eye" → "cat-eye" (stretch, covered by synonym rules)
- "torttoise" → "tortoise" (2 edits on long word)

### 4.3 Synonyms

Maintain a synonym dictionary. V1 hardcoded, V2 managed via Typesense's synonyms API.

**Brand-specific synonyms (Lunettiq frame names):**
- Full set of product names → their variants (typos, partials)

**Category synonyms:**
- "sunglasses" ↔ "sun" ↔ "shades"
- "glasses" ↔ "eyeglasses" ↔ "spectacles" ↔ "frames"
- "prescription" ↔ "Rx" ↔ "optical"
- "blue light" ↔ "screen" ↔ "computer"

**Shape synonyms:**
- "cat-eye" ↔ "cats eye" ↔ "cateye"
- "round" ↔ "circle"
- "square" ↔ "rectangular"
- "aviator" (if relevant to the catalogue)

**Colour synonyms:**
- "tortoise" ↔ "tortoiseshell" ↔ "havana"
- "clear" ↔ "transparent" ↔ "crystal"
- "black" ↔ "noir" (for French-speaking users pre-localization)

**Material synonyms:**
- "acetate" ↔ "plastic" (though "plastic" is demotive, still needs to match)
- "metal" ↔ "titanium" ↔ "stainless"

### 4.4 Facet detection

When a query matches a known facet (shape, colour, material), surface it as a clickable suggestion in the typeahead: "round · shape filter". Clicking applies the filter instead of running a text search. Faster path to results.

### 4.5 Multi-term queries

"round tortoise acetate" should match products with all three attributes. AND logic by default, not OR.

Edge case: if strict AND returns zero results, fall back to OR with a note: "No exact matches for 'round tortoise acetate'. Showing frames matching any of these."

---

## 5. Ranking and relevance

### 5.1 V1 — Shopify default

Shopify Predictive Search uses its own ranking. Limited configurability. Accept what it gives. Spot-check quality on common queries before launch.

### 5.2 V2 — custom ranking formula (Typesense)

Search results ranked by a weighted score. Typesense's ranking is configured via `sort_by` directives and field weights.

**Textual relevance factors (Typesense native):**
- Exact match on product title (highest weight)
- Prefix match on title
- Match in tags
- Match in description
- Typo distance (fewer typos → higher rank)

**Business ranking factors (custom):**
- `inventory_quantity > 0` → boost (don't bury in-stock items behind out-of-stock)
- `tag: new` → slight boost (2 week window)
- `tag: collection:signature` → slight boost (flagship frames)
- Purchase count (last 90 days) → boost proportional to popularity
- Recently added product → slight boost
- `hasPersonalizationMatch` (logged-in only, see §7) → significant boost

**Demotion factors:**
- Out of stock → demote (not hide)
- Archive collection → demote unless explicitly in query ("archives")
- Products customer has already purchased (logged-in only) → demote heavily

### 5.3 Editorial override

A small manual override mechanism for merchandising moments. In Shopify admin, a search term can be associated with a curated list of products:

- Term: "new collab" → manually set to feature the 4 frames from the latest collaboration
- Term: "gift" → curated gift guide selection

V2 scope. Managed via Shopify metaobject `search_overrides`.

### 5.4 Testing ranking

For ranking changes to go live, they pass a review on 20 benchmark queries:

- Popular single-word queries (shape and colour terms)
- Product name queries (including typos)
- Multi-word queries
- Edge cases (empty brand queries, gibberish, single character)

Review: Benjamin plus the content lead. Spot-check, not A/B test (catalogue volume too low for meaningful AB).

---

## 6. Empty states and zero-result handling

### 6.1 Zero-result page

When a query returns nothing, don't just say "No results." Offer paths forward.

Layout:

```
"No frames matching 'xyz'."

"You might try:"
 [4 suggested alternatives — based on partial match, category fallback, or popular searches]

"Or browse by:"
 [category tiles: Optical · Sun · Collections]

"Still not finding it?"
 [Link: Book a styling consultation] [Link: Contact us]
```

### 6.2 Fallback suggestion logic

When zero results:
1. First try: strip the most specific term and search again ("round tortoise lightweight" → "round tortoise")
2. Second try: match on any facet found in the query and surface those products
3. Third try: show the four most popular products in the catalogue

### 6.3 "Did you mean" (V2, Typesense)

When a query is close to something that would have returned results:
- "Did you mean 'Senna'?" shown above the results
- Clickable — replaces query with the corrected version
- Based on edit distance + popularity

Don't show "did you mean" when the query returns reasonable results. It's a fallback, not a feature.

---

## 7. Personalization layer

Per the personalization strategy spec §2.5 — logged-in members get subtle weighting, not separate results.

### 7.1 What personalizes

For logged-in members with 2+ orders:

- **Boost:** Products matching derived shapes, materials, colours from purchase history
- **Boost:** Products in the member's price band (derived_price_range)
- **Boost:** Products matching stated preferences
- **Demote:** Products on the `avoid` list
- **Demote heavily:** Products already purchased
- **Size-filter (soft):** If the member has a size tag, their size appears first, but other sizes remain visible

### 7.2 What doesn't personalize

- The search query itself (don't change what the customer typed)
- The set of matching products (same catalogue, same matches)
- The category fallback if zero results (stays universal)
- Editorial overrides (manual curation wins over personalization)

### 7.3 Crossover handling

If a member types a category they've never bought from (e.g., "sunglasses" for an optical-only member), the personalization spec calls for showing their usual category first, then the searched category.

Implementation: boost optical results slightly for this member, but don't hide sunglass results. The customer asked for sunglasses; they get sunglasses. They also get a subtle nod toward what they usually buy.

### 7.4 Privacy

Personalization signals stay server-side. Never expose in query params. Never include in URLs. If a personalized result gets shared via URL, the recipient sees the generic version.

### 7.5 Non-member behaviour

Guests and logged-out users get:
- Base ranking (no personalization)
- Popular searches in the empty state
- No "recent searches" unless localStorage has history
- No derived-preference weighting

---

## 8. Mobile-specific considerations

### 8.1 Entry point

Mobile nav has Search icon only (space-constrained). Tapping opens a full-screen bottom sheet, not an overlay.

### 8.2 Keyboard handling

- Search input auto-focuses on open, keyboard appears
- `enter` key submits to full results page
- "Search" button (system keyboard) acts as submit
- Virtual keyboard doesn't cover results — results area resizes

### 8.3 Result density

- Two columns for products (not three — too small on phone)
- Larger touch targets (minimum 44pt tap area)
- Swipeable horizontal scroll for collection chips

### 8.4 Voice search (V2+)

Native voice input via keyboard dictation works out of the box. No custom voice UI needed for V1 or V2.

Stretch: direct voice-search button on the mobile search bar. Ships with PostHog tracking to validate usage before investing.

### 8.5 Browser back handling

On mobile especially, customers instinctively swipe back. Overlay close on back gesture, not navigation.

---

## 9. Analytics and feedback loop

Search data is the fastest way to understand what customers are looking for — and what the catalogue is missing.

### 9.1 Events tracked (PostHog, V2)

| Event | Properties |
|---|---|
| `search_opened` | source (nav, keyboard shortcut) |
| `search_query_submitted` | query, result_count, query_length |
| `search_result_clicked` | query, product_id, position, time_to_click |
| `search_zero_results` | query, fallback_shown |
| `search_filter_applied_from_suggestion` | query, facet_type, facet_value |
| `search_abandoned` | query, time_in_overlay |

### 9.2 Dashboards

New CRM report module at `/reports/search`:

- **Top queries** — most-searched terms, last 30 days
- **Zero-result queries** — queries with no matches (flag gaps in the catalogue or synonym dictionary)
- **Click-through rate** — queries where customers don't click anything (ranking problem?)
- **Query abandonment** — searches that don't end in a click or refinement (poor relevance)
- **New query trends** — terms appearing for the first time this week

### 9.3 Action from the data

Weekly review (content lead or Benjamin):
- Zero-result queries → add synonyms, or flag genuine catalogue gaps for merchandising
- Low-CTR queries → review ranking for those terms
- Rising queries → potential editorial or collection moments

### 9.4 Merchandising feedback loop

When a search term shows significant volume but the catalogue has no good match, it's a signal worth acting on. Example: customers search "titanium" but the catalogue has only acetate. That's either a synonym problem (some existing metal frames have titanium components but aren't tagged) or a product gap.

---

## 10. Accessibility

### 10.1 Keyboard

- Tab order: search input → suggestion list → close
- Arrow keys navigate suggestion list
- Enter on a suggestion navigates to it
- Esc closes overlay
- Shortcut key (`/` or `⌘K`) opens overlay

### 10.2 Screen readers

- Search input labelled "Search frames, colours, shapes"
- Suggestion list announced as "[N] suggestions"
- Each suggestion readable as "[Product name], [price], [colour]"
- Zero-result state announced clearly
- Focus returned to nav trigger on close

### 10.3 Visual

- Focus ring on search input visible (3px, brand green)
- Colour contrast passes WCAG AA on all text
- Icons paired with text labels where space permits
- Sufficient touch target size on all interactive elements (44pt minimum)

---

## 11. Performance budgets

| Metric | Target |
|---|---|
| Overlay open animation | < 200ms |
| First typeahead result (V1, Shopify) | < 300ms p95 |
| First typeahead result (V2, Typesense) | < 150ms p95 |
| Full search results page load | < 800ms p95 |
| Search input responsiveness (keystroke to render) | < 16ms per frame |
| Zero-result fallback | < 500ms p95 |

### 11.1 Debouncing

Typeahead queries debounce at 150ms. Faster feels twitchy, slower feels laggy.

### 11.2 Abort previous requests

If a user types quickly, abort in-flight requests for earlier queries. Prevents out-of-order rendering.

### 11.3 Caching

- Recent queries (last 20) cached client-side for back-button fidelity
- Popular queries cached at edge (Vercel) with 60-second TTL for logged-out users
- Logged-in personalized results not cached at edge (user-specific)

---

## 12. Data model additions

### 12.1 Search log (CRM-owned)

```
search_queries
  id                    uuid
  customer_id           string (nullable — anonymous allowed)
  session_id            string (anonymous session identifier)
  query                 text
  query_normalized      text
  result_count          integer
  clicked_product_ids   string[] (array, may be empty)
  clicked_position      integer (nullable, first click)
  time_to_first_click   integer (ms, nullable)
  applied_filters       jsonb
  is_personalized       boolean
  zero_result           boolean
  synonym_matched       text (nullable — which synonym rule fired)
  device                enum (desktop | mobile | tablet)
  created_at            timestamp
```

### 12.2 Synonyms table (CRM-owned, V2)

```
search_synonyms
  id                    uuid
  canonical             text (the "real" term)
  variants              text[] (array of synonyms)
  category              enum (product_name | shape | colour | material | category | generic)
  active                boolean
  created_by            string (staff id)
  created_at            timestamp
  updated_at            timestamp
```

Editable in CRM at `/settings/search/synonyms`.

### 12.3 Editorial overrides (V2)

```
search_overrides
  id                    uuid
  term                  text (the search term that triggers this override)
  match_type            enum (exact | prefix | contains)
  pinned_product_ids    string[] (products to pin to top of results)
  display_message       text (optional: "Our latest collab" banner)
  active_from           timestamp
  active_until          timestamp (nullable)
  created_by            string (staff id)
  created_at            timestamp
```

Editable in Shopify admin via metaobject, or in the CRM at `/settings/search/overrides`.

### 12.4 Shopify-side requirements

For search to work well, the existing product tagging convention (functionality spec §9.4) must be kept strictly. Missing tags = missing from filtered results. Worth auditing before launch that every product has:
- `shape:*` tag
- `colour:*` tag (for every variant)
- `material:*` tag
- `size:*` tag
- `type:*` tag

One data-quality check in the CRM: a report flagging products with incomplete tag coverage.

---

## 13. V1 scope vs V2 roadmap

### 13.1 V1 — with site launch

- Search overlay with focus state (desktop + mobile)
- Empty state with popular searches (hardcoded) and recent searches (localStorage)
- Typeahead with product results (6), collection chips (3)
- Full results page at `/search?q=...`
- Zero-result fallback with category tiles
- Shopify Predictive Search backend
- Query normalization (case, diacritics, stopwords)
- Basic keyboard shortcuts (`/` or `⌘K`)
- Performance budgets met
- Accessibility compliance
- PostHog analytics events wired (even if dashboards come later)

### 13.2 V2 — with customer accounts launch

- Typesense backend with full indexing (Typesense Cloud or self-hosted)
- Typo tolerance
- Synonym dictionary (brand-managed)
- Custom ranking formula with business boost factors
- Personalization for logged-in members
- Facet suggestions in typeahead
- "Did you mean" corrections
- Search analytics dashboard in CRM
- Synonym management UI in CRM

### 13.3 V2.1

- Editorial search overrides (merchandising moments)
- Journal article integration (once journal ships)
- Voice search on mobile (if usage data supports it)
- Saved searches for logged-in members
- Alert me when new products match a saved search

### 13.4 Explicitly out of scope

- Visual search (upload a photo, find similar frames) — category is too small for this investment
- AI chat-based search ("Show me frames for a square face in warm tones") — V3+, if at all
- In-store voice search on iPad — separate surface, not customer-facing
- Cross-brand search (searching competitor frames) — not the play
- Real-time collaboration/shared search — not the play

---

## 14. Resolved decisions

| # | Decision | Resolution |
|---|---|---|
| 1 | **V1 vs V2 ship timing** | **Ship V1 with Shopify Predictive Search, upgrade to Typesense post-launch.** Search is a day-one requirement; the Typesense upgrade is additive and can ship without rebuilding the UI. |
| 2 | **Default sort on full results page** | **Relevance default, with sort picker.** Relevance is the intelligent default. The picker gives customers control when they want it (price, newest, etc.). |
| 3 | **Recent searches privacy** | **Client-side only (localStorage) for guests, server-side for logged-in members with explicit opt-out.** Respects guest privacy, persists helpfully for members. |
| 4 | **Keyboard shortcut** | **Both `⌘K` and `/` supported.** Both are common conventions, zero cost to support both. |
| 5 | **Zero-result CTA** | **Styling consultation booking.** On-brand, better escalation than a contact form. Consultation booking is the right resolution path for a customer who couldn't find what they were looking for. |
| 6 | **Voice search priority** | **V2.1 after usage data.** No evidence of demand yet. Ship after PostHog data tells us whether customers are hitting the native voice input on mobile. |
| 7 | **Search analytics retention** | **12 months.** Enough for trend analysis and annual comparisons. Manageable storage footprint. |
| 8 | **Personalization indicator** | **Silent — customer doesn't know.** Matches the three-pass principle from the personalization strategy. Let members notice the quality improvement without announcing it. |
| 9 | **Popular searches source** | **Hybrid — curated list with data-driven refinement over time.** Start with a brand-set list, update quarterly based on aggregate search data. |
| 10 | **Multi-language V1** | **English only.** Matches the functionality spec's CAD/EN V1 default. French support ships in V2 alongside the full localization roadmap. |
| 11 | **Search backend V2** | **Typesense.** Open source, e-commerce mature, predictable pricing, InstantSearch compatibility. Migration path from Algolia exists if priorities shift later. |
| 12 | **Typesense deployment** | **Typesense Cloud (managed).** Low ops burden, predictable cost at ~$30-50/month, recommended unless dev team has specific capacity for self-hosting. Revisit self-hosted if budget priorities shift. |

These resolutions are reflected in the relevant sections above. This table remains for change-history traceability.
