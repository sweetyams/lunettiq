# Lunettiq Inventory Operations Spec

**Scope:** Per-location stock management, protected stock, sync direction, CRM capabilities.
**Builds on:** ADR-011 (canonical frame-level inventory), ADR-014 (orphan reconciliation), ADR-013 (locations CRUD), `inventory.md` data model.
**Status:** Specification for remaining work in the `inventory.md` Implementation Status table.

---

## TL;DR

Lunettiq Postgres is the inventory master. Shopify and Square are projections. Stock lives at `family + colour + location`. Locations are flexibly typed: each can attach a Square ID, a Shopify ID, both, or neither. Locations with `fulfills_online = true` feed Shopify. Sync is bidirectional but asymmetric: webhooks pull events from channels, projection pushes available counts back. Five protection mechanisms compose without conflict: security stock, online reserve, holds, last-unit lock, discontinued.

---

## 1. Location model: flexible channel attachment

A location in the CRM is a logical inventory container. It can be a warehouse, a store, or both at once. The CRM doesn't care about the physical type. It cares about what channels the location feeds.

### Schema

The existing `locations` table has `shopifyLocationId` and `squareLocationId` per ADR-013. Add three flags to make the role explicit:

```
locations
  id, name, address, timezone (existing)
  shopify_location_id     text nullable    -- attach to project to Shopify
  square_location_id      text nullable    -- attach to project to Square
  fulfills_online         boolean          -- ships Shopify orders
  is_retail               boolean          -- walk-in sales happen here
  online_reserve_buffer   integer default 2  -- per-location, see §3.2
  active                  boolean
```

### Valid configurations

| Type | `fulfills_online` | `is_retail` | `shopify_location_id` | `square_location_id` |
|---|---|---|---|---|
| Warehouse (today's setup) | ✓ | | ✓ | |
| Store, no online fulfillment | | ✓ | | ✓ |
| Store that also ships online | ✓ | ✓ | ✓ | ✓ |
| Display-only / event pop-up | | ✓ | | ✓ |
| Pure storage (no sales, no shipping) | | | | |

The combination of `fulfills_online` and channel IDs defines projection behaviour. No special-casing of "warehouse" vs "store" anywhere in the projection logic. The flags say it all.

### Projection rules by location type

- **`fulfills_online = true`:** Location's `available` (after its own `online_reserve_buffer`) is added to the Shopify projection.
- **`square_location_id` set:** Location's `available` projects to that Square location.
- **Neither flag and no channel IDs:** Location holds stock but never projects. Useful for receiving buffers, transit holding, write-off staging.

### Multi-fulfillment math

When more than one location has `fulfills_online = true`, Shopify gets the **sum** of their post-buffer available counts, projected to Shopify's primary fulfillment location. Each fulfilling location applies its own buffer first.

```
shopify_available = sum(
  max(0, location.available - location.online_reserve_buffer)
  for location in fulfilling_locations
)
```

A location at 1 unit with a 2-unit buffer contributes 0, not -1.

**Why sum, not separate:** Shopify only sees one online stock number per variant. The CRM's job is to decide which physical location ships the order, not Shopify's. Order routing happens post-purchase based on stock-on-hand at fulfilling locations.

### Order routing for online orders

When a Shopify order webhook fires, route the commit to a single fulfilling location:

1. Among locations with `fulfills_online = true` and enough `available`, pick the one matching the routing rule.
2. Default rule: location with highest `available` for that frame. Tie-break: location designated `default_fulfillment_location` in settings.
3. Commit there: `committed += qty` at that location only.
4. Future: rule could be "closest to shipping address" or "lowest stock first to drain warehouse before flagship store." Defer.

If no single location has enough on its own but the sum does, route to the highest-stock location and create an internal transfer for the shortfall. Flag for manager review.

---

## 2. Three buckets per location, not one

The current `inventory_levels` schema has `on_hand`, `committed`, `security_stock`. That's enough math but it hides the operational reality. Staff at Plateau need to think about three things, not three columns:

| Bucket | What it is | Who decreases it |
|---|---|---|
| **Floor** | Units a sales associate can sell to a walk-in right now | Square POS sale, in-store fitting that becomes a sale |
| **Online reserve** | Units physically at the location, earmarked for Shopify orders | Shopify order (commits), Shopify fulfillment (decrements on hand) |
| **Protected** | Units held back from any channel | Manager action only |

**Available to a channel** = `on_hand - committed - protected`, where "protected" is the sum of every protection rule that applies to that channel.

The schema doesn't need three new columns. It needs `protected` to be a computed roll-up of distinct protection records, so each protection has a reason, owner, and expiry.

### New table: `inventory_protections`

```
inventory_protections
  id               uuid PK
  family_id        text
  colour           text
  location_id      text
  quantity         integer        -- units protected
  scope            enum           -- 'all_channels' | 'online_only' | 'square_only'
  reason           enum           -- 'display', 'try_on_hold', 'rx_in_progress',
                                  --  'transfer_pending', 'last_unit_lock',
                                  --  'damage_review', 'manager_hold'
  reference_id     text nullable  -- appointment_id, transfer_id, work_order_id
  reference_type   text nullable
  expires_at       timestamp nullable
  staff_id         text
  note             text
  created_at       timestamp
  released_at      timestamp nullable
```

`available` becomes:
```
available = on_hand - committed - sum(active protections matching this channel scope)
```

`security_stock` on `inventory_levels` stays as the floor-level baseline (the "always keep N units" rule). Protections are time-bound or event-bound holds on top.

**Why this matters:** Without this split, "protected stock" is one opaque number nobody can audit. With it, you can answer "why can't I sell the last Astaire Pink at DIX30?" with "Maya put a 48h hold on it for Sara Chen's Tuesday fitting."

---

## 3. Protection mechanisms: five rules that compose

These all reduce `available`. They're additive but never duplicate-counted. The protection table makes that explicit.

### 3.1 Security stock (floor baseline)
- Already in schema as `security_stock` on `inventory_levels`.
- Per-location, optionally per-frame override, with a global default in settings.
- Rule of thumb: 1-2 units for healthy stock, 1 for scarce, 0 for end-of-run.
- Applies to all channels.

### 3.2 Online reserve buffer (per fulfilling location)
- Buffer applied at each location with `fulfills_online = true`. Each fulfilling location has its own `online_reserve_buffer` value on the `locations` row.
- Default: 2. Set per location in settings; override per frame via `inventory_levels.online_reserve_buffer_override` (null = use location default).
- **Why per-location, not central:** Each fulfilling location has its own walk-in pace and its own race window. A flagship store with heavy in-person traffic needs a bigger buffer than a quiet warehouse. A single central buffer either over-protects the warehouse or under-protects the store.
- **Math (recap from §1):** Each location subtracts its own buffer from its `available` before contributing to the Shopify projection. Locations contributing zero or negative are excluded.
- Implemented as a column on `locations` (and optional override on `inventory_levels`), not a row in `inventory_protections`. It's a continuous policy, not a discrete hold.

### 3.3 Try-on / appointment holds (event-bound)
- A row in `inventory_protections` with `reason = 'try_on_hold'`, `expires_at = appointment_time + 4h`.
- Created when staff books a fitting that names a specific frame.
- Auto-released on expiry via Inngest cron.
- Scope: `all_channels`. Both Square and Shopify see the unit as unavailable.

### 3.4 Last-unit lock (per-family policy)
- Each `product_family` has a `last_unit_protected` boolean. Default: `true` for families flagged `limited_run = true`, `false` otherwise.
- When `available` across all locations would drop to 1, the system creates a `last_unit_lock` protection on the location holding it. That unit becomes manager-override-only.
- Setting is editable on the family detail page in CRM. Owner can change the global default in settings.
- **Why per-family with default:** Most limited runs deserve protection. Some don't (a fast-moving accessory, a discontinued line you want to clear). The buyer makes the call at family creation; ops can override later. Avoids forcing a manager override on every routine sellout.

### 3.5 Discontinued flag
- Already in schema. Hard kill: no projections, no purchasability, but stays visible for storytelling per the brand decision in the original spec.

---

## 4. Sync direction: what flows where

The current implementation is mostly there. Naming it explicitly so it can't drift.

### 4.1 Inbound to Lunettiq (webhook-driven, source of truth recalculated)

| Event | Source | Effect on `inventory_levels` |
|---|---|---|
| `orders/create` | Shopify | `committed += qty` at routed fulfilling location (see §1) |
| `orders/fulfilled` | Shopify | `on_hand -= qty`, `committed -= qty` |
| `orders/cancelled` | Shopify | `committed -= qty` |
| `orders/refunded` | Shopify | If item restocked: `on_hand += qty`. If not: log only. |
| `order.completed` | Square | `on_hand -= qty` at sale location |
| `refund.created` | Square | `on_hand += qty` (with sellable inspection flag, see §7) |
| `inventory.count.updated` | Square | Reconciliation only. Log discrepancy, don't auto-overwrite. |

Webhooks land in Inngest, resolve `variantId` to `familyId + colour`, write `inventory_adjustments`, recompute `available`, then call `projectToChannels()`.

### 4.2 Outbound from Lunettiq (projection-driven, channels are dumb mirrors)

After every adjustment, `projectToChannels(familyId, colour)` runs:

1. Compute `available` per location.
2. **Shopify:** Sum post-buffer `available` across all locations with `fulfills_online = true` (per §1 multi-fulfillment math). Push that sum to every variant of every product in that family+colour, at Shopify's primary fulfillment location.
3. **Square:** For each location with a `square_location_id`, push that location's `available` to the matching Square catalog item at the matching Square location.

**Critical:** Shopify and Square are never queried for stock by the storefront or POS. They display what Lunettiq told them. If a webhook fails and Lunettiq goes stale, the channel goes stale with it. Drift is detected by the nightly reconciliation job (§6), not by trusting the channel.

### 4.3 What never syncs back

- Manual stock edits in Shopify admin: ignored. Reconciliation will overwrite them and log a discrepancy. UI in Shopify admin should be marked read-only via app settings where possible, or staff trained not to use it.
- Square manual count adjustments: same. Use the CRM.
- Channel-side product creation: blocked. Products start in CRM and project outward.

This is the "no two masters" rule from the original spec, made concrete.

---

## 5. CRM capabilities: what staff actually need to do

Current implementation has product detail inventory section, stock dots, family colour grid (partial), and a sync action. Here's what's missing, organized by user job.

### 5.1 Receiving stock (manager, daily)

**Page:** `/crm/inventory/receive`
**Permission:** `org:inventory:receive` (manager, owner)

Flow:
1. Scan or pick frame (family + colour).
2. Enter quantity, location, supplier reference (optional).
3. Optionally split across locations in one entry (e.g. "10 to Plateau, 5 to DIX30, 5 to Warehouse").
4. Submit. Each split writes one `inventory_adjustments` row with `reason = 'received'` and the same `reference_id`.

**Why batched UI:** Drops arrive as one box. Splitting in the UI matches the physical reality and avoids three separate trips through the form.

### 5.2 Recounts (manager, weekly/monthly)

**Page:** `/crm/inventory/recount`
**Permission:** `org:inventory:recount`

Two modes:
- **Single frame recount:** Pick frame, pick location, enter actual count. System logs the delta with `reason = 'recount'`.
- **Cycle count:** Pick a list (top sellers, scarce frames, by family). System generates a checklist. Staff enters counts. On submit, each delta is logged separately.

**Sign-off:** Recounts with delta > 5 units or > 20% require manager approval before they post. Otherwise auto-posted.

### 5.3 Holds and protections (sales associate, ad hoc)

**Where:** Inline on product detail page, on appointment page, on client page.
**Permission:** `org:inventory:hold` (sales associate and up)

Three entry points:
- **From product:** "Hold 1 unit for [client]" with default 48h expiry. Creates `inventory_protections` with `reason = 'try_on_hold'`.
- **From appointment booking:** When staff names frames in an appointment, holds are created automatically until `appointment_time + 4h`.
- **From client page:** "Reserve [frame] for next visit." Same mechanism, longer default expiry (7d), requires manager approval beyond 7d.

**UI list:** `/crm/inventory/holds` shows all active protections, expiry, owner, reason. Manager can release any. Staff can release their own.

### 5.4 Transfers between locations (manager, weekly)

**Page:** `/crm/inventory/transfers`
**Permission:** `org:inventory:transfer_create` (manager), `org:inventory:transfer_receive` (sales associate at destination)

Workflow per the original spec, minimum viable:
1. **Request:** Origin manager creates transfer (frame, qty, destination, reason).
2. **Pick:** Origin marks "picked." `on_hand_origin -= qty`, `pending_transfer_out += qty`.
3. **Ship:** Optional handoff confirmation.
4. **Receive:** Destination marks "received." `pending_transfer_out -= qty` at origin, `on_hand_destination += qty`.
5. **Discrepancy:** If received qty ≠ shipped qty, log reason. Triggers manager review.

**Schema:**
```
inventory_transfers
  id, family_id, colour, quantity_requested, quantity_shipped,
  quantity_received, origin_location_id, destination_location_id,
  status (requested|picked|shipped|received|discrepancy|cancelled),
  requested_by, picked_by, received_by,
  requested_at, picked_at, received_at, notes
```

`pending_transfer_out` and `pending_transfer_in` become computed columns or sum-by-status queries on `inventory_transfers`. Don't add them to `inventory_levels`. They belong to the transfer record.

### 5.5 Damage / loss adjustments (manager)

**Where:** Product detail "Adjust" button, with reason picker.
**Permission:** `org:inventory:adjust_damage`

Reasons map to existing `inventory_adjustments.reason` enum: `damage`, `loss`. Required note. Manager-only. Optional photo upload (uploads to existing media store, attach to adjustment row).

### 5.6 Locations admin (owner)

**Page:** `/crm/settings/locations` (already exists per ADR-013, extend it)
**Permission:** `org:inventory:settings`

Per location:
- Name, address, timezone (existing).
- Channel attachments: Shopify location ID picker, Square location ID picker (existing).
- Type flags: `fulfills_online`, `is_retail` (new, drives projection behaviour).
- `online_reserve_buffer` (new, only editable when `fulfills_online = true`).
- Default security stock for this location (new).

The decision tree is implicit: check the boxes that match what this location does. The system figures out the rest.

### 5.7 Settings: global controls

**Page:** `/crm/settings/inventory`
**Permission:** `org:inventory:settings` (owner only)

Fields:
- Default security stock (global default; locations can override).
- Default online reserve buffer (global default; per-location override on locations page).
- Low stock threshold (default 3).
- Default fulfillment routing rule (`highest_stock` | `default_location` | future: `closest_to_address`).
- Default fulfillment location (used for tie-breaks and as primary Shopify projection target).
- Last-unit protection global default (`on for limited_run families` | `on for all` | `off`).
- Recount auto-post threshold (default 5 units / 20%).
- Hold default expiry (try-on: 48h, reservation: 7d, max without approval: 14d).

### 5.8 Inventory dashboard (manager, daily glance)

**Page:** `/crm/inventory` (already exists, needs filling out)

Three sections:
- **Action queue:** Failed syncs, transfers awaiting receipt, holds expiring in 24h, recount discrepancies pending review, low-stock items.
- **Stock state:** Total units on hand, by location, by lifecycle (active/low/out/discontinued). Trend vs last 30d.
- **Recent activity:** Last 50 `inventory_adjustments` with link to drill in.

This replaces the current sparse inventory page.

---

## 6. Reconciliation: drift detection without trust

Webhooks fail. Sometimes Square's order endpoint is delayed. Reconciliation is the safety net.

### Nightly job (Inngest cron, 3am ET)

For every `family_id + colour + location_id`:
1. Pull current Shopify `available` for every projected variant.
2. Pull current Square `quantity` for every projected catalog item at every linked Square location.
3. Compare to what Lunettiq's `projectToChannels()` would push right now.
4. If channel value ≠ Lunettiq value: log to `sync_discrepancies` table, push the Lunettiq value (Lunettiq wins), notify owner if delta > 1 unit.

**Schema:**
```
sync_discrepancies
  id, family_id, colour, location_id, channel (shopify|square),
  channel_value, lunettiq_value, delta, resolved (boolean),
  resolution (auto_overwritten|manual_review|ignored),
  detected_at, resolved_at
```

### Why not real-time reconciliation
The projection function already handles real-time. Reconciliation catches what slipped through. Running it nightly is enough for a finite-run business; running it hourly is overkill until volume justifies it.

---

## 7. Returns: sellable vs not

Current schema doesn't model the inspection step. Return events from Shopify and Square land as inventory increments today (or are ignored, depending on the channel's restock setting). That's wrong for limited-run goods where condition matters.

### Flow

1. Return webhook fires (`refunds/create` from Shopify, `refund.created` from Square).
2. **Don't increment `on_hand` yet.** Create a `pending_return_inspection` record with `reason = 'awaiting_inspection'`, route to `/crm/inventory/returns`.
3. Manager inspects, marks one of:
   - `sellable`: `on_hand += 1` at receiving location, project.
   - `damaged`: `on_hand += 0`, log to damage register, write off.
   - `refurbish`: goes to a "refurbishment" virtual location, not sellable.
4. Audit row written.

**Schema:**
```
return_inspections
  id, shopify_refund_id nullable, square_refund_id nullable,
  family_id, colour, location_id,
  status (awaiting|sellable|damaged|refurbish|written_off),
  inspected_by, inspected_at, notes, photo_url
```

This also feeds the Returns Analysis block in the Product Canvas roadmap.

---

## 8. Permissions matrix

Adds to existing Clerk permissions per `lunettiq-clerk-permissions.md`:

| Permission | Owner | Manager | Optician | Sales Associate | Read-Only |
|---|---|---|---|---|---|
| `org:inventory:read` | ✓ | ✓ | ✓ | ✓ (own location) | ✓ |
| `org:inventory:hold` | ✓ | ✓ | ✓ | ✓ | |
| `org:inventory:hold_release_any` | ✓ | ✓ | | | |
| `org:inventory:receive` | ✓ | ✓ | | | |
| `org:inventory:recount` | ✓ | ✓ | | | |
| `org:inventory:adjust_damage` | ✓ | ✓ | | | |
| `org:inventory:transfer_create` | ✓ | ✓ | | | |
| `org:inventory:transfer_receive` | ✓ | ✓ | | ✓ (own location) | |
| `org:inventory:override_last_unit` | ✓ | ✓ | | | |
| `org:inventory:settings` | ✓ | | | | |
| `org:inventory:reconcile_force` | ✓ | | | | |

Sales associate access is location-scoped via `publicMetadata.location_ids` on the Clerk membership, per the existing pattern.

---

## 9. What this means for the build

Mapped to the current Implementation Status table in `inventory.md`:

**Already done (don't redo):**
- Schema for `inventory_levels`, `inventory_adjustments`.
- Core service, sync pull from Shopify, basic API, product detail UI, stock dots, sidebar.
- Orphan reconciliation (ADR-014).
- Locations CRUD with Shopify/Square attachment (ADR-013).

**This spec adds:**

| Item | Priority | Why now |
|---|---|---|
| Location flags: `fulfills_online`, `is_retail`, `online_reserve_buffer` | P1 | Foundation for all projection logic; unlocks future store-as-fulfillment without schema rework |
| Multi-location Shopify projection (sum across `fulfills_online`) | P1 | Even at one warehouse today, getting the math right now means zero migration when a store starts fulfilling |
| Order routing logic for `orders/create` webhook | P1 | Decides which location's `committed` increases per order |
| `inventory_protections` table + service | P1 | Unblocks holds, last-unit logic, accurate `available` math |
| Push to Shopify (`inventorySetQuantities`) | P1 | Shopify going stale is the biggest customer-facing risk |
| Webhook handlers (Shopify + Square orders) | P1 | Real-time correctness depends on this |
| Square inventory write module | P1 | Same, for in-store |
| `last_unit_protected` flag on `product_families` + auto-lock logic | P2 | Per-family default with global override |
| Holds UI (product detail + appointment + client page) | P2 | Once protections table exists, UI is small |
| Receiving page | P2 | Currently no clean way to log a delivery |
| Transfers feature (`inventory_transfers` + UI) | P2 | Two-location ops blocker |
| Settings → Inventory page | P2 | Already on remaining-work list |
| Locations page extensions (type flags, reserve buffer field) | P2 | Small extension to existing page |
| Returns inspection flow | P3 | Important for limited runs but lower volume than sales |
| Reconciliation cron + `sync_discrepancies` table | P3 | Safety net, can ship after webhooks are solid |
| Recount UI with manager sign-off | P3 | Manual recounts work via existing adjust API meanwhile |
| Inventory dashboard fill-out | P3 | Existing page works, just sparse |

**Out of scope here, deferred:**
- Demand forecasting.
- Serialized tracking.
- Recoverable starter-lens inventory (the original spec recommends not tracking these; keep it that way).
- Channel-specific launch gating.
- Automated low-stock email alerts (low-stock visibility in dashboard is enough for V1).
- Distance-based or address-based order routing (simple "highest stock" rule covers V1).

---

## 10. Resolved decisions

The three open questions from the previous draft, now closed.

1. **Locations are flexible, not typed.**
   A location is whatever you flag it as. `fulfills_online` and `is_retail` are independent booleans. Today: one warehouse with `fulfills_online = true, is_retail = false`. Tomorrow: a store flips on `fulfills_online` and the projection logic picks it up automatically. No schema migration, no special-casing of "warehouse" anywhere. The CRM already supports per-location Shopify and Square attachment per ADR-013, so extending that with intent flags is a small step.

2. **Online reserve buffer lives on each fulfilling location.**
   `online_reserve_buffer` is a column on `locations` (default 2). When multiple locations have `fulfills_online = true`, each subtracts its own buffer before contributing to the Shopify projection. The math: `shopify_available = sum(max(0, location.available - location.online_reserve_buffer))` across fulfilling locations. Optional per-frame override on `inventory_levels` for cases where a specific limited-run piece needs a different buffer at a specific location.

3. **Last-unit lock is per-family with a smart default.**
   `last_unit_protected` boolean on `product_families`. Default: `true` for families with `limited_run = true`, `false` otherwise. Editable on the family detail page. Owner sets the global default rule in settings. When a family's last unit is about to commit, the system creates a `last_unit_lock` protection on the location holding it, and a manager has to override to release. Buyer makes the call at launch; ops can adjust later.
