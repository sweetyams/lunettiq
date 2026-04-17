# Phase D1 — Product Recommendations & Sentiment: Requirements

**Status:** DRAFT — awaiting review
**Scope:** Product scoring, enhanced search, sentiment capture, try-on sessions (data only), Klaviyo events
**Sources:** Spec 07 §2
**Depends on:** Phase A (auth), Phase C (client profile)
**Deferred:** D2 (AR try-on rendering with MediaPipe/Three.js — needs 3D assets)

---

## Data Model

### REQ-D1-001: Product interaction tracking
The system must track every interaction between a customer and a product.

**Acceptance criteria:**
- `product_interactions` table with: customerId, productId, variantId, interactionType, source, staffId, locationId, sessionId, metadata, occurredAt
- Interaction types: viewed, recommended, tried_on, liked, disliked, shared, saved, purchased
- Sources: crm_web, tablet, storefront, system
- Indexed on customerId+date, productId+date, interactionType, sessionId

---

### REQ-D1-002: Aggregated product feedback
The system must maintain a per-customer-per-product sentiment summary.

**Acceptance criteria:**
- `product_feedback` table with: customerId, productId, sentiment (love/like/neutral/dislike), tryOnCount, viewCount, lastInteractionAt
- Unique index on (customerId, productId)
- Upserted on each relevant interaction

---

### REQ-D1-003: Try-on session tracking
The system must track fitting sessions even before AR rendering is built.

**Acceptance criteria:**
- `try_on_sessions` table with: customerId, staffId, locationId, startedAt, endedAt, framesTried, outcomeTag, notes
- Outcome tags: purchased, saved_for_later, no_match, needs_followup
- Sessions can be started/ended via API

---

## Product Search & Scoring

### REQ-D1-004: Enhanced product search with personalization
When a customerId is provided, product search results must be ordered by recommendation score.

**Acceptance criteria:**
- GET `/api/crm/products/search` with optional `customerId` param
- Without customerId: standard search (existing behavior)
- With customerId: each product scored and sorted by score descending
- Response includes `matchScore` and `matchReasons` per product when personalized
- Excludes previously purchased products
- Excludes previously disliked products

---

### REQ-D1-005: Scoring function
Product scores must consider face shape, stated preferences, derived preferences, fit measurements, price range, and prior feedback.

**Acceptance criteria:**
- Face shape match: +8
- Stated shape preference: +6
- Stated material preference: +4
- Stated colour preference: +3
- Derived preferences: +1-3 weighted by confidence
- Price in comfort zone (±30% of avg): +2
- Frame width fit (±2mm): +5, (±4mm): +2, (>8mm off): -4
- Previously loved: +10, liked: +5
- Previously disliked: exclude
- Already purchased: exclude
- Match reasons returned as string array

---

## Sentiment & Interactions

### REQ-D1-006: Record product interaction API
Staff must be able to record likes, dislikes, views, and saves on products for a client.

**Acceptance criteria:**
- POST `/api/crm/products/interactions`
- Body: customerId, productId, variantId (optional), type, sessionId (optional), metadata (optional)
- Writes to `product_interactions`
- On like/dislike/save: upserts `product_feedback`
- Auth: `org:recs:create`

---

### REQ-D1-007: Try-on session APIs
Staff must be able to start and end fitting sessions.

**Acceptance criteria:**
- POST `/api/crm/tryon/sessions` — start session, returns sessionId + recommended product queue
- POST `/api/crm/tryon/sessions/[id]/end` — end session with outcomeTag and notes
- GET `/api/crm/clients/[id]/tryon-sessions` — session history for a client
- Auth: `org:tryon:initiate` for start/end, `org:tryon:view_history` for history

---

### REQ-D1-008: Client profile try-on history
The client profile right column must show past try-on sessions.

**Acceptance criteria:**
- Section shows: date, location, staff, frames tried, outcome
- Each session expandable to show individual frame sentiments
- Links to products

---

## Klaviyo Integration

### REQ-D1-009: Fire Klaviyo events on sentiment interactions
Liked, disliked, saved, and shared interactions must fire Klaviyo custom events.

**Acceptance criteria:**
- Events: "Liked Frame", "Disliked Frame", "Saved Frame", "Completed Fitting Session"
- Properties include: productId, productTitle, price, sessionId, staffId, locationId
- Failures logged but don't block the CRM response
- Only fires when customer has an email

---

## Out of Scope (D2)

- MediaPipe face tracking
- Three.js 3D frame rendering
- Live camera feed UI
- Capture/share screenshots
- Tablet fitting room mode
- Per-product GLB asset management

---

## Traceability

| Requirement | Spec 07 Section |
|---|---|
| REQ-D1-001 | §2.3 |
| REQ-D1-002 | §2.3 |
| REQ-D1-003 | §2.3 |
| REQ-D1-004 | §2.4 |
| REQ-D1-005 | §2.4 (score.ts) |
| REQ-D1-006 | §2.9 |
| REQ-D1-007 | §2.9 |
| REQ-D1-008 | §2.10 |
| REQ-D1-009 | §2.11 |
