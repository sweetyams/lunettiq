# Configurator Builder — Architecture & Rules

## Data Model

```
Flow (optical | sun | reglaze)
  └─ Step (e.g. Lens Type)          ← flow_steps
       └─ Group (e.g. Prescription) ← step_choice_groups
            └─ Placement            ← group_choices (links choice into group)
                 └─ Choice           ← cfg_choices (reusable, has code + label)
```

### Key Tables

| Table | Purpose | Key Fields |
|---|---|---|
| `configurator_flows` | One per channel | `code`, `channelType`, `status` |
| `flow_steps` | Wizard screens | `flowId`, `code`, `label`, `orderIndex`, `autoAdvance`, `visibilityRuleSetId` |
| `step_choice_groups` | Selection blocks within a step | `stepId`, `code`, `label`, `selectionMode` (single/multi), `isRequired`, `sortOrder` |
| `cfg_choices` | Reusable options | `code` (unique), `label`, `description` |
| `group_choices` | Places a choice in a group | `groupId`, `choiceId`, `sortOrder`, `labelOverride`, `helpTextOverride`, `badge`, `availabilityRuleSetId` |
| `cfg_price_rules` | Pricing | `ownerType` (group_choice), `ownerId` (placement ID), `ruleType` (delta/override), `amount` |

### Separation of Concerns

- **Choice** = the reusable thing (e.g. "Blue Light" with code `blue_light`)
- **Placement** = an instance of a choice in a specific group, with its own price, badge, description override, conditions, and sort order
- Same choice can appear in multiple groups via different placements

## Conditions (Rule Engine)

### Structure

```
Placement/Step
  └─ availabilityRuleSetId / visibilityRuleSetId → rule_sets
       └─ logicOperator: AND | OR
       └─ cfg_rules (one or more)
            └─ effectType: show | hide
            └─ rule_clauses (one or more, AND'd within a rule)
                 └─ leftOperandType: selection | choice
                 └─ leftOperandRef: groupId
                 └─ operator: is_any_of | is_none_of | selected | not_selected
                 └─ rightOperandRef: comma-separated choiceIds
```

### How Evaluation Works

1. Find the ruleSet for the placement/step
2. For each rule in the set, evaluate all its clauses (AND'd together)
3. Apply the effect: `show` → visible when clauses pass; `hide` → visible when clauses fail
4. Combine rule results using the ruleSet's `logicOperator` (AND = all rules must pass, OR = any rule passing is enough)
5. No ruleSet = always visible

### Backward-Facing Only

Conditions can only reference groups from **earlier steps** in the same flow. The builder enforces this — the group dropdown only shows groups from steps that come before the current one (by array position, not orderIndex value).

### Common Patterns

| Want | Setup |
|---|---|
| Show only with Rx | `show` when Lens Type `is_any_of` [Single Vision, Progressive] |
| Hide for Non-Rx | `hide` when Lens Type `is_any_of` [Non-Prescription] |
| Show only when something selected | `show` when Lens Type `selected` |
| Show for everything except X | `show` when Lens Type `is_none_of` [X] |

### Critical: Choice IDs vs Labels

Conditions store **choice IDs** (UUIDs) in `rightOperandRef`, not labels or codes. If you duplicate a choice, the duplicate gets a new ID. Existing conditions pointing to the original choice ID will NOT match the duplicate.

## Path Derivation

Paths are derived at read time, not stored:

```
{step.code}.{choice.code}  →  "lens_type.single_vision"
```

Used in: cart attributes, configuration snapshots, analytics. The builder shows these paths on each placement card and in the Inspector.

## Auto-Advance

- Step-level setting (`flow_steps.autoAdvance`)
- When enabled: selecting a choice auto-advances to next step after 200ms
- Continue button is hidden; radio indicators are hidden
- Back button always remains
- Best for single-group, single-select steps (e.g. Lens Type)

## Files

| File | What |
|---|---|
| `FlowEditor.tsx` | Orchestrator — owns data fetch, selection state, 3-column layout |
| `FlowPanels.tsx` | All panels: StepList (sidebar), StepEditor (center), GroupEditor (choices), Inspector (right), EditableCondition, AddConditionForm, AddStepConditionForm, BtnGroup |
| `LiveConfiguratorPreview.tsx` | Customer-facing preview with rule evaluation, product picker, summary, JSON output |
| `flow-helpers.ts` | API helpers (cfgFetch/Create/Update/Delete), label/price/description/path resolvers |
| `ProductOptionsClient.tsx` | Page wrapper — lifts data for shared state between editor and preview |

## Rules for Editing This Code

1. **Never remove `availabilityRuleSetId` or `visibilityRuleSetId` fields** — they link entities to their conditions
2. **Condition deletion must cascade**: delete clauses → delete rule → if last rule, delete ruleSet and null the reference
3. **`buildSelectionIndex` maps placementIds → choiceIds** — selections state stores placement IDs, conditions reference choice IDs
4. **Prior-group filtering uses array position** (not orderIndex comparison) — handles steps with equal orderIndex values
5. **EditableCondition resets state via `startEdit()`** — never rely on useState initializers for edit forms that re-open
6. **`allPlacements` vs `placements`** — group dropdowns use filtered (prior) groups, but choice lookups need all placements to resolve choices in any referenced group
