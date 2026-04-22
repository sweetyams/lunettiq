# Design — Configurator Admin

## Core Principle

UI organized around decision flow and system confidence, not option data. Admin answers four questions: What does the customer see? What combinations are valid? What changed? Will this break anything?

## Three-Pane Layout

### Left: Flow Health Map
Channel tabs (Optical / Sun / Reglaze) → step cards showing:
- Label, selection mode, required/optional
- Option count, custom rule count
- Warning badges if conflicts detected

Not just navigation — a health dashboard.

### Center: Group Editor
Selected group shows clean option table:

| Option | Price | Availability | Exceptions | Status |
|---|---|---|---|---|
| Blue Light | +$75 | Available for 5 lens types | Excludes Blue Light (no Rx) | Active |
| Blue Light (no Rx) | +$10 | Non-Prescription Clear only | Excludes Blue Light | Active |

Key rules:
- Single-select groups: NO sibling exclusions shown. Ever.
- Only authored exceptions displayed.
- Availability column: human-readable ("Always available", "Available for 5 lens types", "Non-Prescription Clear only")
- Click row → inline edit (label, code, price, active)

### Right: Inspector + Simulator
Click option → side panel:
- Price, group, selection mode
- "Used by rules" — what this option enables/disables in OTHER groups
- Rule ownership is on the DEPENDENT option, not the parent

Simulator below:
- Pick selections step by step
- See available/hidden/disabled update live
- Shows which rules fired and why

## Top-Level Tabs

**Builder** — normal merchandising UI (three-pane)
**Simulation** — full configurator walkthrough with rule explanations
**Diagnostics** — compatibility matrix, dependency graph, unreachable options, conflicts

## Rule Display Philosophy

### Show only authored exceptions, never generated defaults

### Rules belong on the dependent option
- Blue Light says: "Available when Lens Type is one of: SV, Prog, Comp, SP, AF"
- Single Vision does NOT say: "compatible with Blue Light"

### Human-readable sentence builders
Not: `allowed_only_with`, `excludes`, `hidden_if`
Use: "Available when…", "Not available when…", "Hide when…", "Price becomes…"

### Positive framing preferred
Not: "SV excludes Prog, Comp, SP" (implicit from single-select)
Not: "SV allowed_only_with Blue Light" (backwards ownership)
Yes: "Blue Light available when Lens Type is one of: [SV, Prog, Comp, SP, AF]"

## Explainability

Every option state (visible/hidden/disabled/unavailable) must answer WHY.
- Which rules are responsible
- What prior selections caused it
- Human-readable: "Hidden because rule 'Non-Rx tint restriction' triggered from Lens Type = Non-Prescription Clear"

## Key Workflows

### Change a price
Inline edit on row → autosave → preview impact → publish

### Add new option
Guided: channel → group → price → conditional? → copy rules from existing?

### Debug bad combination
Simulator: pick selections → system shows invalid combos with explanations + alternatives

## Implementation Phases

### Phase 1 (now): Clean group editor
- Three-pane shell (left flow, center editor, right inspector stub)
- Availability column with human-readable text
- Zero sibling excludes in display
- Rule ownership on dependent option
- Inline option editing

### Phase 2: Inspector + Simulator
- Click option → impact panel (enables/disables/affects)
- Step-through simulator with live availability updates
- Rule firing explanations

### Phase 3: Diagnostics
- Compatibility matrix (read-only, generated)
- Unreachable option detection
- Conflict/dead-end warnings
- Dependency graph visualization
