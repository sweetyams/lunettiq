# Phase E — AI Segmentation: Design

**Status:** DRAFT
**Prereq:** Phase A complete

---

## D-030: Fix SQL injection + field allowlist (REQ-E-001, REQ-E-002, REQ-E-003)

**File:** `src/app/api/crm/segments/route.ts` — rewrite `evaluateSegmentRules`

Replace the `default` case that uses `sql.raw("${c.field}")` with a field allowlist:

```ts
const ALLOWED_FIELDS: Record<string, SQL> = {
  order_count: sql`order_count`,
  total_spent: sql`total_spent::numeric`,
  first_name: sql`first_name`,
  last_name: sql`last_name`,
  email: sql`email`,
  // ... all valid fields
};
```

For `created_at`: use `buildDateOp` that compares as timestamps, not numeric.
For `membership_tier`: prepend `member-` to the value before matching against tags.
Unknown fields → return 400, never execute.

---

## D-031: Add missing fields to rule builder (REQ-E-004)

**File:** `src/app/crm/segments/page.tsx` — modify FIELDS array

Add: `last_order_date`, `days_since_created`, `postal_prefix`. Total 19+ fields.

Also add `date` to OPERATORS for date-type fields and `in_last_n_days` operator.

---

## D-032: ai_requests table (REQ-E-010)

**File:** `src/lib/db/schema.ts` — add table

```ts
export const aiRequests = pgTable('ai_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  model: text('model').notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costEstimateCents: integer('cost_estimate_cents'),
  requestedAt: timestamp('requested_at').defaultNow(),
});
```

Helper: `src/lib/crm/ai-usage.ts` — `logAiRequest()` and `checkDailyBudget()`.

---

## D-033: AI suggest endpoint hardening (REQ-E-005)

**File:** `src/app/api/crm/segments/ai-suggest/route.ts` — modify

- Accept optional `goal` and `dateRange`
- Validate Claude output against rule schema (field must be in allowlist)
- Run `evaluateSegmentRules` on each suggestion to get actual member count
- Log to `ai_requests` table
- Check daily budget before calling Claude

---

## D-034: AI explain endpoint (REQ-E-006)

**File:** `src/app/api/crm/segments/[id]/explain/route.ts` — new

- Fetch segment rules + run aggregation on segment members
- Send to Claude with explain prompt
- Wrap Anthropic call in try/catch (audit fix)
- Log to `ai_requests`
- Return `{ explanation, refinementSuggestions[] }`

---

## D-035: AI refine endpoint (REQ-E-007)

**File:** `src/app/api/crm/segments/[id]/refine/route.ts` — new

- Fetch current rules, send with user instruction to Claude
- Claude returns modified rules
- Validate rules, compute new member count
- Return `{ proposedRules, diff, newSize }`
- Don't save — user confirms in UI first

---

## D-036: Fix ai-analyze try/catch (REQ-E-006)

**File:** `src/app/api/crm/segments/ai-analyze/route.ts` — modify

Wrap the Anthropic call in try/catch (matches ai-suggest pattern). Log to `ai_requests`.

---

## D-037: Suggestion cards with edit button (REQ-E-008)

**File:** `src/app/crm/segments/page.tsx` — modify AI suggestions section

Each suggestion card gets three buttons:
- Create: saves segment (existing)
- Edit: loads rules into the rule builder (pre-fills conditions)
- Dismiss: removes from list (existing)

---

## D-038: "Why this segment?" + refine UI (REQ-E-009)

**File:** `src/app/crm/segments/page.tsx` — modify segment detail

- "Why this segment?" button on each saved segment
- Opens panel, calls explain endpoint, shows explanation + suggestions
- Each suggestion is clickable → calls refine endpoint → shows diff → confirm to save

---

## Files summary

| File | Action | REQs |
|---|---|---|
| `api/crm/segments/route.ts` | Rewrite evaluateSegmentRules | E-001, E-002, E-003 |
| `app/crm/segments/page.tsx` | Modify (fields, edit btn, explain) | E-004, E-008, E-009 |
| `lib/db/schema.ts` | Add ai_requests table | E-010 |
| `lib/crm/ai-usage.ts` | New | E-010 |
| `api/crm/segments/ai-suggest/route.ts` | Modify | E-005 |
| `api/crm/segments/ai-analyze/route.ts` | Modify | E-006 |
| `api/crm/segments/[id]/explain/route.ts` | New | E-006 |
| `api/crm/segments/[id]/refine/route.ts` | New | E-007 |
