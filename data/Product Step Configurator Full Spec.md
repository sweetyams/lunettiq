# Product Step Configurator — Foundation-First Functional Spec

## 1) Purpose

This feature should not be modelled as a loose set of “product options” with manual exclusions.

It should be modelled as a **configurator platform** that lets a business define:

- the sequence of steps a customer moves through
- the choices available at each step
- the conditions that control those choices
- the pricing effects of those choices
- the validation rules that keep the configuration valid
- the preview, publishing, and diagnostics needed to operate it safely

The goal is to create a system that is easy to author, easy to reason about, and safe to change.

---

## 2) Problem with the current setup

The current model is backwards because it appears to be:

- **option-centric instead of flow-centric**
- **exclusion-driven instead of condition-driven**
- **record-editing oriented instead of journey-authoring oriented**
- **manual and duplicated instead of rule-based and generated**
- **hard to preview and hard to trust**

Symptoms of the current model:

- sibling exclusions are authored manually even when the group itself already implies exclusivity
- relationships are stored on too many objects at once
- business users must parse technical or semi-technical rule language
- there is no clear distinction between built-in system behaviour and custom business logic
- there is no obvious source of truth for why a choice is shown, hidden, disabled, or priced the way it is

The product should instead be designed around a **guided selling flow**.

---

## 3) Product vision

Build a **Configurator Builder** that lets a business create and maintain guided product configuration flows across multiple channels or product types.

The builder should answer five questions at all times:

1. What does the customer choose, and in what order?
2. What choices are available at each step?
3. Why is a choice shown, hidden, or unavailable?
4. How does each choice affect price and downstream steps?
5. Can I preview and publish changes safely?

---

## 4) Core product principles

### 4.1 Flow first
The primary object is the customer flow, not the option record.

### 4.2 Defaults before exceptions
The system should handle common behaviours automatically.
Custom logic should only be used for exceptions.

### 4.3 Positive conditions over exclusion webs
Author “show when” and “available when” logic wherever possible.
Use exclusions only when necessary.

### 4.4 One source of truth per concern
- flow structure should live in the flow model
- selection behaviour should live in the group model
- pricing should live in the pricing model
- custom logic should live in the condition model

### 4.5 Explainability
Every visible state should have a reason:
shown, hidden, disabled, required, selected, priced.

### 4.6 Safe operations
Drafts, versioning, preview, diagnostics, publish controls, and rollback are required.

---

## 5) Primary users

### Business / merchandising admin
Needs to add and reorder steps, choices, labels, prices, and basic conditions.

### Product ops / implementation admin
Needs to manage more complex rules, templates, channel overrides, diagnostics, and publishing.

### Support / QA
Needs to preview flows, reproduce edge cases, and understand why certain combinations fail.

---

## 6) Mental model of the system

The system should be built on this hierarchy:

**Configurator Template**  
→ **Channel / Product Flow**  
→ **Step**  
→ **Choice Group**  
→ **Choice**  
→ **Conditions**  
→ **Price Effects**  
→ **Validation / Diagnostics**

### Important distinction
A **step** is part of the customer journey.  
A **choice group** defines how selection works inside that step.  
A **choice** is what the customer can pick.

In many cases a step may contain a single choice group, but the data model should still keep them separate so the system remains extensible.

---

## 7) Domain model

## 7.1 Configurator Template
A reusable base configuration that can power multiple channels or product types.

**Fields**
- id
- name
- description
- status: draft / published / archived
- version
- base currency
- created by
- updated by
- created at
- updated at

**Purpose**
Allows shared logic and shared structures to be reused, then overridden where needed.

---

## 7.2 Flow
A flow is a configured customer journey for a channel, product family, or market.

Examples:
- Optical
- Sun
- Reglaze

**Fields**
- id
- template_id
- name
- slug
- channel_type
- market
- status
- inherits_from_flow_id (optional)
- override_mode: none / partial / full

**Purpose**
Defines the specific journey variant.

---

## 7.3 Step
A step is a customer-facing stage in the journey.

Examples:
- Lens Type
- Lens Finish
- Enhancements
- Thinning
- Summary

**Fields**
- id
- flow_id
- name
- internal_name
- description
- order_index
- visible_when_condition_set_id (optional)
- required_mode: always / conditional / never
- help_text
- status

**Purpose**
Represents the journey stage and controls whether the stage appears.

---

## 7.4 Choice Group
Defines how selection works inside a step.

Examples:
- “Choose one lens type”
- “Choose any enhancements”

**Fields**
- id
- step_id
- name
- selection_mode: single / multiple
- min_select
- max_select
- required: boolean
- layout_type: list / cards / swatches / table
- auto_exclusive_siblings: boolean
- default_choice_strategy: none / preselect / rules_based
- status

**Purpose**
Owns selection behaviour. This is critical because it removes the need to manually author sibling exclusions in single-select groups.

**Rules**
- if `selection_mode = single`, sibling choices are mutually exclusive automatically
- if `required = true`, customer must choose before continuing unless a condition changes that state
- if `min_select` or `max_select` is set, validation is generated automatically

---

## 7.5 Choice
A customer-selectable option.

Examples:
- Single Vision
- Progressive Premium
- Blue Light
- Interior Tint

**Fields**
- id
- choice_group_id
- label
- internal_name
- short_description
- long_description
- media_ref
- order_index
- visibility_status: visible / hidden / archived
- base_price_delta
- sku_ref (optional)
- tags
- status

**Purpose**
Represents a thing the customer can choose. Choices should be lightweight and reusable.

---

## 7.6 Condition Set
A collection of conditions applied to a step or choice.

**Fields**
- id
- owner_type: step / choice / price_rule
- owner_id
- logic_operator: AND / OR
- status

**Purpose**
Encapsulates business logic in a structured way.

---

## 7.7 Condition
A plain-language rule that affects visibility, availability, requirement, or defaults.

**Fields**
- id
- condition_set_id
- effect_type:
  - show
  - hide
  - enable
  - disable
  - require
  - unrequire
  - select_by_default
  - block_combination
- subject_type:
  - flow
  - step
  - choice
  - attribute
  - selection_count
  - customer_context
- operator:
  - is
  - is_not
  - is_any_of
  - is_none_of
  - greater_than
  - less_than
  - contains
  - selected
  - not_selected
- value
- target_scope
- explanation_text

**Purpose**
Stores authorable logic in a reusable, explainable format.

### Example
“Show Blue Light when Lens Type is any of Single Vision, Progressive Premium, Computer / Degressive, Super Progressive, Anti-Fatigue.”

This is better than scattering `allowed_only_with` references across multiple unrelated options.

---

## 7.8 Price Rule
A pricing effect that applies when certain conditions are met.

**Fields**
- id
- owner_type: choice / group / step / flow
- owner_id
- price_type: delta / override / formula / tiered
- amount
- currency
- condition_set_id (optional)
- priority
- label
- explanation_text

**Purpose**
Separates pricing from availability logic.

### Supported behaviour
- flat add-on
- replacement price
- conditional surcharge
- bundle discount
- tiered pricing
- formula-based pricing

---

## 7.9 Validation Rule
A rule that prevents invalid or contradictory configurations.

**Fields**
- id
- flow_id
- rule_type:
  - invalid_combination
  - missing_required_choice
  - min_not_met
  - max_exceeded
  - unreachable_step
  - empty_step
- condition_set_id
- severity: warning / error
- message
- explanation_text

**Purpose**
Provides explicit guardrails and diagnostics.

---

## 7.10 Snapshot / Version
A saved state of the full configurator.

**Fields**
- id
- flow_id
- version_number
- state_blob
- status: draft / published / rolled_back
- changelog
- created_by
- created_at

**Purpose**
Supports safe publishing and rollback.

---

## 8) Key system behaviours

## 8.1 Built-in behaviours
These should be automatic and should not require manual configuration.

### Single-select groups
Selecting one choice deselects all siblings automatically.

### Multi-select groups
Multiple sibling choices may be selected up to max rules.

### Required steps
If a step is required and visible, the customer must satisfy its selection rules before continuing.

### Hidden steps
Hidden steps do not block progression and do not display to the customer.

### Default validation
The system should automatically validate:
- min/max selections
- required steps
- visibility state
- incompatible hidden states
- empty visible step states

---

## 8.2 Authored exceptions
These should only be used for real business logic.

Examples:
- show Blue Light only for prescription-compatible lens types
- hide Interior Tint in specific channels
- make Thinning visible only after a prescription lens path has been selected
- add a price surcharge only if a premium finish is selected

---

## 9) Configuration model: the right linking strategy

The current setup likely over-links choices to each other manually. That creates duplication and brittleness.

The better linking model is:

### Step owns the journey position
What comes before and after.

### Choice Group owns selection mechanics
Single vs multiple, required vs optional, min/max, default behaviour.

### Choice owns content and base price
Label, internal name, description, status, media, base price delta.

### Condition Set owns exceptions
What changes visibility, availability, requirement, or defaults.

### Price Rule owns financial behaviour
Any amount or formula beyond base choice price.

### Validation Rule owns safety
What should never be allowed or what should warn.

This gives each concern one home.

---

## 10) Authoring UX specification

## 10.1 Top-level app IA

Use three primary work modes:

### Builder
Main authoring workflow for business users.

### Preview
Simulate the customer journey in real time.

### Logic & Diagnostics
Inspect conditions, conflicts, graphs, matrixes, and explanations.

---

## 10.2 Builder layout

### Header
- flow name
- current version
- draft status
- warning count
- last published date
- save draft
- preview
- publish
- rollback

### Left rail: flow map
Display steps in order.

Each step card shows:
- step name
- selection label: Choose one / Choose any
- required/optional
- number of choices
- number of custom conditions
- warning badge

This rail acts as both navigation and health map.

### Centre panel: step editor
For the selected step:
- step name
- step description
- customer-facing help text
- selection settings
- add choice
- reorder choices
- duplicate step
- delete step

Then show each choice as a scan-friendly card.

### Right panel: inspector
Shows details for selected step or choice:
- internal name
- status
- base price
- conditions
- explanation
- affected downstream steps
- preview impact

---

## 10.3 Choice card design

Each choice should display:

- label
- price change
- shown when summary
- conditions summary
- status
- quick actions

### Example
**Prescription Tint**  
Price change: +$120  
Shown: always shown  
Conditions: unavailable with 6 other finish choices  
Visible to customers: yes

Actions:
- edit
- duplicate
- add condition
- view logic

Do not show raw rule syntax by default.

---

## 10.4 Condition builder UX

Conditions should be written as readable sentences.

### Example UI
**When**  
[Lens Type] [is any of] [Single Vision, Progressive Premium, Anti-Fatigue]

**Then**  
[Show this choice]

Another example:

**When**  
[Transitions] [is selected]

**Then**  
[Make this choice unavailable]

This is far easier than exposing internal rule syntax.

---

## 11) Preview specification

Preview is a first-class mode, not a small helper.

## 11.1 Preview panel requirements
- select flow/channel
- simulate the step journey
- show current selection summary
- show visible choices
- show unavailable choices
- show hidden choices
- show price changes
- show validation errors
- show “why” explanations

## 11.2 Why explanations
For any choice state, preview must answer:
- why shown
- why hidden
- why disabled
- why selected by default
- why price changed

### Example
**Blue Light**
Visible because:
- channel = Optical
- lens type = Single Vision

Unavailable when:
- Non-Prescription Clear is selected

---

## 12) Diagnostics specification

Diagnostics should exist because configuration systems become fragile without tooling.

## 12.1 Required diagnostics
- unreachable choices
- empty visible steps
- contradictory conditions
- circular logic
- duplicate conditions
- orphan choices
- unpublished draft changes
- price rule collisions
- incompatible channel overrides

## 12.2 Diagnostic views
- condition list
- dependency graph
- compatibility matrix
- change diff
- audit log

The compatibility matrix still has value, but it should be a diagnostics tool, not the main authoring surface.

---

## 13) Publishing and version control

## 13.1 Draft mode
All edits should happen in draft.

## 13.2 Publish checks
Before publish, run:
- validation pass
- empty-step check
- required-step check
- contradiction check
- price collision check

## 13.3 Publish summary
Show:
- steps changed
- choices added/removed
- price changes
- new conditions
- affected flows/channels
- warnings/errors

## 13.4 Rollback
Any published version must be restorable.

---

## 14) Permissions

### Merchandising admin
Can edit labels, order, simple conditions, and prices.

### Product ops admin
Can edit complex logic, overrides, diagnostics, and publish.

### Viewer / QA
Can preview and inspect but not publish.

---

## 15) Example: how the lens flow should be modelled

## Optical flow

### Step 1: Lens Type
Choice group:
- mode: single
- required: true

Choices:
- Single Vision
- Progressive Premium
- Computer / Degressive
- Super Progressive
- Anti-Fatigue
- Non-Prescription Clear

No sibling exclusions should be authored manually. Single-select handles this.

### Step 2: Lens Finish
Choice group:
- mode: single
- required: true

Choices:
- Clear
- Prescription Tint
- Prescription Polarized
- Transitions
- Interior Tint

Again, sibling exclusivity is built in.

### Step 3: Enhancements
Choice group:
- mode: multiple
- required: false
- max_select: 1 or 2 depending on business rules

Choices:
- Blue Light
- Blue Light (no Rx)

Custom conditions:
- Blue Light is shown when Lens Type is any of Single Vision, Progressive Premium, Computer / Degressive, Super Progressive, Anti-Fatigue
- Blue Light (no Rx) is shown when Lens Type is Non-Prescription Clear
- Blue Light and Blue Light (no Rx) cannot both be selected

### Step 4: Thinning
Choice group:
- mode: single or multiple depending on business logic
- visible only for eligible lens types

### Step 5: Summary
Generated system step

---

## 16) Terminology recommendation

Use product language that matches a configurator mindset.

| Avoid | Use instead |
|---|---|
| Product Options | Configurator Builder |
| Option | Choice |
| Rules | Conditions |
| Exceptions | Special conditions |
| Single select | Choose one |
| Multi select | Choose any |
| Required | Customer must choose |
| Active | Visible to customers |
| Code | Internal name |
| Advanced | Logic & Diagnostics |

This language will make the app more understandable for non-technical users.

---

## 17) Non-functional requirements

### Performance
Preview and availability updates should feel near-instant.

### Explainability
Every computed state should be traceable.

### Extensibility
The model should support:
- more channels
- more steps
- bundles
- formulas
- region-specific pricing
- customer-type conditions
- promotions

### Safety
Versioning and rollback are required.

### Usability
Business users should be able to complete common tasks without touching a matrix or raw rule language.

---

## 18) Migration strategy from the current system

### Step 1
Convert current “options” into:
- steps
- choice groups
- choices

### Step 2
Remove manually-authored sibling exclusions where group selection mode already implies exclusivity.

### Step 3
Convert raw `allowed_only_with` and `excludes` into structured condition sets.

### Step 4
Move pricing out of option text rows into proper price rules.

### Step 5
Generate compatibility matrix from the new condition model rather than storing it as the source of truth.

### Step 6
Add preview, diagnostics, and publishing controls.

---

## 19) MVP scope

A practical MVP should include:

- flows
- steps
- single and multi choice groups
- choices
- base price delta
- structured conditions
- preview mode
- draft/publish versioning
- basic diagnostics
- audit trail

Do not start with:
- raw matrix editing
- overly technical rule syntax
- deep formula pricing
- too many override layers

Start with the clean model first.

---

## 20) Final recommendation

The system should be rebuilt around this principle:

**A product configurator is a guided decision engine, not a database of option rows.**

So the feature should be designed as:

- a **flow builder** for the customer journey
- a **choice system** for what can be selected
- a **condition engine** for exceptions and dependencies
- a **pricing engine** for monetary effects
- a **preview and diagnostics layer** for confidence and safety
- a **versioned publishing model** for operations

That is the foundation that will let this become a usable, scalable product step configurator.
