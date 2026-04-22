# Architecture Decision Log

Append-only. Newest first.

---

### ADR-006: No Shopify Plus — Draft Order Checkout

**Date:** 2026-04-21 · **Status:** Accepted

**Context:** Shopify Plus $2,300/mo. Lunettiq configured eyewear (frame + lens + coatings + Rx) needs custom pricing Shopify standard cart can't compute.

**Decision:** Stay standard Shopify. Custom cart client-side → `POST /api/checkout/create` → Draft Order via Admin API → redirect to Shopify invoice page.

**Consequences:** No Checkout Extensibility/Functions/Scripts. All pricing in CRM engine. Draft Order = only checkout path for configured eyewear. Storefront API cart still used for simple accessories.

---

### ADR-005: DB-Driven Pricing Engine

**Date:** 2026-04-21 · **Status:** Accepted

**Context:** Lens pricing = base per channel + addon stacking + constraints. Shopify variants can't model (each colour = own product, no lens-feature variants).

**Decision:** Pricing engine reads `option_groups`, `options`, `price_rules`, `constraint_rules` from Postgres. Quotes computed server-side, attached as cart line attributes. Draft order gets final price.

**Consequences:** CRM-managed pricing, no deploys for addon changes. Needs reconciliation between quote and draft order total.

---

### ADR-004: Dual Currency Loyalty (Credits + Points)

**Date:** 2026-04-21 · **Status:** Accepted

**Context:** Membership credits (monthly accrual, store currency) ≠ engagement points (earned via actions, 100:$5).

**Decision:** Single `credits_ledger` table, `currency` enum (`credit` | `points`). Transaction types prefixed. Separate balance queries.

**Consequences:** One table, two balances. Points expire (18mo), credits don't. One-way conversion (points → credits).

---

### ADR-003: Shopify Projection Tables

**Date:** 2026-04-21 · **Status:** Accepted

**Context:** CRM needs fast queries + joins to CRM data. Shopify API rate-limited, no complex queries.

**Decision:** Webhook-synced projection tables in Neon. Shopify → Inngest → idempotent upserts. CRM reads local DB only.

**Consequences:** Eventually consistent (seconds). Webhook failures need retry + nightly reconciliation. Schema tracks Shopify shape changes.

---

### ADR-002: Conditional Integration Loading

**Date:** 2026-04-21 · **Status:** Accepted

**Context:** 15+ integrations, not all enabled. Dead code bloats bundles + leaks API calls.

**Decision:** All integration code gated on `isIntegrationEnabled()` / `getKey()`. Dynamic imports only. Exceptions: Shopify, Neon, Clerk, Next.js.

**Consequences:** Zero bundle cost when disabled. Every touchpoint needs guard. See `steering/architecture.md`.

---

### ADR-001: Single Next.js Monolith

**Date:** 2026-04-21 · **Status:** Accepted

**Context:** Need storefront + CRM + API. Separate deploys = infra complexity for small team.

**Decision:** Single Next.js 14 App Router. Route groups: `(storefront)/`, `crm/` (Clerk-gated), `api/`. Shared `lib/` + `db/`.

**Consequences:** One deploy, one DB, shared types. CRM bundle separate from storefront (route groups). Middleware handles dual auth.
