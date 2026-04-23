# CRM Onboarding Tour

Guided walkthrough that introduces new staff to CRM features on first visit.

## Behaviour

- Auto-starts on first CRM visit after 600ms delay
- Completion persisted in `localStorage` key `lunettiq_crm_tour_done`
- Skipped if already completed
- Can be restarted from **Settings → Restart CRM tour** (removes localStorage key and navigates to `/crm`)

## Tour Steps

| # | Target | Title | Description | Navigates to |
|---|--------|-------|-------------|-------------|
| 1 | `sidebar-clients` | Clients | Search, filter, and manage client database. Full profile, order history, interactions. | `/crm/clients` |
| 2 | `sidebar-products` | Products | Product catalogue synced from Shopify. Inventory, variants, pricing. | `/crm/products` |
| 3 | `sidebar-segments` | Segments | Dynamic client segments with rules — spend, tags, location filters. | `/crm/segments` |
| 4 | `sidebar-appointments` | Appointments | View/manage upcoming appointments. Book fittings, consultations, follow-ups. | `/crm/appointments` |
| 5 | `sidebar-loyalty` | Loyalty | Membership tiers, referral funnels, trial conversions (Essential, CULT, VAULT). | `/crm/loyalty` |
| 6 | `topbar-search` | Quick Search | Instant search for clients, products, orders. ⌘K opens command palette. | — |
| 7 | `topbar-notifications` | Notifications | New clients, appointments, system events. Unread items show red dot. | — |
| 8 | `sidebar-settings` | Settings | Tags, locations, staff roles, loyalty tiers, audit log. | `/crm/settings` |

## UI

- Dark backdrop (`rgba(0,0,0,0.35)`) with spotlight cutout around target element
- Tooltip (300px wide) positioned `right` for sidebar items, `bottom` for topbar items
- Step counter (`1 / 8`), title, description, Back/Next/Skip controls
- Uses CSS variables from CRM theme (`--crm-surface`, `--crm-border`, `--crm-text-*`, `--crm-radius-lg`)

## How Targeting Works

Elements opt in via `data-tour` attribute:

```tsx
// Sidebar
<Link data-tour="sidebar-clients" href="/crm/clients">Clients</Link>

// Topbar
<div data-tour="topbar-search">...</div>
<div data-tour="topbar-notifications">...</div>
```

Tour locates targets with `document.querySelector('[data-tour="<target>"]')` and measures position via `getBoundingClientRect()`. Re-measures on window resize.

## Navigation

Steps with `href` trigger `router.push()` before showing tooltip. 300ms delay after navigation lets page render before measuring target position.

## Components

| File | Purpose |
|------|---------|
| `src/components/crm/CrmTour.tsx` | Tour overlay, step logic, spotlight, tooltip |
| `src/components/crm/CrmShell.tsx` | Mounts `<CrmTour />` inside CRM layout |
| `src/components/crm/CrmSidebar.tsx` | Sidebar nav items with `data-tour` attributes |
| `src/app/crm/settings/ResetTourButton.tsx` | "Restart CRM tour" button on settings page |

## Adding a New Step

1. Add `data-tour="<target-id>"` to element in sidebar/topbar/page
2. Append entry to `STEPS` array in `CrmTour.tsx`:
   ```ts
   { target: '<target-id>', title: '...', body: '...', href: '/crm/...', placement: 'right' }
   ```
3. `href` optional — only needed if step requires navigation
4. `placement` defaults to `right`; use `bottom` for topbar elements

## Resetting

Programmatic:
```ts
localStorage.removeItem('lunettiq_crm_tour_done');
```

Via UI: Settings page → "Restart CRM tour" button.
