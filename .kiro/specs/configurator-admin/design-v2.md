# Design v2 — Configurator Builder

## Core Principle

Author by outcome, not by data model. Users think: "show this choice when customer picks prescription lens" — not "edit option record."

## Terminology

| Old | New |
|---|---|
| Product Options | Configurator Builder |
| Lens Path | Lens Type |
| Finish State | Lens Finish |
| Option | Choice |
| Single select | Choose one |
| Multi select | Choose any |
| Required | Customer must choose |
| Active | Visible to customers |
| Availability | Shown when |
| Exceptions / Rules | Conditions |
| Advanced | Logic & Diagnostics |
| Code | Internal name |

## Three Tabs

**Builder** — main authoring experience
**Preview** — simulate customer journey (phase 2)
**Logic** — conditions, diagnostics, compatibility (phase 3)

## Layout: Three Work Zones

### Left: Steps (flow builder)

```
Optical

① Lens Type
   Choose one · required · 6 choices

② Lens Finish
   Choose one · required · 5 choices

③ Enhancements
   Choose any · optional · 2 choices

④ Summary
```

### Center: Choice Cards (not table rows)

Group header:
```
Lens Finish
Customers choose one finish in this step.
[Choose one ▾] [Required ✓] [+ Add choice]
```

Choice cards:
```
┌─────────────────────────────────────────────┐
│ Clear                                       │
│ Price: included · Shown: Always · No conds  │
│ Visible to customers                        │
│                        [Edit] [Duplicate]   │
├─────────────────────────────────────────────┤
│ Prescription Tint                           │
│ Price: +$120 · Shown: Always · 2 conditions │
│ Visible to customers                        │
│                  [Edit] [Duplicate] [Logic]  │
└─────────────────────────────────────────────┘
```

### Right: Inspector (context-sensitive)

Click choice → shows:
- Internal name, price, visibility
- Conditions list (human-readable sentences)
- "+ Add condition" button
- Preview impact summary

## Condition Builder (sentence blocks)

```
Show this choice when
  [Lens Type] [is any of] [Single Vision, Progressive, Anti-Fatigue]

Hide this choice when
  [Channel] [is] [Sun]

Make unavailable when
  [Transitions] [is selected]
```

## Built-in Behavior (never shown as rules)

- Choose one → siblings mutually exclusive automatically
- "In 'Choose one' steps, selecting one choice automatically deselects the others."
- Only cross-step conditions and real exceptions shown

## Implementation: Phase 1 (now)

1. Rename all labels to new terminology
2. Replace option table with choice cards
3. Move conditions to right inspector panel
4. Clean group header with friendly controls
5. Zero sibling exclusions displayed
