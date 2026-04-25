# Architecture Decision Log

Append-only. Newest first.

---

### ADR-016: Multi-Location Inventory Projection + Protection Model

**Date:** 2026-04-25 · **Status:** Accepted

**Context:** Inventory projection used a single `shipping_location_id` to feed Shopify. With plans for store-as-fulfillment (Plateau, DIX30 shipping online orders), the projection needed to sum across multiple locations. Additionally, "protected stock" was a single opaque `security_stock` number with no audit trail for holds, try-on reservations, or last-unit locks.

**Decision:** (1) `projectToChannels()` now sums `max(0, location.available - location.online_reserve_buffer)` across all locations with `fulfills_online = true`. Each location has its own `online_reserve_buffer` column (default 2). (2) New `inventory_protections` table with scope (`all_channels`/`online_only`/`square_only`), reason (`try_on_hold`/`last_unit_lock`/`manager_hold`/etc.), expiry, staff owner, and reference linking. Active protections are subtracted from available during projection. (3) Last-unit lock auto-creates when a family with `last_unit_protected = true` drops to 1 available across all locations. (4) `return_inspections` table gates returned items through sellable/damaged/refurbish inspection before restocking. (5) `sync_discrepancies` table + nightly Inngest cron compares Shopify values to Lunettiq's computed projection, logs deltas, and pushes Lunettiq values (Lunettiq wins). (6) Protection expiry cron runs every 15 min to release expired holds and re-project.

**Consequences:** Adding a new fulfilling location requires only flipping `fulfills_online = true` and setting its buffer — no code changes. Holds are auditable per-staff with expiry. Last-unit protection is per-family with a global default. Returns don't auto-restock until inspected. Drift detection is automated nightly.

---

### ADR-015: Canonical Product Metafield Schema + Migration

**Date:** 2026-04-23 · **Status:** Accepted

**Context:** Product metafields were stored as raw Shopify namespace/key pairs with inconsistent naming (mix of `udesly` and `custom` namespaces, snake_case and kebab-case keys, values with embedded units like "52 mm"). No structured definitions on Shopify. Moving to 6 groups / 31 canonical fields with proper Shopify types.

**Decision:** (1) `lib/crm/metafield-schema.ts` — single source of truth: `METAFIELD_GROUPS` (details, design, materials_components, fit_sizing, compatibility, colour), `FIELD_MAP`, `UNIT_SUFFIXES`, `OLD_KEY_MAP`, `remapMetafields()` with unit stripping. Each field has a Shopify type (`number_integer`, `boolean`, `multi_line_text_field`, etc.) and optional `pin` flag (18 of 31 pinned, under Shopify's 20 limit). (2) Two-step migration via Settings → System: "Setup Metafield Definitions" creates/updates definitions on Shopify + writes CRM visibility groups to `store_settings`; "Migrate Existing Metafields" reads all namespaces (udesly, custom), derives `product_name` from title parsing (`ANDY © GREY` → `Andy`) or udesly `short-name`, derives `product_type` from tags (`optics` → `Optical`, `sunglasses` → `Sunglasses`) or existing `product_category`, derives `primary_frame_colour` from title or existing `frame_colour`, strips unit suffixes, and writes canonical keys back to Shopify. (3) All sync paths (full, single, webhook) call `remapMetafields()` on ingest. (4) Metafield visibility API only exposes canonical keys, includes 0% coverage fields. (5) System page reorganized into 4 groups (Initial Setup, Product Sync, Inventory, Square Integration) with descriptions and run time estimates.

**Consequences:** Running setup + migrate populates all 31 canonical fields from existing data. Old keys preserved during transition. CRM display uses schema labels. Udesly namespace fully consumed. Future: strip old keys, remove `OLD_KEY_MAP`.

---

### ADR-014: Frame-Level Inventory Reconciliation + Product UI Cleanup

**Date:** 2026-04-23 · **Status:** Accepted

**Context:** Inventory tracks at `familyId + colour + location` level so one physical frame colour shared across optical/sun products has unified stock. However, products not assigned to families (or missing colour on their family member) created orphan variant-level inventory rows with null family/colour — showing as "Unassigned 0 0 0" in the UI. Additionally, the families settings page had save-on-keystroke causing unusable text inputs, product mapping forced variant selection when product-level linking was the common case, and product cards were cluttered.

**Decision:** (1) Added `reconcileOrphanLevels()` to inventory-sync — runs after every Shopify sync, finds variant-level orphan rows, resolves through variant→product→familyMember, merges stock into canonical family+colour rows or converts in-place. (2) Families settings inputs changed to save-on-blur instead of save-on-keystroke, with local-only state during editing. (3) Removed `convertible_to_optical/sun` checkboxes — redundant with the type dropdown since inventory is frame-level. (4) Added missing-colour warnings (amber badges + input highlights) in families settings. (5) Product mapping picker defaults to product-level selection, no forced variant step. (6) Simplified product cards: title + stock count, status badges, stock bar. Removed variant names, price, sold count. (7) Added colour/type sort dropdown to families views. (8) Unified All/Shopify/Square filter pills across families pages.

**Consequences:** Orphan inventory rows auto-clean on sync. Family colour gaps are visually surfaced. Text editing in families settings is responsive. Product mapping workflow is faster. Product grid is scannable.

---

### ADR-013: Locations Full CRUD + Non-Destructive Sync

**Date:** 2026-04-23 · **Status:** Accepted

**Context:** Locations settings only supported editing and syncing. Sync from Shopify+Square overwrote all fields (`name`, `shopifyLocationId`, `squareLocationId`, `address`, `active`) on every run, destroying manual edits and channel connections. No way to add or delete locations manually.

**Decision:** (1) Added POST (create) and DELETE endpoints to `/api/crm/settings/locations`. POST generates `loc_` prefixed slug IDs matching the sync convention, checks for duplicates. (2) Rewrote sync to be non-destructive: existing locations matched by channel ID only get `address` and `syncedAt` updated — `name`, channel connections, `locationType`, `timezone`, `fulfillsOnline`, `active` are preserved. Only truly new locations are inserted. Removed automatic fuzzy name-matching between Shopify and Square — channel linking is now a manual choice via the UI picker. (3) Added "Add Location" form and "Delete" button to LocationsClient.

**Consequences:** Staff can manually manage locations without sync overwriting their work. Channel connections are stable. New Shopify/Square locations still auto-import on sync. Emoji icons replaced with inline SVGs matching CRM icon system.

---

### ADR-012: CRM Permission Guards — Redirect, Sidebar Filtering, UI Gating

**Date:** 2026-04-23 · **Status:** Accepted

**Context:** `requirePermission()` threw errors on 403, which Next.js strips in production Server Components — read_only users saw "Something went wrong" instead of a permission message. Sidebar showed all nav items regardless of role. Write-action buttons (New Client, New Segment, etc.) were visible to read-only users.

**Decision:** Three-layer fix: (1) `requirePermission()` now uses `redirect('/crm/denied')` instead of throwing for 403s — clean UX in production. `requireCrmAuth()` still throws for API routes (caught by `handler()`). (2) Sidebar nav items carry an optional `permission` field; items are filtered client-side via `hasPermission(role, permission)`. (3) Write-action buttons (New Client, Duplicates, New Intake, New Segment, AI tools, Settings tab) are conditionally rendered based on role permissions using `usePermission()` hook or server-side `hasPermission()`.

**Consequences:** read_only users see a clean "Forbidden" page instead of a crash. Sidebar only shows accessible sections. Write buttons are hidden for read-only roles. API layer remains the final guard — even if UI is bypassed, `requireCrmAuth('org:...')` blocks unauthorized writes.

---

### ADR-011: Canonical Frame-Level Inventory

**Date:** 2026-04-23 · **Status:** Accepted

**Context:** Lunettiq sells the same physical frame as both optical and sun configurations. Shopify has separate variants, Square has separate catalog items. Tracking inventory at variant level causes double-counting and false stockouts.

**Decision:** Inventory tracks at `family + colour + location` level — the physical frame. `inventory_levels` table uses `familyId + colour + locationId` as the canonical key. All Shopify variants and Square items for the same frame project from the same stock pool. Non-family products fall back to variant-level tracking. Lunettiq Postgres is the inventory master; Shopify and Square are projections updated via `projectToChannels()`.

**Consequences:** Selling any variant (optical or sun) decrements the same pool. All channel projections update on every change. Requires family membership to be accurate. Products not in families track independently at variant level.

---

### ADR-010: Extended Choice Types — Product, Content, Lens Colour

**Date:** 2026-04-22 · **Status:** Accepted

**Context:** The configurator needs add-on products, content displays, and lens colour pickers. Initially modelled as group types, but this prevented mixing types within a group and conflated display with data concerns.

**Decision:** Refactored to **choice types** on `cfg_choices`: `standard`, `product`, `colour`, `content`. Each choice defines its own behaviour — a single group can mix all types. Colour choices link to shared `lens_colour_sets` via `lensColourSetId`. Product choices link to Shopify via `shopifyProductId`. Prices: standard from `cfg_price_rules`, colour from `lens_colour_options.price`, product from Shopify. `groupType` removed from `step_choice_groups`.

**Consequences:** More flexible — "Lens Finish" group can have standard "Clear" + colour "Custom Tint" + content "What's included" together. Colour palettes managed centrally in Settings → Lens Colours. Flow builder has CMS-style inline add bar with 4 type options. Preview renders per-choice-type with swatch expander for colours.

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
