# Spec 06: AI-Powered Segmentation

**Status:** APPROVED
**Dependencies:** Anthropic SDK (needs npm install)
**Permissions used:** org:segments:read, org:segments:create

---

## What exists today

- Segments page with rule builder (9 fields, AND/OR, preview count)
- Segments API: GET list, POST create (evaluates rules against customers_projection)
- evaluateSegmentRules() in segments route — SQL evaluation with equals/contains/gt/lt/tag_includes

---

## What to build

### 1. Install Anthropic SDK

```bash
npm install @anthropic-ai/sdk --legacy-peer-deps
```

Env var: `ANTHROPIC_API_KEY`

### 2. Expanded rule builder fields

Add to FIELDS array in segments page:
- last_order_date, days_since_last_order, created_at (Recency)
- home_location, face_shape, rx_on_file (Fit/Location)
- membership_tier (Loyalty)
- interaction_count, average_order_value (Engagement/Commercial)

Expand evaluateSegmentRules() to handle these via joins.

### 3. AI suggest endpoint

**File:** `src/app/api/crm/segments/ai-suggest/route.ts`

```
POST /api/crm/segments/ai-suggest
Auth: org:segments:create
Body: { dateRange?: { from, to } }
```

Steps:
1. Aggregate data (no PII):
   - Total customers, LTV distribution buckets, order frequency, tag frequency top 30
   - Dormancy buckets, tier breakdown, consent rates
2. Send to Claude with structured prompt
3. Parse response → return suggested segments

### 4. AI analyze endpoint

**File:** `src/app/api/crm/segments/ai-analyze/route.ts`

```
POST /api/crm/segments/ai-analyze
Auth: org:segments:read
Body: { dateRange?: { from, to } }
```

Returns insights with actionable segment suggestions.

### 5. Aggregation helper

**File:** `src/lib/crm/segment-aggregator.ts`

Shared function that builds the aggregated stats object from DB queries. Used by both AI endpoints.

### 6. UI additions to segments page

- "AI Suggest" button → calls ai-suggest → shows suggestion cards
- Each card: name, description, estimated size, [Create] [Edit] [Dismiss]
- Expanded FIELDS in the rule builder

---

## Done criteria

- [ ] Anthropic SDK installed
- [ ] Expanded rule builder with 18+ fields
- [ ] AI suggest endpoint returns 3-5 segment suggestions
- [ ] AI analyze endpoint returns insights
- [ ] Aggregation helper sends no PII to Claude
- [ ] Suggestion cards with accept/edit/dismiss
- [ ] TypeScript compiles clean
