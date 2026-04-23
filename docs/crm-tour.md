# CRM Onboarding Tour

A guided walkthrough that introduces new staff members to the CRM interface on their first visit. The tour highlights key navigation areas with a spotlight overlay and step-by-step tooltips.

## How It Works

The tour auto-starts on first CRM visit (after a 600ms delay) and walks through 8 steps. Once completed or skipped, it won't appear again. Progress is tracked in `localStorage` under the key `lunettiq_crm_tour_done`.

Staff can replay the tour at any time from **Settings → Onboarding → Restart CRM tour**.

## Tour Steps

| # | Target | Section | Description |
|---|--------|---------|-------------|
| 1 | `sidebar-clients` | Clients | Search, filter, and manage the client database. Links to full profiles, order history, and interactions. |
| 2 | `sidebar-products` | Products | Browse the product catalogue synced from Shopify — inventory, variants, and pricing. |
| 3 | `sidebar-segments` | Segments | Build dynamic client segments with rules (spend, tags, location, etc.). |
| 4 | `sidebar-appointments` | Appointments | View and manage upcoming appointments — fittings, consultations, and follow-ups. |
| 5 | `sidebar-loyalty` | Loyalty | Monitor membership tiers, referral funnels, and trial conversions (Essential, CULT, VAULT). |
| 6 | `topbar-search` | Quick Search | Instant search for clients, products, or orders. Also accessible via ⌘K command palette. |
| 7 | `topbar-notifications` | Notifications | New clients, appointments, and system events. Unread items show a red dot. |
| 8 | `sidebar-settings` | Settings | Configure tags, locations, staff roles, loyalty tiers, and view the audit log. |

## UI Behaviour

- **Spotlight overlay**: A semi-transparent backdrop (`rgba(0,0,0,0.35)`) with a clip-path cutout around the active element.
- **Tooltip placement**: Sidebar items use `right` placement; topbar items use `bottom` placement.
- **Auto-navigation**: Steps with an `href` property trigger `router.push()` to navigate to the relevant page before showing the tooltip.
- **Resize handling**: The spotlight and tooltip reposition on window resize.
- **Controls**: Back / Next buttons to navigate steps, a "Skip tour" link to dismiss, and "Done" on the final step.

## Architecture

### Components

| File | Role |
|------|------|
| `src/components/crm/CrmTour.tsx` | Tour engine — step state, navigation, spotlight overlay, and tooltip rendering. |
| `src/components/crm/CrmShell.tsx` | Mounts `<CrmTour />` inside the CRM layout. |
| `src/components/crm/CrmSidebar.tsx` | Attaches `data-tour` attributes to sidebar nav links. |
| `src/app/crm/settings/ResetTourButton.tsx` | "Restart CRM tour" button — clears localStorage and redirects to `/crm`. |

### Target Binding

Tour steps reference DOM elements via `data-tour` attributes:

```tsx
// In CrmSidebar.tsx
<Link href="/crm/clients" data-tour="sidebar-clients">Clients</Link>

// In CrmShell.tsx
<button data-tour="topbar-search">Search…</button>
<div data-tour="topbar-notifications">…</div>
```

The tour engine queries these with `document.querySelector(`[data-tour="${target}"]`)` and uses `getBoundingClientRect()` to position the spotlight and tooltip.

### State Machine

```
localStorage empty → auto-start (step 0)
  ↓
step has href & not on that page → router.push(href) → wait for navigation → measure target
step has no href or already on page → measure target immediately
  ↓
render spotlight + tooltip
  ↓
Next → step + 1 (or finish if last)
Back → step - 1
Skip / Done → write localStorage → hide tour
```

## Adding a New Step

1. Add a `data-tour="your-target"` attribute to the element you want to highlight.
2. Append a new entry to the `STEPS` array in `CrmTour.tsx`:

```tsx
{
  target: 'your-target',
  title: 'Feature Name',
  body: 'Description of what this feature does.',
  href: '/crm/your-page',     // optional — navigates here first
  placement: 'right',          // 'right' or 'bottom'
}
```

3. The tour will automatically include the new step in sequence.

## Resetting the Tour

- **UI**: Settings → Onboarding → "Restart CRM tour"
- **Manual**: `localStorage.removeItem('lunettiq_crm_tour_done')` in the browser console

## Styling

The tour uses inline styles with CSS custom properties from the CRM theme (`--crm-surface`, `--crm-border`, `--crm-text-primary`, etc.) so it inherits the current theme automatically. The tooltip width is fixed at 300px.
