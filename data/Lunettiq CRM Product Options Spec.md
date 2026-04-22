# Lunettiq — CRM Product Options, Add-ons, and Step Management Spec

## Purpose

This document defines the **CRM-side source of truth** for Lunettiq’s configurable eyewear offer.

It is not a frontend spec and it is not a Shopify catalogue spec.

Its purpose is to define:

- what the CRM must treat as a product option versus an add-on versus a package
- how those choices are grouped
- what is mutually exclusive
- what is optional
- what is deferred until later
- how prices attach to those choices
- how the frontend should retrieve step definitions from the CRM
- how orders should store a clean configuration snapshot

This document assumes:

- Shopify handles catalogue products, inventory, payment, and final order objects
- the CRM is fully custom and can manage any bespoke logic
- Rx is **not** required as part of the primary choice model
- Rx can be provided later at cart, account, or post-purchase follow-up
- the CRM must therefore support a valid non-Rx configuration state and a later Rx-validation layer

---

# 1. Core modelling principle

The CRM should **not** model everything as a flat list of “add-ons.”

That creates ambiguity between:
- primary lens type choices
- thickness/material decisions
- finish/look states
- optional enhancements
- order-level charges
- future service-package flows like reglaze

Instead, the CRM should model Lunettiq’s offer using a **layered commercial structure**.

---

# 2. The required CRM option layers

The CRM should organize all sellable logic into these layers:

## Layer 1 — Channel context
This determines the commercial branch.

Allowed values:
- `optical`
- `sun`
- `reglaze`

This is not customer-facing as an add-on. It is the root context.

## Layer 2 — Lens path
This is the primary pair/package choice. Exactly one should be active.

Examples:
- `single_vision`
- `progressive_premium`
- `computer_degressive`
- `super_progressive`
- `anti_fatigue`
- `non_prescription_clear`
- `non_prescription_sun`
- `prescription_sun`
- `reglaze_single_vision`
- `reglaze_progressive_computer`
- `reglaze_super_progressive`
- `reglaze_progressive_sun`

## Layer 3 — Material / index
This defines thickness/material state.

Examples:
- `index_150`
- `index_160`
- `index_167`
- `index_174`

Even if the frontend hides or defers this choice, the CRM must still support it as a structured decision.

## Layer 4 — Finish state
This defines the lens finish/look/performance state.

Examples:
- `clear`
- `tint_prescription`
- `polarized_prescription`
- `transitions_optical`
- `interior_tint`
- `sun_standard`
- `sun_polarized`
- `sun_custom_dipped_tint`
- `transitions_sun`
- `reglaze_tint_no_rx`
- `reglaze_polarized_no_rx`
- `reglaze_prescription_tint`
- `reglaze_prescription_polarized`
- `reglaze_transitions`

## Layer 5 — Optional treatments
These are true optional add-ons that can sit on top of other layers when valid.

Examples:
- `blue_light`

Important modelling note:
- `anti_fatigue` is **not** a treatment. It is a lens path.
- `transitions` is **not** a generic treatment. It is a finish state.
- `interior_tint` is **not** a generic treatment. It is a finish state.

## Layer 6 — Order-level charges
These are not product options. They belong at order/checkout level.

Examples:
- `ship_ca`
- `ship_us`
- `ship_intl`

---

# 3. What the CRM must manage

The CRM must own five things:

1. **Option master data**
2. **Step definitions**
3. **Compatibility / mutual exclusion rules**
4. **Pricing rules**
5. **Order configuration snapshots**

---

# 4. Required CRM entities

## 4.1 Product family / sellable context
Used to attach options to the correct commercial context.

```ts
interface SellableContext {
  id: string
  channel: 'optical' | 'sun' | 'reglaze'
  shopifyProductId?: string
  shopifyVariantId?: string
  familyKey?: string
  frameColor?: string
  title: string
  basePriceCad: number
  active: boolean
}
```

## 4.2 Option group
Defines the type of choice.

```ts
interface OptionGroup {
  id: string
  code: string
  label: string
  layer:
    | 'channel'
    | 'lens_path'
    | 'material'
    | 'finish_state'
    | 'treatment'
    | 'shipping'
  selectionMode: 'single' | 'multi' | 'none'
  required: boolean
  active: boolean
}
```

Recommended groups:
- `lens_path`
- `material_index`
- `finish_state`
- `optional_treatments`
- `shipping_band`

## 4.3 Option
Each actual commercial choice.

```ts
interface Option {
  id: string
  groupId: string
  code: string
  label: string
  description?: string
  customerVisible: boolean
  active: boolean
  sortOrder: number
}
```

## 4.4 Price rule
Attaches price to an option or option combination.

```ts
interface PriceRule {
  id: string
  code: string
  label: string
  amountCad: number
  pricingType: 'absolute' | 'delta'
  appliesToChannel: Array<'optical' | 'sun' | 'reglaze'>
  optionCodes: string[]
  conditions?: Record<string, unknown>
  active: boolean
  startsAt?: string
  endsAt?: string
}
```

## 4.5 Constraint rule
Controls validity and mutual exclusion.

```ts
interface ConstraintRule {
  id: string
  code: string
  ruleType:
    | 'requires'
    | 'excludes'
    | 'allowed_only_with'
    | 'hidden_until'
    | 'default_if'
    | 'defer_if_no_rx'
  sourceOptionCode: string
  targetOptionCodes: string[]
  context?: Record<string, unknown>
  active: boolean
}
```

## 4.6 Step definition
Defines the selectable sequence exposed to frontend.

```ts
interface StepDefinition {
  id: string
  channel: 'optical' | 'sun' | 'reglaze'
  code: string
  label: string
  sortOrder: number
  optionGroups: string[]
  active: boolean
}
```

## 4.7 Configuration snapshot
Stored on cart item, quote, and final order.

```ts
interface ConfigurationSnapshot {
  id: string
  channel: 'optical' | 'sun' | 'reglaze'
  sellableContextId: string
  shopifyProductId?: string
  shopifyVariantId?: string
  selectedLensPath?: string
  selectedMaterial?: string
  selectedFinishState?: string
  selectedTreatments: string[]
  rxState: 'none' | 'pending' | 'provided' | 'validated' | 'flagged'
  pricingLines: Array<{
    code: string
    label: string
    amountCad: number
  }>
  totalCad: number
  createdAt: string
}
```

---

# 5. Full Lunettiq pricing mapped into CRM structure

## 5.1 Optical — base and options

### Base commercial rule
- `optical` + `single_vision` base pair = **290 CAD** including frame

### Lens path options

| Code | Label | Group | Amount CAD | Notes |
|---|---|---|---:|---|
| `single_vision` | Single Vision | lens_path | base included | default optical base |
| `progressive_premium` | Progressive Premium | lens_path | 275 | delta from base |
| `computer_degressive` | Computer / Degressive | lens_path | 275 | delta from base |
| `super_progressive` | Super Progressive | lens_path | 500 | delta from base |
| `anti_fatigue` | Anti-Fatigue | lens_path | 90 | delta from base |
| `non_prescription_clear` | Non-Prescription Clear | lens_path | 0 or custom | only if Lunettiq wants clear plano path |

### Material / index options

| Code | Label | Group | Amount CAD | Notes |
|---|---|---|---:|---|
| `index_150` | Standard | material | 0 | implicit default |
| `index_160` | Thinning 1.6 | material | 60 | optional or recommended |
| `index_167` | Ultra Thin 1.67 | material | 100 | optional or recommended |
| `index_174` | Super Thin 1.74 | material | 200 | optional or recommended |

### Finish state options

| Code | Label | Group | Amount CAD | Notes |
|---|---|---|---:|---|
| `clear` | Clear | finish_state | 0 | default optical state |
| `tint_prescription` | Prescription Tint | finish_state | 120 | exclusive finish state |
| `polarized_prescription` | Prescription Polarized | finish_state | 180 | exclusive finish state |
| `transitions_optical` | Transitions | finish_state | 180 | exclusive finish state |
| `interior_tint` | Interior Tint (Movie Star) | finish_state | 160 | exclusive finish state |

### Treatment options

| Code | Label | Group | Amount CAD | Notes |
|---|---|---|---:|---|
| `blue_light_rx` | Blue Light | treatment | 75 | use when Rx path is active |
| `blue_light_no_rx` | Blue Light no Rx | treatment | 10 | use only with no-rx optical path |

---

## 5.2 Sun — base and options

### Base commercial rule
- `sun` + `non_prescription_sun` base pair = **250 CAD** including frame

### Lens path options

| Code | Label | Group | Amount CAD | Notes |
|---|---|---|---:|---|
| `non_prescription_sun` | Non-Prescription Sun | lens_path | base included | default sun base |
| `prescription_sun` | Prescription Sun | lens_path | 0 | acts as context switch, price mostly in finish/material layer |

### Finish state options

| Code | Label | Group | Amount CAD | Notes |
|---|---|---|---:|---|
| `sun_standard` | Standard Sun Finish | finish_state | 0 | default sun state |
| `sun_polarized` | Polarized | finish_state | 100 | non-rx sun pricing |
| `sun_custom_dipped_tint` | Custom Dipped Tint | finish_state | 50 | non-rx sun pricing |
| `transitions_sun` | Transitions | finish_state | 100 | non-rx sun pricing |
| `interior_tint` | Interior Tint (Movie Star) | finish_state | 160 | can be reused if commercially valid |
| `tint_prescription` | Prescription Tint | finish_state | 120 | used when `prescription_sun` path is active |
| `polarized_prescription` | Prescription Polarized | finish_state | 180 | used when `prescription_sun` path is active |

### Material / index options for sun

| Code | Label | Group | Amount CAD | Notes |
|---|---|---|---:|---|
| `index_150` | Standard | material | 0 | may be implicit |
| `index_160` | Thinning 1.6 | material | 60 | if Lunettiq uses same optical logic for Rx sun |
| `index_167` | Ultra Thin 1.67 | material | 100 | if valid |
| `index_174` | Super Thin 1.74 | material | 200 | if valid |

---

## 5.3 Reglaze — separate service channel

Reglaze should sit in the same CRM option model, but under a separate `reglaze` channel so it does not pollute optical/sun logic.

### Lens path options

| Code | Label | Group | Amount CAD |
|---|---|---|---:|
| `reglaze_single_vision` | Single Vision lenses | lens_path | 180 |
| `reglaze_progressive_computer` | Progressive / Computer | lens_path | 325 |
| `reglaze_anti_fatigue` | Anti-Fatigue | lens_path | 290 |
| `reglaze_progressive_sun` | Progressive Sun | lens_path | 430 |
| `reglaze_super_progressive` | Super Progressive | lens_path | 500 |

### Material / index options

| Code | Label | Group | Amount CAD |
|---|---|---|---:|
| `reglaze_index_160` | 1.6 Thinning | material | 50 |
| `reglaze_index_167` | 1.67 Thinning | material | 85 |
| `reglaze_index_174` | 1.74 Thinning | material | 200 |

### Finish state options

| Code | Label | Group | Amount CAD |
|---|---|---|---:|
| `reglaze_transitions` | Transitions | finish_state | 130 |
| `reglaze_prescription_tint` | Prescription + Tint | finish_state | 250 |
| `reglaze_prescription_polarized` | Prescription Polarized | finish_state | 290 |
| `reglaze_tint_no_rx` | Tint no prescription | finish_state | 125 |
| `reglaze_polarized_no_rx` | Polarized no prescription | finish_state | 150 |
| `reglaze_progressive_sun_polarized` | Progressive Sun Polarized | finish_state | 490 |
| `reglaze_super_progressive_polarized` | Super Progressive Polarized | finish_state | 650 |
| `reglaze_super_progressive_tint` | Super Progressive + Tint | finish_state | 600 |

---

# 6. Mutual exclusion and compatibility matrix

This is the most important CRM-management piece.

## 6.1 Single-select groups
The CRM should enforce that these groups are **single-select**:
- `lens_path`
- `material_index`
- `finish_state`
- `shipping_band`

## 6.2 Multi-select groups
The CRM should enforce that these groups are **multi-select**:
- `optional_treatments`

For v1, this may only contain blue light.

## 6.3 Recommended mutual exclusions

### Optical finish states
The following should be mutually exclusive within the same configuration:
- `clear`
- `tint_prescription`
- `polarized_prescription`
- `transitions_optical`
- `interior_tint`

Only one should be active.

### Sun finish states
The following should be mutually exclusive within the same configuration:
- `sun_standard`
- `sun_polarized`
- `sun_custom_dipped_tint`
- `transitions_sun`
- `interior_tint`
- `tint_prescription`
- `polarized_prescription`

Only one primary finish state should be active.

### Blue light rules
Recommended:
- `blue_light_rx` allowed only when lens path is Rx-bearing optical path
- `blue_light_no_rx` allowed only when lens path is non-rx clear path
- `blue_light_rx` and `blue_light_no_rx` are mutually exclusive

### Anti-fatigue rules
Recommended:
- treat `anti_fatigue` as a lens path
- therefore it cannot coexist with:
  - `single_vision`
  - `progressive_premium`
  - `computer_degressive`
  - `super_progressive`

### Progressive family rules
Recommended:
- only one of these can be active:
  - `progressive_premium`
  - `computer_degressive`
  - `super_progressive`
  - `anti_fatigue`
  - `single_vision`

### Reglaze rules
Reglaze should be fully isolated from optical/sun choice trees. A configuration cannot mix:
- `reglaze_*`
with
- regular `optical` or `sun` lens paths

---

# 7. Recommended step model for frontend, served by CRM

Even though this is a CRM spec, the CRM should own the step definitions so the frontend is reading a managed configuration model rather than hardcoding it.

## 7.1 Optical step definition

### Step 1 — Lens Path
Option group:
- `lens_path`

Shown options:
- Single Vision
- Progressive Premium
- Computer / Degressive
- Super Progressive
- Anti-Fatigue
- Non-Prescription Clear

### Step 2 — Finish State
Option group:
- `finish_state`

Shown options:
- Clear
- Prescription Tint
- Prescription Polarized
- Transitions
- Interior Tint

### Step 3 — Optional Treatments
Option group:
- `optional_treatments`

Shown options:
- Blue Light

### Step 4 — Summary
CRM returns summary lines from selected options and price rules.

### Deferred / hidden step
- Material/index may be:
  - hidden until Rx exists
  - shown only when needed
  - stored as default `index_150` until later validation

This is why material should exist in CRM even if not always exposed.

## 7.2 Sun step definition

### Step 1 — Product / variant selection
This may come from Shopify/product page rather than CRM option groups.

### Step 2 — Lens Path
Shown options:
- Non-Prescription Sun
- Prescription Sun

### Step 3 — Finish State
Shown options:
- Standard Sun Finish
- Polarized
- Custom Dipped Tint
- Transitions
- Interior Tint
- Prescription Tint
- Prescription Polarized

Which options appear depends on the chosen lens path.

### Step 4 — Summary
CRM returns summary lines and total.

## 7.3 Reglaze step definition

Recommended separate flow later:
- choose base package
- choose material/index
- choose finish state
- summary

---

# 8. Recommended CRM admin UI structure

The CRM management layer should let non-dev users manage this commercially.

## 8.1 Option groups screen
Admin can see:
- group name
- selection mode
- required vs optional
- active/inactive

## 8.2 Options screen
Admin can see:
- option code
- label
- group
- active state
- customer visible or internal only
- sort order

## 8.3 Pricing rules screen
Admin can manage:
- amount
- channel
- linked option(s)
- effective date
- active status

## 8.4 Constraint rules screen
Admin can manage:
- excludes
- requires
- hidden until
- defaults
- defer-if-no-rx

## 8.5 Step definitions screen
Admin can manage which option groups appear in which order for:
- optical
- sun
- reglaze

This is what makes the model scalable.

---

# 9. Example CRM payloads

## 9.1 Option definition payload

```json
{
  "code": "progressive_premium",
  "label": "Progressive Premium",
  "group": "lens_path",
  "channel": ["optical"],
  "customerVisible": true,
  "active": true,
  "sortOrder": 20
}
```

## 9.2 Price rule payload

```json
{
  "code": "price_progressive_premium",
  "label": "Progressive Premium uplift",
  "amountCad": 275,
  "pricingType": "delta",
  "appliesToChannel": ["optical"],
  "optionCodes": ["progressive_premium"],
  "active": true
}
```

## 9.3 Constraint payload

```json
{
  "code": "exclude_optical_finish_states",
  "ruleType": "excludes",
  "sourceOptionCode": "transitions_optical",
  "targetOptionCodes": [
    "clear",
    "tint_prescription",
    "polarized_prescription",
    "interior_tint"
  ],
  "active": true
}
```

## 9.4 Step payload

```json
{
  "channel": "optical",
  "code": "optical_step_finish_state",
  "label": "Lens Finish",
  "sortOrder": 20,
  "optionGroups": ["finish_state"],
  "active": true
}
```

---

# 10. Recommended quote-building logic

The CRM should compute prices by stacking layers in order.

## Optical example
Customer selects:
- channel: optical
- lens path: progressive_premium
- material: index_167
- finish state: transitions_optical
- treatment: blue_light_rx

CRM quote lines become:
- Base Optical Pair = 290
- Progressive Premium = 275
- Ultra Thin 1.67 = 100
- Transitions = 180
- Blue Light = 75
- Total before shipping = 920

## Sun example
Customer selects:
- channel: sun
- lens path: non_prescription_sun
- finish state: sun_polarized

CRM quote lines become:
- Base Sun Pair = 250
- Polarized = 100
- Total before shipping = 350

## Reglaze example
Customer selects:
- channel: reglaze
- lens path: reglaze_super_progressive
- finish state: reglaze_super_progressive_polarized

Recommended handling:
- if finish state is already a package amount, do not double-stack incompatible path/finish package rules
- use either package pricing or decomposed pricing, but not both

This is why reglaze should be treated as a separate rule branch.

---

# 11. Order storage and follow-up logic

Because Rx is deferred, the CRM must track configuration completeness separately from order payment state.

## Required configuration states
- `build_valid_no_rx`
- `build_valid_rx_pending`
- `build_valid_rx_received`
- `build_flagged_for_manual_review`
- `build_ready_for_production`

## Post-purchase follow-up paths
If order placed without Rx:
- send follow-up prompt
- allow upload in account
- allow secure post-purchase link flow
- move order to `rx_required` / `rx_validation_needed`

The order should still carry a full commercial configuration snapshot even before Rx is attached.

---

# 12. Final recommendation

The CRM should manage Lunettiq’s offer using these primary constructs:

- **Channel context**
- **Lens path**
- **Material/index**
- **Finish state**
- **Optional treatments**
- **Shipping bands**
- **Constraint rules**
- **Step definitions**
- **Configuration snapshots**

This is the cleanest way to keep the system manageable.

It avoids:
- flat add-on chaos
- Shopify variant abuse
- frontend-only business rules
- hardcoded step logic that drifts from pricing logic

If Lunettiq builds this layer cleanly in the CRM, the frontend can stay flexible and the pricing/order logic will remain consistent over time.

