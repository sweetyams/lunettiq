# Lunettiq Inventory Spec

## Goal
Design an inventory model and operating workflow for Lunettiq across:
- Store 1
- Store 2
- Shopify online store
- Shipping currently fulfilled from one store

This spec is designed for Lunettiq’s specific inventory reality:
- products are made in limited runs
- a frame can often be sold as sun as-is or converted into optical by removing the default lens and adding a custom lens
- inventory should not be distorted by treating the same physical frame as two different stock pools

---

## 1. Core recommendation

### Recommendation in one sentence
Track **inventory at the frame-container level**, not at the finished sun/optical level.

That means:
- `ASTAIRE / Pink` is the real stockable unit
- `ASTAIRE / Pink / Sun` and `ASTAIRE / Pink / Optical` are **sellable configurations**, not separate physical inventory pools

This is the single most important modelling decision.

If Lunettiq keeps separate inventory for:
- Astaire Sun Pink
- Astaire Optical Pink

then the business will almost certainly create false stockouts, double counting, manual reconciliations, and bad transfer logic.

---

## 2. Physical inventory model

## Canonical stock unit
Use one canonical inventory unit per physical frame colour.

Example:
- `ASTAIRE-PINK`
- `ASTAIRE-BLUE`
- `ASTAIRE-BLACK`

These are the real stock pools.

### Why
Because each physical unit is really:
- a frame
- with a starter/default lens inserted
- which may later be sold as sun
- or converted to optical

So the frame is the scarce asset.
The lens configuration is a sellable outcome.

---

## 3. Product model

## Recommended structure

### Product Family
Example:
- ASTAIRE
- HATLEY
- ANDY

### Colour
Example:
- Pink
- Blue
- Black

### Base stock SKU (inventory-bearing)
Example:
- `ASTAIRE-PINK`
- `ASTAIRE-BLUE`
- `ASTAIRE-BLACK`

### Sellable configuration
Example:
- Sun
- Optical

### Channel-facing sellable SKUs
These may still exist for merchandising and order entry, but they should map back to the same inventory pool.

Examples:
- `ASTAIRE-PINK-SUN`
- `ASTAIRE-PINK-OPTICAL`

But both consume from:
- `ASTAIRE-PINK`

## Required attribute set
For each family/colour, track:
- family
- colour
- canonical frame SKU
- barcode
- default lens type
- default lens colour
- convertible to optical: yes/no
- convertible to sun custom: yes/no
- active channels: Shopify, Square Store 1, Square Store 2
- lifecycle status: active / archived / sold out forever
- limited run quantity
- replenishable: yes/no
- discontinue at zero: yes/no

---

## 4. Limited-run logic

Because Lunettiq often runs products as finite drops, inventory rules should assume:
- once the run is sold out, it is sold out
- no automatic restock assumptions
- no backorders unless explicitly allowed

## Rules
- default status should be `discontinue at zero = yes`
- default online oversell/backorder should be disabled
- once total available across all locations reaches zero, the item becomes sold out
- sold out variants should remain visible on the storefront if desired for brand/storytelling, but not purchasable

## Optional lifecycle states
Use:
- `Coming Soon`
- `Active`
- `Low Stock`
- `Sold Out`
- `Archived`

---

## 5. Where data should live

## Recommended architecture
Lunettiq should have **one canonical inventory service / data model** outside of Square and Shopify.

This can live in:
- Lunettiq CRM / admin system
- or a lightweight inventory service backed by Postgres

### Why this is recommended
Neither Shopify nor Square is a great canonical home for Lunettiq’s unique inventory logic because:
- the same physical unit may be sold through multiple sellable outcomes
- one stock pool may need to feed both Sun and Optical paths
- security stock may differ by channel and location
- finite-run business rules matter more than standard replenishment logic

## Canonical data lives in Lunettiq inventory service
It should own:
- canonical frame SKU
- family/colour relationships
- total stock by location
- reserved stock
- security stock
- sellable stock by channel
- alias mapping from sellable SKUs to frame SKU
- conversion rules (Sun -> Optical possible)
- sold-out lifecycle status
- audit log of every adjustment

## Shopify stores
Shopify should store:
- product and merchandising data needed for online selling
- online sellable variants
- location inventory projections pushed from Lunettiq inventory service
- order records and fulfillment records

## Square stores
Square should store:
- POS-visible items for each store
- store-specific sellable availability pushed from Lunettiq inventory service
- in-store sales transactions
- local receiving / transfer execution if required

---

## 6. System-of-record recommendation

## Inventory truth
The inventory truth should be:
- **Lunettiq inventory service / CRM**

## Channel systems
- Shopify = ecommerce channel + order capture + fulfillment workflow
- Square = in-store POS + local retail operations

## Why not two masters
Do not let both Shopify and Square act as independent inventory masters.

That creates:
- race conditions
- manual corrections
- uncertainty about which count is correct
- overselling risk
- poor auditability

---

## 7. Location model

Use 3 logical inventory locations in the canonical model:
- `STORE_1`
- `STORE_2`
- `ONLINE_SHIP_STORE`

If shipping currently happens from one of the stores, there are two ways to model it.

## Preferred approach
Model the shipping store as both:
- a retail location
- and the online fulfillment location

But inside the inventory logic, maintain separate buckets:
- floor stock
- online reserved/sellable stock
- backroom stock

This avoids promising online units that staff need for walk-in selling.

## Alternative approach
Create a virtual online bucket attached to the shipping store.

Example:
- Store 1 physical on hand: 80
- of that, 20 reserved for online
- retail floor sellable: 60
- online sellable: 20

This is often the cleanest operational approach even if physically all stock sits in one place.

---

## 8. Sellable quantity formula

For each canonical frame SKU at each location:

`Sellable = On hand - Reserved - Security stock - Pending transfer out`

Then apply channel rules.

Example:
- ASTAIRE-PINK at Store 1 on hand: 100
- reserved for open orders: 8
- security stock: 5
- pending transfer out: 10

Sellable at Store 1 = 77

If online draws only from Store 1 and has an extra online buffer of 12:
- Shopify available = 65

---

## 9. Security stock policy

Security stock is essential because Lunettiq is a finite-run business and because online shipping comes from a physical store.

## Recommended rule set

### Store-level security stock
Maintain a minimum physical safety buffer at each location.

Use this to protect against:
- stock count errors
- damaged units
- demo/display usage
- items pulled for fittings or repairs
- staff selling the last piece before sync completes

### Channel security stock
Maintain an online-specific buffer at the shipping location.

Use this to protect against:
- oversell from near-simultaneous in-store and online sales
- delays in sync
- units needed for quality checks before shipping

## Suggested starting thresholds

### For normal frame colours with healthy stock
- store security stock: 1-2 units per location
- online channel buffer: 1-3 units per canonical frame SKU

### For scarce / hot / limited-run frames
- store security stock: 1 unit
- online channel buffer: 0-1 unit depending on appetite for risk
- or move final units to one exclusive channel intentionally

### For display-only last unit policy
If the last unit should remain available for fitting/display until management decides otherwise:
- security stock = 1
- final sell-through requires manual override

## Important
Security stock should be configurable by:
- frame SKU
- location
- channel

Not one universal setting.

---

## 10. How Sun and Optical should work operationally

## Key rule
Sun and Optical should not each decrement separate physical stock.

Instead:
- selling `ASTAIRE Pink Sun` consumes one unit of `ASTAIRE-PINK`
- selling `ASTAIRE Pink Optical` also consumes one unit of `ASTAIRE-PINK`

## Lens handling
Treat the starter lens as part of the frame-container unless Lunettiq decides to separately recover and reuse removed lenses.

### Recommended default
Do **not** track the removed starter lens as reusable inventory at first.

Reason:
- extra operational complexity
- likely low commercial value compared with frames and Rx lenses
- high risk of bad data hygiene

## Instead track custom lenses separately
Rx/custom lenses should be handled as:
- made-to-order components
- work-order materials
- or non-stock / separately stocked consumables depending on lab process

Meaning:
- frame inventory tracks the scarce finished frame unit
- lens workflow tracks service/manufacturing

---

## 11. Catalog structure in Shopify and Square

## Canonical logic
One physical frame pool, many sellable experiences.

## Shopify recommendation
On Shopify, customers can still browse products by:
- family
- colour
- sun vs optical path

But inventory should be mapped back to the canonical frame SKU.

### Recommended ecommerce presentation
Option A:
- one product per family/colour
- lens type chosen in product flow

Option B:
- separate sun and optical PDP entry points for merchandising
- both reference the same underlying canonical frame inventory

Option B is often better for UX and SEO, but it requires the sync layer to keep both paths pointed at the same inventory pool.

## Square recommendation
In Square POS, staff should not pick from separate stock items if they consume the same physical unit.

Instead, the POS should make staff choose:
1. frame family/colour
2. sale type: sun as-is / optical conversion
3. lens package or Rx workflow

The stock decrement should happen once at the canonical frame SKU.

---

## 12. Sync design

## High-level design
Use event-driven sync with the canonical inventory service in the middle.

### Data flow
1. Product/catalog master data is created in Lunettiq admin
2. Canonical frame SKU is defined
3. Shopify products/variants are published from that model
4. Square items/variations are published from that model
5. Inventory counts by location live canonically in Lunettiq inventory service
6. Sellable quantities are projected into Shopify and Square
7. Orders and stock movements from Shopify and Square send events back to Lunettiq inventory service
8. Lunettiq recalculates sellable stock and republishes updated counts to both systems

## Events that must sync
- sale completed in Square
- order placed in Shopify
- order cancelled in Shopify
- order refunded / returned in Shopify
- sale refunded in Square
- stock received
- stock recounted
- damage / loss / theft adjustment
- transfer created
- transfer shipped
- transfer received
- product archived / sold out

---

## 13. Inventory states required in Lunettiq model

For each canonical frame SKU and location:
- on hand
- committed / reserved
- available to promise
- security stock
- pending transfer out
- pending transfer in
- damaged
- lost / stolen
- display-only hold
- sold out forever flag

This gives Lunettiq enough precision to operate cleanly.

---

## 14. Suggested sync rules

## Rule 1: online orders reserve immediately
When an order is placed on Shopify:
- reserve stock in the canonical inventory service immediately
- reduce sellable stock pushed to Shopify and Square as soon as possible

## Rule 2: Square sales decrement immediately
When an item is sold in-store in Square:
- decrement the canonical frame SKU immediately
- republish new sellable quantities to Shopify and the other store

## Rule 3: transfer out reduces origin availability immediately
When a transfer is created and approved:
- reduce available stock at origin
- mark units as pending transfer out
- do not increase destination sellable until received

## Rule 4: cancellation releases reservation
If an online order is cancelled before fulfillment:
- remove reservation
- republish availability

## Rule 5: fulfillment finalizes shipped unit
When online order is fulfilled:
- move from reserved to shipped/decremented final state
- maintain audit trail of which location shipped the item

## Rule 6: returns depend on condition
A returned item only becomes sellable again if inspection passes.

Use statuses:
- returned sellable
- returned damaged
- returned refurbishment needed

---

## 15. Shipping store policy

Because one store fulfills online orders, Lunettiq should explicitly decide which units are truly online-available.

## Recommended policy
Only one location should supply Shopify availability by default:
- the designated shipping store

This keeps online promise logic simple.

### Why
If both stores feed online inventory but only one normally ships, then staff may need emergency re-routing too often, which increases confusion and errors.

## Exception rule
Store 2 inventory can be made emergency-online-eligible only when:
- management enables it
- transfer is impossible or too slow
- specific high-value sale needs rescue

---

## 16. Transfers between stores

Transfers should be explicit and auditable.

## Transfer workflow
1. Request transfer
2. Approve transfer
3. Pick from origin
4. Ship / handoff
5. Receive at destination
6. Reconcile discrepancies

## Rules
- never manually decrement one location and increment another without a transfer record
- destination stock should not become sellable until physically received
- partial transfers must be allowed
- transfer discrepancy reasons should be logged

---

## 17. Returns and exchanges

## In-store return of online order
If a Shopify order is returned in-store:
- the item should be inspected
- if sellable, it should be assigned to the receiving location’s canonical frame stock
- then Lunettiq inventory service republishes counts

## Exchange scenario
If customer returns Sun and converts into Optical:
- return original frame condition must be inspected
- if same physical unit is retained and converted, do not create a fake return plus fake new stock addition
- treat it as one inventory unit continuing through a new sales/service workflow

---

## 18. Security and permissions

Because inventory is a high-risk business object, permissions should be strict.

## Roles

### Admin
Can:
- create/edit products
- create canonical SKUs
- adjust security stock rules
- approve transfers
- approve recounts
- override sell-through of protected last unit

### Store manager
Can:
- receive stock
- request transfers
- perform recounts
- approve returns to sellable stock
- mark damage/loss with reason

### Sales associate
Can:
- sell items
- start transfer requests
- mark order prep steps
- cannot directly edit stock counts without approval

### Ecommerce/operations lead
Can:
- manage Shopify availability rules
- open/close online selling on a SKU
- control sold-out visibility and launch status

## Audit requirements
Every stock change must store:
- timestamp
- user
- system source (Shopify / Square / admin)
- SKU
- location
- previous quantity
- new quantity
- reason code
- reference order / transfer / return / recount ID

---

## 19. Operational policies

## Daily
- review failed syncs
- review negative or zero anomalies
- review low-stock and sold-out items
- review online reserved but unfulfilled aging orders

## Weekly
- cycle count top sellers and scarce frames
- reconcile transfer discrepancies
- review security stock exceptions

## Monthly
- full recount by location for high-value families
- review dead stock and archival candidates
- review conversion rates: sun sold as-is vs converted to optical

---

## 20. Things to avoid

Do not:
- keep separate inventory pools for Sun and Optical if they use the same physical frame
- let Square and Shopify each be independent stock masters
- allow manual stock edits without reason codes
- expose all last units online automatically
- treat transfers as two manual edits instead of one tracked movement
- assume removed default lenses are worth tracking unless there is a real reuse process

---

## 21. Recommended MVP

If Lunettiq wants the simplest first version:

### MVP structure
- canonical inventory at frame family + colour level
- one shipping store feeds online stock
- Square Store 1 and Store 2 each keep local stock counts
- Sun/Optical treated as sale path, not stock path
- security stock configurable per SKU/location
- transfer workflow required between stores
- sold-out forever default enabled for limited runs

### MVP systems approach
- lightweight custom inventory table in Lunettiq CRM/Postgres
- Shopify and Square receive projected sellable counts
- all inventory movements logged centrally

This is enough to avoid the major data problems while staying practical.

---

## 22. Future enhancements

Later, Lunettiq could add:
- virtual online bucket per store
- demand forecasting by family/colour
- automated low-stock rules by sell-through velocity
- serialized tracking for rare/high-value pieces
- separate recoverable-lens tracking if operationally justified
- channel-specific launch gating
- hold inventory for try-on appointments or VIP clients

---

## 23. Final recommendation

Lunettiq should model inventory around the **physical frame unit**, not the merchandising label of Sun vs Optical.

### Final architecture
- canonical inventory lives in Lunettiq inventory service / CRM
- Shopify and Square are channel projections, not inventory masters
- inventory is tracked by family + colour + location
- Sun and Optical are sellable outcomes that consume the same frame pool
- online inventory should normally draw only from the designated shipping store
- security stock should protect last units, scarce runs, and sync timing risk

That structure best matches:
- limited-run drops
- multi-location retail
- one-store online fulfillment
- frame conversion from sun to optical
- clean auditability and lower oversell risk

