# Requirements — Configurator Admin

## Core Principle

Flow decides where option appears. Group decides default behavior. Rules only handle exceptions.

## Data Model

### Option Catalogue
Master list of atomic options with metadata:
- `id`, `code`, `label`, `description`
- `category` (lens_type, finish, enhancement, thinning, service)
- `channels[]` (optical, sun, reglaze)
- `priceDelta` (CAD)
- `tags[]` (rx_only, sun_only, non_rx_only, premium)
- `active`, `sortOrder`

### Configurator Flow
Defines what appears where per channel:
- `channel` → `steps[]` (ordered)
- Each step → `groups[]` (ordered)
- Each group:
  - `selectionMode`: single | multi
  - `required`: boolean
  - `options[]` (references option catalogue, ordered)
  - `visibleIf`: optional condition expression

### Rules (exceptions only)
Small scoped rules for cross-group logic:
- `requires`: option A requires option B (or B in set)
- `excludes`: option A excludes option B
- `allowed_if`: option visible only when condition met
- `hidden_if`: option hidden when condition met
- `price_modifier_if`: price changes based on other selections

Rule conditions reference: `lens_type`, `channel`, `tags`, other option codes.

## Implicit Behavior

### Req 1: Single-Select Implies Mutual Exclusion
When group `selectionMode = 'single'`, selecting any option deselects all siblings. No constraint_rules needed.

### Req 2: Multi-Select Allows Stacking
When group `selectionMode = 'multi'`, multiple options selectable. Only explicit `excludes` rules limit combinations.

### Req 3: Rules Only Store Exceptions
Rules table contains only cross-group and conditional logic. Never intra-group single-select exclusions.

## Admin UI

### Req 4: Flow Editor (Left Panel)
Tree nav: Channel → Steps → Groups. Click to select. Drag to reorder steps and groups.

### Req 5: Group Detail (Main Panel)
When group selected:
- Selection mode toggle (single/multi)
- Required/optional toggle
- Display order
- Visible-if condition builder
- Table of options in group: label, price delta, status, conditions summary
- Drag to reorder options

### Req 6: Option Rule Editor (Drawer)
Click option → slide-out drawer:
- Requires (select from other options/groups)
- Excludes (select from other options)
- Hidden when (condition builder)
- Price modifier conditions
- Channel overrides

### Req 7: Compatibility View (QA Tab)
Read-only matrix generated from group modes + rules. Shows effective exclusions. Highlights conflicts:
- Option can never be selected
- Two rules contradict
- Step can become empty
- Required step has no valid options after earlier selections

### Req 8: Simulation Panel
Mini configurator preview. Admin clicks through selections, sees real-time:
- What becomes available/hidden/disabled
- Running price total
- Which rules fired

## Example: Optical Channel

Step 1: Lens Type (single-select, required)
- Single Vision, Progressive Premium, Computer/Degressive, Super Progressive, Anti-Fatigue, Non-Prescription Clear

Step 2: Lens Finish (single-select, required)
- Clear, Prescription Tint, Prescription Polarized, Transitions, Interior Tint

Step 3: Enhancements (multi-select, optional)
- Blue Light, Blue Light (no Rx)
- Rules:
  - Blue Light `requires` lens_type in [Single Vision, Progressive Premium, Computer/Degressive, Super Progressive, Anti-Fatigue]
  - Blue Light (no Rx) `requires` lens_type = Non-Prescription Clear
  - Blue Light `excludes` Blue Light (no Rx)

Step 4: Thinning (single-select, conditional)
- Standard 1.50, Thin 1.61, Ultra-Thin 1.67, Thinnest 1.74, Polycarbonate
- Rules:
  - 1.74 `allowed_if` rx_sphere > ±4.00 or rx_cylinder > ±2.00

### Req 9: Distinguish Implicit vs Custom Rules
Sibling excludes within single-select groups are implicit — never show them. Only display cross-group and conditional rules. Group header explains auto behavior. Custom rules section only shows exceptions.

### Req 10: Human-Readable Rule Summaries
Table shows compact chips: `Requires 2 · Excludes 1`. Not full rule text. Click opens rule drawer for detail. Rule drawer uses plain language: "Works with: Blue Light", "Requires: Prescription", "Not available with: Non-Rx".

### Req 11: Rule Impact Preview
Click an option → show what it enables, disables, hides in other steps. "Selecting Non-Prescription Clear → Enables: Blue Light (no Rx), Disables: Blue Light, Hides: Prescription Tint".

### Req 12: Conflict / Dead-End Warnings
Warn when: option unreachable, required step has no valid options after certain selections, conflicting dependencies. Show as banner or inline warning badges.

### Req 13: Inherited vs Custom Rule Badges
Show `Inherited` / `Channel override` / `Custom` badges on rules. Editing a shared rule warns about cross-channel impact.
