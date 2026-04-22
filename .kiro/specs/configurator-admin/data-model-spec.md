# Product Step Configurator — Data Model Rebuild Spec

## Purpose

This spec defines the recommended data setup for rebuilding the product step configurator.

The goal is to move away from a flat CRUD model of:

- Groups
- Options
- Pricing
- Constraints
- Steps

and toward a proper configurator architecture that supports:

- reusable flows
- ordered customer steps
- group-level selection behaviour
- reusable choices
- flow-specific choice placement
- structured conditions and logic
- pricing rules
- versioning, preview, and diagnostics

---

## 1. Summary recommendation

The current **concepts** are mostly useful, but the current **tables** should not remain as the source of truth in their current shape.

### Keep conceptually
- Steps
- Groups
- Options
- Pricing
- Constraints

### Rebuild structurally
- Steps should belong to flows
- Groups should belong to steps and own selection logic
- Options should split into reusable choices plus group-specific placement
- Pricing should attach to placements or rules, not live as a detached master list
- Constraints should be replaced by a structured rule engine

### Recommended core authored tables
1. `configurator_flows`
2. `flow_steps`
3. `step_choice_groups`
4. `choices`
5. `group_choices`
6. `rule_sets`
7. `rules`
8. `rule_clauses`
9. `price_rules`
10. `flow_versions`

### Recommended supporting tables
11. `validation_rules`
12. `audit_events`
13. `computed_compatibility_cache` (optional)

---

## 2. Design principles

### 2.1 Flow-first
The main source of truth should be the customer decision flow, not a flat library of records.

### 2.2 Defaults before exceptions
Common behaviour should be automatic.
Exceptions should be authored only where needed.

### 2.3 One concern, one home
- step order belongs to steps
- selection mechanics belong to groups
- reusable catalogue entries belong to choices
- group-specific display/availability/pricing belongs to placement
- logic belongs to rules
- money belongs to price rules

### 2.4 Explainability
Every state should be explainable:
- why shown
- why hidden
- why unavailable
- why selected
- why priced a certain way

### 2.5 Generated outputs should not be manually authored
The compatibility matrix, sibling exclusion logic, and many validation warnings should be computed from the core model.

---

## 3. Why the current flat tables feel wrong

The current setup appears to store the system as a set of independent admin lists:

- groups
- options
- pricing
- constraints
- steps

That causes several issues:

- repeated channel logic
- duplicated pricing logic
- duplicated exclusions
- too much mutual linking between options
- no clear distinction between reusable objects and placed objects
- no clean way to express “this choice appears here, in this flow, under these conditions, with this price effect”

The biggest structural problem is that the current model likely mixes:
- the reusable business concept
- the place where it appears
- the logic controlling it
- the pricing attached to it

Those should be separated.

---

## 4. Recommended domain model

The hierarchy should be:

**Flow → Step → Choice Group → Choice Placement → Choice**

with logic and pricing attached where appropriate.

This allows reusable catalogue items while keeping each flow configurable.

---

## 5. Core tables

## 5.1 `configurator_flows`

Represents a customer journey variant such as Optical, Sun, or Reglaze.

### Purpose
Acts as the top-level container for a specific configurator experience.

### Fields
- `id` UUID / PK
- `code` string unique
- `label` string
- `channel_type` string
- `status` enum (`draft`, `published`, `archived`)
- `base_template_id` nullable FK to `configurator_flows` or templates table
- `version_status` enum (`draft`, `live`)
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`

### Notes
This replaces the need to repeat `channel` everywhere as a flat attribute.

---

## 5.2 `flow_steps`

Represents a customer-facing step within a flow.

Examples:
- Lens Type
- Lens Finish
- Enhancements
- Thinning
- Summary

### Purpose
Controls the order and visibility of the customer journey.

### Fields
- `id` UUID / PK
- `flow_id` FK → `configurator_flows.id`
- `code` string unique within flow
- `label` string
- `description` nullable
- `order_index` integer
- `help_text` nullable
- `is_summary_step` boolean default false
- `required_mode` enum (`always`, `conditional`, `never`)
- `visibility_rule_set_id` nullable FK → `rule_sets.id`
- `status` enum (`active`, `inactive`, `archived`)
- `created_at`
- `updated_at`

### Notes
A step should not directly store group mechanics or pricing.

---

## 5.3 `step_choice_groups`

Represents the selection container inside a step.

Examples:
- Lens Type
- Lens Finish
- Optional Treatments
- Material / Index

### Purpose
Owns selection mechanics like single-select vs multi-select.

### Fields
- `id` UUID / PK
- `step_id` FK → `flow_steps.id`
- `code` string unique within step
- `label` string
- `selection_mode` enum (`single`, `multi`)
- `min_select` integer nullable
- `max_select` integer nullable
- `is_required` boolean
- `sort_order` integer
- `display_style` enum (`list`, `cards`, `swatches`, `table`) nullable
- `status` enum (`active`, `inactive`, `archived`)
- `created_at`
- `updated_at`

### Key behaviour
If `selection_mode = single`, all sibling placements inside the group are automatically mutually exclusive.

### Important implication
You should **not** manually store exclusion rules between sibling choices in a single-select group.

---

## 5.4 `choices`

Represents reusable catalogue items that may appear in one or more flows or groups.

Examples:
- `single_vision`
- `progressive_premium`
- `clear`
- `tint_prescription`
- `blue_light_rx`

### Purpose
Stores the reusable business object, independent of where it appears.

### Fields
- `id` UUID / PK
- `code` string unique
- `label` string
- `description` nullable
- `internal_name` nullable
- `base_type` nullable
- `status` enum (`active`, `inactive`, `archived`)
- `created_at`
- `updated_at`

### Notes
This is the normalized replacement for much of the current `options` table.

---

## 5.5 `group_choices`

Represents the placement of a choice inside a specific group.

This is one of the most important tables in the rebuild.

### Purpose
Separates the reusable choice from the context in which it appears.

### Fields
- `id` UUID / PK
- `group_id` FK → `step_choice_groups.id`
- `choice_id` FK → `choices.id`
- `sort_order` integer
- `label_override` nullable
- `help_text_override` nullable
- `default_selected` boolean default false
- `is_visible` boolean default true
- `availability_rule_set_id` nullable FK → `rule_sets.id`
- `price_rule_set_id` nullable FK → `rule_sets.id`
- `status` enum (`active`, `inactive`, `archived`)
- `created_at`
- `updated_at`

### Why this table matters
Without this table, one object is forced to do too many jobs:
- reusable catalogue entry
- display label
- channel assignment
- group membership
- sort order
- logic attachment
- pricing attachment

This join table fixes that.

---

## 6. Rules architecture

The current flat `constraints` table should be replaced by a structured rule engine.

A single `constraints` table is too broad because it mixes:
- requires
- excludes
- availability logic
- defer logic
- maybe validation logic

These should be structured.

---

## 6.1 `rule_sets`

Represents a grouped collection of rules attached to an owner.

### Purpose
Lets a step, placement, or price effect own multiple logical rules.

### Fields
- `id` UUID / PK
- `owner_type` enum (`flow`, `step`, `group_choice`, `price_rule`, `validation_rule`)
- `owner_id` UUID
- `logic_operator` enum (`AND`, `OR`)
- `status` enum (`active`, `inactive`)
- `created_at`
- `updated_at`

---

## 6.2 `rules`

Represents a logical effect.

### Purpose
Stores what should happen when conditions are met.

### Fields
- `id` UUID / PK
- `rule_set_id` FK → `rule_sets.id`
- `effect_type` enum (
  `show`,
  `hide`,
  `enable`,
  `disable`,
  `require`,
  `unrequire`,
  `default_select`,
  `block_combination`
)
- `priority` integer default 100
- `explanation_text` nullable
- `status` enum (`active`, `inactive`)
- `created_at`
- `updated_at`

### Example
For Blue Light (Rx):
- effect = `show`
- explanation = “Only available for prescription lens paths”

---

## 6.3 `rule_clauses`

Represents the actual conditions inside a rule.

### Purpose
Stores the operands and operators needed for evaluation.

### Fields
- `id` UUID / PK
- `rule_id` FK → `rules.id`
- `left_operand_type` enum (`flow`, `step`, `group`, `choice`, `selection`, `attribute`, `literal`)
- `left_operand_ref` string / UUID / JSON
- `operator` enum (
  `is`,
  `is_not`,
  `is_any_of`,
  `is_none_of`,
  `selected`,
  `not_selected`,
  `greater_than`,
  `less_than`,
  `contains`
)
- `right_operand_type` enum (`choice`, `flow`, `group`, `attribute`, `literal`, `set`)
- `right_operand_ref` string / UUID / JSON
- `created_at`
- `updated_at`

### Example
Rule: show Blue Light when Lens Type is any of prescription lens paths.

Possible clause representation:
- left_operand_type = `group`
- left_operand_ref = `lens_path`
- operator = `is_any_of`
- right_operand_type = `set`
- right_operand_ref = `[single_vision, progressive_premium, computer_degressive, super_progressive, anti_fatigue]`

---

## 7. Pricing architecture

Pricing should not remain as a detached master list if the configurator is the main source of truth.

Simple price deltas can attach to placements.
Advanced pricing should live in dedicated price rules.

---

## 7.1 `price_rules`

Represents price logic attached to a placement, group, step, or flow.

### Purpose
Separates monetary effects from display and availability logic.

### Fields
- `id` UUID / PK
- `owner_type` enum (`group_choice`, `group`, `step`, `flow`)
- `owner_id` UUID
- `rule_type` enum (`delta`, `override`, `formula`, `bundle`)
- `amount` decimal nullable
- `currency` string
- `condition_rule_set_id` nullable FK → `rule_sets.id`
- `priority` integer default 100
- `label` nullable
- `explanation_text` nullable
- `status` enum (`active`, `inactive`)
- `created_at`
- `updated_at`

### Typical use cases
- Blue Light = +75 delta
- Clear = 0 delta
- Index 1.74 = +200 delta
- bundle discount if multiple premium add-ons selected
- override price for a specific flow variant

---

## 8. Validation and safety

Validation should be its own layer, not hidden inside general constraints.

---

## 8.1 `validation_rules`

Represents rules that block or warn about invalid configurations.

### Purpose
Provides explicit safety logic.

### Fields
- `id` UUID / PK
- `flow_id` FK → `configurator_flows.id`
- `rule_type` enum (
  `invalid_combination`,
  `missing_required_choice`,
  `min_not_met`,
  `max_exceeded`,
  `unreachable_step`,
  `empty_step`
)
- `condition_rule_set_id` FK → `rule_sets.id`
- `severity` enum (`warning`, `error`)
- `message` string
- `explanation_text` nullable
- `status` enum (`active`, `inactive`)
- `created_at`
- `updated_at`

---

## 9. Versioning and operations

A configurator should support drafts, publish, diff, and rollback.

---

## 9.1 `flow_versions`

Represents versioned snapshots of a flow.

### Purpose
Supports draft editing, publishing, and rollback.

### Fields
- `id` UUID / PK
- `flow_id` FK → `configurator_flows.id`
- `version_number` integer
- `status` enum (`draft`, `published`, `rolled_back`)
- `snapshot_blob` JSON / JSONB
- `changelog` nullable
- `created_by`
- `created_at`

---

## 9.2 `audit_events`

Optional but recommended.

### Purpose
Track who changed what.

### Fields
- `id` UUID / PK
- `flow_id` FK → `configurator_flows.id`
- `entity_type`
- `entity_id`
- `action_type`
- `before_blob`
- `after_blob`
- `changed_by`
- `changed_at`

---

## 10. Optional computed tables

These are not authored directly. They are derived from the core model.

---

## 10.1 `computed_compatibility_cache`

### Purpose
Stores a generated matrix for diagnostics or performance.

### Fields
- `id`
- `flow_id`
- `left_choice_id`
- `right_choice_id`
- `compatibility_state`
- `reason_summary`
- `computed_at`

### Important note
This should be generated from rules and placements.
It should not be the source of truth.

---

## 11. What should happen to the current tables

## 11.1 Current `steps`
### Keep conceptually
Yes.

### Change structurally
- move under flow
- stop treating channel as repeated flat data
- attach visibility / requirement logic structurally

---

## 11.2 Current `groups`
### Keep conceptually
Yes.

### Change structurally
- move under step
- make selection mode a primary responsibility
- use group behaviour to generate sibling exclusivity automatically

---

## 11.3 Current `options`
### Keep conceptually
Yes, but split.

### Replace with
- `choices`
- `group_choices`

This is the biggest improvement.

---

## 11.4 Current `pricing`
### Keep conceptually
Yes.

### Change structurally
- use `price_rules`
- attach simple price logic to placement or ownership context
- avoid treating pricing as a disconnected flat list

---

## 11.5 Current `constraints`
### Do not keep structurally
No.

### Replace with
- `rule_sets`
- `rules`
- `rule_clauses`
- `validation_rules`

This is the second biggest improvement.

---

## 12. What should be automatic instead of stored

These behaviours should be computed, not authored manually:

### 12.1 Sibling exclusivity
If a group is `single`, all sibling choices are automatically mutually exclusive.

### 12.2 Compatibility matrix
Generate from placements, rules, and validation logic.

### 12.3 Availability explanations
Generate from evaluated rules.

### 12.4 Dead-end and empty-step warnings
Generate from flow validation.

### 12.5 Downstream impact summaries
Generate by simulating rule effects.

---

## 13. Example: Optical flow in the new model

## Flow
`optical`

## Step 1
`lens_type`

### Group
`lens_path`
- selection_mode = `single`
- is_required = true

### Choices placed in group
- `single_vision`
- `progressive_premium`
- `computer_degressive`
- `super_progressive`
- `anti_fatigue`
- `non_prescription_clear`

### Important note
No manual pairwise exclusions are needed between these choices.

---

## Step 2
`lens_finish`

### Group
`finish_state`
- selection_mode = `single`
- is_required = true

### Choices placed in group
- `clear`
- `tint_prescription`
- `polarized_prescription`
- `transitions_optical`
- `interior_tint`

### Important note
Again, no pairwise sibling exclusions should be authored.

---

## Step 3
`enhancements`

### Group
`optional_treatments`
- selection_mode = `multi`
- is_required = false

### Choices placed in group
- `blue_light_rx`
- `blue_light_no_rx`

### Rules
#### Blue Light (Rx)
Show when:
- lens_path is any of:
  - single_vision
  - progressive_premium
  - computer_degressive
  - super_progressive
  - anti_fatigue

#### Blue Light (no Rx)
Show when:
- lens_path is:
  - non_prescription_clear

#### Combination blocking
Block combination:
- `blue_light_rx` with `blue_light_no_rx`

This is a real authored rule because this is a multi-select group.

---

## 14. Recommended SQL-style schema outline

```sql
create table configurator_flows (
  id uuid primary key,
  code text not null unique,
  label text not null,
  channel_type text not null,
  status text not null,
  base_template_id uuid null,
  version_status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table flow_steps (
  id uuid primary key,
  flow_id uuid not null references configurator_flows(id),
  code text not null,
  label text not null,
  description text null,
  order_index integer not null,
  help_text text null,
  is_summary_step boolean not null default false,
  required_mode text not null default 'always',
  visibility_rule_set_id uuid null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(flow_id, code)
);

create table step_choice_groups (
  id uuid primary key,
  step_id uuid not null references flow_steps(id),
  code text not null,
  label text not null,
  selection_mode text not null,
  min_select integer null,
  max_select integer null,
  is_required boolean not null default false,
  sort_order integer not null default 0,
  display_style text null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(step_id, code)
);

create table choices (
  id uuid primary key,
  code text not null unique,
  label text not null,
  description text null,
  internal_name text null,
  base_type text null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table group_choices (
  id uuid primary key,
  group_id uuid not null references step_choice_groups(id),
  choice_id uuid not null references choices(id),
  sort_order integer not null default 0,
  label_override text null,
  help_text_override text null,
  default_selected boolean not null default false,
  is_visible boolean not null default true,
  availability_rule_set_id uuid null,
  price_rule_set_id uuid null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique(group_id, choice_id)
);

create table rule_sets (
  id uuid primary key,
  owner_type text not null,
  owner_id uuid not null,
  logic_operator text not null default 'AND',
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table rules (
  id uuid primary key,
  rule_set_id uuid not null references rule_sets(id),
  effect_type text not null,
  priority integer not null default 100,
  explanation_text text null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table rule_clauses (
  id uuid primary key,
  rule_id uuid not null references rules(id),
  left_operand_type text not null,
  left_operand_ref text not null,
  operator text not null,
  right_operand_type text not null,
  right_operand_ref text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table price_rules (
  id uuid primary key,
  owner_type text not null,
  owner_id uuid not null,
  rule_type text not null,
  amount numeric(12,2) null,
  currency text not null,
  condition_rule_set_id uuid null,
  priority integer not null default 100,
  label text null,
  explanation_text text null,
  status text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table flow_versions (
  id uuid primary key,
  flow_id uuid not null references configurator_flows(id),
  version_number integer not null,
  status text not null,
  snapshot_blob jsonb not null,
  changelog text null,
  created_by text not null,
  created_at timestamptz not null
);
```

---

## 15. Migration strategy

### Phase 1
Create reusable `choices` from current options.

### Phase 2
Create `configurator_flows` for optical, sun, and reglaze.

### Phase 3
Map current steps into `flow_steps`.

### Phase 4
Map current groups into `step_choice_groups`.

### Phase 5
Create `group_choices` to place reusable choices into each flow/group.

### Phase 6
Convert simple flat prices into `price_rules` or placement-level base pricing.

### Phase 7
Convert current constraints into structured rule sets and clauses.

### Phase 8
Generate, do not author, the compatibility matrix.

### Phase 9
Add preview, diagnostics, versioning, and rollback.

---

## 16. Final recommendation

If rebuilding from scratch, do **not** keep the current five-table model as the operational core.

Use this instead:

### Keep as core authored tables
- `configurator_flows`
- `flow_steps`
- `step_choice_groups`
- `choices`
- `group_choices`
- `rule_sets`
- `rules`
- `rule_clauses`
- `price_rules`
- `flow_versions`

### Keep as computed or support layers
- `validation_rules`
- `audit_events`
- `computed_compatibility_cache`

### Most important changes
1. split `options` into reusable `choices` plus contextual `group_choices`
2. replace flat `constraints` with structured rules
3. make group selection mode the source of sibling exclusivity
4. attach pricing to ownership context, not a detached price list
5. treat compatibility matrix and diagnostics as generated outputs, not authored truth

This is the structure I would trust for a real product step configurator.
