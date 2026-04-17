# Phase E — AI Segmentation: Requirements

**Status:** DRAFT — awaiting review
**Scope:** Rule builder, AI suggest/explain/refine, cost tracking, Klaviyo sync
**Sources:** Spec 07 §3, audit findings (2026-04-16)
**Depends on:** Phase A (auth, permissions)

---

## Critical Fix

### REQ-E-001: SQL injection in rule evaluation
The segment rule evaluator must validate field names against an allowlist. No user input may be interpolated into raw SQL.

**Acceptance criteria:**
- Field names validated against a known list before query execution
- Invalid field names return 400, not a SQL error
- No use of `sql.raw()` with user-provided values

**Source:** Audit finding — `evaluateSegmentRules` default case uses `sql.raw("${c.field}")`

---

### REQ-E-002: Fix `created_at` date comparison
The `created_at` field must use timestamp comparison, not numeric cast.

**Acceptance criteria:**
- `gt`/`lt` operators on `created_at` compare as timestamps
- Does not cast timestamp to numeric

**Source:** Audit finding — `CAST(col AS numeric)` on timestamp crashes Postgres

---

### REQ-E-003: Fix `membership_tier` value matching
Membership tier rules must match the actual tag format stored in the database.

**Acceptance criteria:**
- Rule value `vault` matches tag `member-vault`
- UI shows human-readable tier names, query prepends `member-` prefix

**Source:** Audit finding — `membership_tier equals vault` returned 0 results

---

## Rule Builder

### REQ-E-004: Expanded rule builder fields
The rule builder must support 19+ field categories covering identity, commercial, recency, product, membership, engagement, consent, and tags.

**Acceptance criteria:**
- All fields from spec 07 §3.2 are available in the rule builder UI
- Includes `last_order_date` (was missing per audit)
- Each field has appropriate operators (equals, gt, lt, contains, in_last_n_days, etc.)
- Rules compile to valid SQL against the projection tables

---

## AI Endpoints

### REQ-E-005: AI suggest endpoint
Claude must propose 3-5 segments based on aggregated (non-PII) sales data.

**Acceptance criteria:**
- POST `/api/crm/segments/ai-suggest`
- Accepts optional `goal` and `dateRange`
- Sends only aggregated stats to Claude (no names, emails, phones)
- Returns segments with: name, description, rationale, rules, estimated size, suggested action
- Validates Claude's output against rule schema before returning
- Returns 502 with meaningful message on Anthropic API failure

---

### REQ-E-006: AI explain endpoint
Claude must explain an existing segment in plain language with refinement suggestions.

**Acceptance criteria:**
- POST `/api/crm/segments/[id]/explain`
- Sends rule definition + member count aggregates to Claude
- Returns explanation + 2-3 refinement suggestions
- Proper error handling (try/catch on Anthropic call)

**Source:** Audit finding — missing try/catch on Anthropic call

---

### REQ-E-007: AI refine endpoint
Users must be able to describe rule changes in natural language and get back modified rules.

**Acceptance criteria:**
- POST `/api/crm/segments/[id]/refine`
- Accepts `instruction` string
- Returns proposed rules with diff (added/removed) and new estimated size
- User confirms before saving

---

## UI

### REQ-E-008: AI suggestion cards with create/edit/dismiss
Each AI suggestion must have three actions: create segment, edit rules, dismiss.

**Acceptance criteria:**
- Create: saves segment with the proposed rules
- Edit: loads rules into the rule builder for modification before saving
- Dismiss: removes the suggestion from the list

**Source:** Audit finding — Edit button was missing

---

### REQ-E-009: "Why this segment?" on segment detail
Segment detail view must have an explain button that shows Claude's analysis.

**Acceptance criteria:**
- Button on segment detail page
- Opens modal/panel with explanation and refinement suggestions
- Refinement suggestions are clickable (loads into refine flow)

---

## Cost Tracking

### REQ-E-010: AI request cost tracking
Every AI call must be logged with token usage and cost estimate.

**Acceptance criteria:**
- `ai_requests` table: userId, endpoint, model, inputTokens, outputTokens, costEstimateCents, requestedAt
- Every AI endpoint writes to this table after each call
- Daily soft cap of 200 requests per org (configurable)

---

## Out of Scope

- Klaviyo list sync (Phase F)
- Nested AND/OR rule trees (V2 — flat AND for now)

---

## Traceability

| Requirement | Audit Finding | Spec 07 Section |
|---|---|---|
| REQ-E-001 | SQL injection | §3.3 |
| REQ-E-002 | created_at crash | §3.3 |
| REQ-E-003 | membership_tier mismatch | §3.3 |
| REQ-E-004 | 16 fields, not 18+ | §3.2 |
| REQ-E-005 | — | §3.7 |
| REQ-E-006 | Missing try/catch | §3.8 |
| REQ-E-007 | — | §3.9 |
| REQ-E-008 | Edit button missing | §3.11 |
| REQ-E-009 | — | §3.11 |
| REQ-E-010 | — | §3.10 |
