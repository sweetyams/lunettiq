# Architecture Decision Log

Append-only. Newest first.

---

### ADR-010: Extended Group Types — Product, Content, Lens Colour

**Date:** 2026-04-22 · **Status:** Accepted

**Context:** The configurator needs three new patterns: add-on products (separate cart lines), content/info displays, and shared lens colour palettes. Rather than new choice types, these are new group types that change how a group sources data and renders.

**Decision:** Added `group_type` enum (`standard`, `product`, `content`, `lens_colour`) to `step_choice_groups`. Lens colours get dedicated tables (`lens_colour_sets` + `lens_colour_options`) as a shared catalogue — sets like "Polarized", "Custom Tint" are reusable across flows via `lens_colour_set_id` FK on groups. Product add-ons use existing `cfg_choices` with new `shopify_product_id` + `image_url` columns. Content uses `selection_mode: 'none'` with `content_body` on choices. Price stored at `lens_colour_options` level.

**Consequences:** Colour palettes are managed centrally (Settings → Lens Colours), not per-flow. Adding a colour to a palette makes it available everywhere. Product add-ons become separate cart lines. Three new columns on `cfg_choices`, two on `step_choice_groups`, two new tables.

---

### ADR-009: Remove Legacy Product Options UI, Rename Channels → Flows

**Date:** 2026-04-22 · **Status:** Accepted

**Context:** The product-options page had two views: "Builder" (flow editor + live preview) and "Logic & Diagnostics" (raw CRUD tables for legacy option_groups/options/price_rules/constraint_rules/step_definitions). The diagnostics view used a separate API (`/api/crm/product-options`) and two dead components (ConstraintMatrix, ExclusionGroups). "Channels" was confusing — implies sales channels, not configurator flows.

**Decision:** Removed the Logic & Diagnostics view, its API route, and dead components (~350 lines). Renamed all UI labels from "Channels" to "Flows" to match the data model (`configurator_flows`). URL path `/channels` kept for bookmark stability.

**Consequences:** Single-view product-options page (Builder only). Legacy tables still exist and are seeded, but no longer have a direct CRM editing UI — managed through the flow builder instead. "Flows" terminology is consistent with the DB schema.

---

### ADR-008: Cubitts Channel — Data-Only Seed into Existing Configurator

**Date:** 2026-04-22 · **Status:** Accepted

**Context:** Need a Cubitts-branded configurator flow (frame colour → frame size → lens type → lens colour → lens coatings → summary) with GBP pricing (£175 base, +£50 polarisation). The existing configurator has two parallel table systems: legacy (option_groups/options/price_rules/constraint_rules/step_definitions) and builder (configuratorFlows/flowSteps/stepChoiceGroups/cfgChoices/groupChoices/cfgPriceRules).

**Decision:** Add `cubitts` to the `channel` enum and seed data into both table systems via `scripts/seed-cubitts-channel.ts`. No schema changes — Cubitts-specific option groups and options are scoped via the `channels` jsonb array on each option. Frame colour maps to `finish_state` layer, frame size to `material` layer, lens colour/coatings to existing layers. Builder tables use `currency: 'GBP'` on price rules.

**Consequences:** Cubitts channel is fully isolated from optical/sun/reglaze via channel scoping. Existing configurator UI/engine works unchanged — just reads different data for the cubitts channel. GBP pricing introduces multi-currency in the builder price rules (existing channels use CAD).

---

### ADR-007: Implicit Exclusion via Group Selection Mode

**Date:** 2026-04-21 · **Status:** Accepted

**Context:** Current constraint_rules table has 23 rows, most encoding mutual exclusions that are already implied by single-select groups. Manual pairwise rules are hard to maintain and error-prone. Matrix UI helps visualize but doesn't fix the root cause.

**Decision:** Selection mode on groups (`single`, `multi`) implies default behavior. Single-select = siblings mutually exclusive automatically. Rules table only stores exceptions and cross-group logic (`requires`, `excludes`, `allowed_if`, `hidden_if`, `price_modifier_if`). Admin UI organized as: flow editor (channel → steps → groups) + option catalogue + targeted rule builder. Matrix becomes read-only QA view.

**Consequences:** Most existing constraint_rules rows become unnecessary — replaced by group selection mode. Rule count drops from ~23 to ~5-8 cross-group exceptions. Configurator engine must check group selection mode before evaluating rules. Admin UI needs full rebuild around flow-first editing.

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
