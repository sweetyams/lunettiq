# Client Canvas Redesign — Requirements

**Source:** lunettiq_client_canvas_bw_marie_dubois.html
**Status:** DRAFT

---

## Layout Structure

The canvas replaces the current 3-column profile with a new layout:

```
┌─────────────────────────────────────────────────────────┐
│ Breadcrumb          ⌘K Search Bar          [Share]      │
├─────────────────────────────────────────────────────────┤
│ [MD] ◆ CULT · Marie Dubois        $2,840  $247  8%  93d│
│      she/her · Nov 2022 · Plateau                       │
├─────────────────────────────────────────────────────────┤
│ [Overview] [Story 47] [Fitting room] [Commercial] [+]  │
├──────────────────────────────────┬──────────────────────┤
│ LEFT (main)                      │ RIGHT (sidebar 300px)│
│                                  │                      │
│ ┌─ AI Stylist ──────────┐       │ Vitals grid (4 cells)│
│ │ Context-aware insight  │       │ Reach her (contact)  │
│ │ Quick action chips     │       │ Her people (graph)   │
│ │ Ask input              │       │ Style space (2D plot)│
│ └────────────────────────┘       │ Fit · measured       │
│                                  │ What we've learned   │
│ ┌─ Frame history deck ──┐       │                      │
│ │ Horizontal scroll cards│       │                      │
│ └────────────────────────┘       │                      │
│                                  │                      │
│ ┌─ Timeline ─────────────┐       │                      │
│ │ Quick compose bar       │       │                      │
│ │ Filter tabs             │       │                      │
│ │ Event entries           │       │                      │
│ └────────────────────────┘       │                      │
│                                  │                      │
│ [+ add block to this view]      │                      │
└──────────────────────────────────┴──────────────────────┘
```

## Key Components Needed

1. **Hero bar** — name, tier, pronouns, member since, stats (LTV, credits, return rate, days idle)
2. **Mode tabs** — Overview, Story, Fitting room, Commercial, Clinical, + custom
3. **AI Stylist block** — context-aware insights, quick action chips, ask input
4. **Frame history deck** — horizontal scroll of tried/owned/loved/returned frames with sentiment icons
5. **Timeline with compose bar** — inline note entry, @mentions, #products, filter tabs
6. **Right sidebar vitals** — 2×2 grid (cadence, avg spend, open rate, pairs owned)
7. **Contact block** — email/phone/address/birthday with consent flags
8. **Relationship graph** — SVG visualization of linked clients + staff
9. **Style space** — 2D preference plot (round↔square, light↔heavy) with product dots
10. **Fit measurements** — grid of frame width, bridge, temple, face shape
11. **Learned signals** — behavioral patterns with confidence bars
