# Phase D1 — Product Recommendations & Sentiment: Design

**Status:** DRAFT
**Prereq:** Phase A, C complete

---

## D-039: New tables (REQ-D1-001, D1-002, D1-003)

**File:** `src/lib/db/schema.ts` — add 3 tables

```ts
productInteractions: id, shopifyCustomerId, shopifyProductId, shopifyVariantId?,
  interactionType (enum), source (enum), staffId?, locationId?, sessionId?,
  metadata (jsonb), occurredAt
  Indexes: (customerId, occurredAt), (productId, occurredAt), (interactionType), (sessionId)

productFeedback: id, shopifyCustomerId, shopifyProductId, sentiment (enum),
  tryOnCount, viewCount, lastInteractionAt, updatedAt
  Unique index: (customerId, productId)

tryOnSessions: id, shopifyCustomerId, staffId?, locationId?,
  startedAt, endedAt?, framesTried, outcomeTag?, notes?
  Index: (customerId, startedAt)
```

---

## D-040: Score function (REQ-D1-005)

**File:** `src/lib/crm/product-score.ts` — new

Pure function, no DB calls. Takes product + context (customer, stated prefs, derived prefs, purchased IDs, feedback map), returns `{ score, reasons }`.

Weights per design doc. Returns `score: -1000` for exclusions (purchased, disliked).

---

## D-041: Enhanced product search (REQ-D1-004)

**File:** `src/app/api/crm/products/search/route.ts` — new

GET endpoint. When `customerId` is provided:
1. Load customer, preferences, orders (for purchased IDs), feedback
2. Score each product via D-040
3. Filter out score <= -1000
4. Sort by score desc
5. Return with `matchScore` and `matchReasons`

Without `customerId`: standard search (filter by q, type, vendor, price range).

---

## D-042: Record interaction API (REQ-D1-006)

**File:** `src/app/api/crm/products/interactions/route.ts` — new

POST: insert to `productInteractions`. On like/dislike/save: upsert `productFeedback` via `onConflictDoUpdate` on the unique index.

---

## D-043: Try-on session APIs (REQ-D1-007)

**File:** `src/app/api/crm/tryon/sessions/route.ts` — new (POST start)
**File:** `src/app/api/crm/tryon/sessions/[id]/end/route.ts` — new (POST end)
**File:** `src/app/api/crm/clients/[id]/tryon-sessions/route.ts` — new (GET history)

Start: create session row, return sessionId + top 8 recommended products (via score function).
End: set endedAt, framesTried count, outcomeTag, notes.
History: list sessions for a client with frame counts.

---

## D-044: Klaviyo events (REQ-D1-009)

**File:** `src/lib/klaviyo/events.ts` — new

`fireKlaviyoEvent(email, eventName, properties)` — POST to Klaviyo Events API. Failures logged, not thrown.

Called from the interaction recording API (D-042) on like/dislike/save types, and from session end (D-043).

---

## D-045: Try-on history on client profile (REQ-D1-008)

**File:** `src/components/crm/TryOnHistory.tsx` — new

Fetches from `/api/crm/clients/[id]/tryon-sessions`. Shows sessions with date, staff, frames tried, outcome. Added to the right column of `ClientProfileClient.tsx`.

---

## Files summary

| File | Action | REQs |
|---|---|---|
| `lib/db/schema.ts` | Add 3 tables | D1-001, D1-002, D1-003 |
| `lib/crm/product-score.ts` | New | D1-005 |
| `api/crm/products/search/route.ts` | New | D1-004 |
| `api/crm/products/interactions/route.ts` | New | D1-006 |
| `api/crm/tryon/sessions/route.ts` | New | D1-007 |
| `api/crm/tryon/sessions/[id]/end/route.ts` | New | D1-007 |
| `api/crm/clients/[id]/tryon-sessions/route.ts` | New | D1-007 |
| `lib/klaviyo/events.ts` | New | D1-009 |
| `components/crm/TryOnHistory.tsx` | New | D1-008 |
| `ClientProfileClient.tsx` | Add TryOnHistory section | D1-008 |
