# iPad App — Client Profile Page Spec

## Purpose
Full client view for SAs during consultations. Shows everything known about the client + actionable tools.

## Layout (iPad landscape, 3-column)

### Left Column (25%) — Identity
- Photo (or initials avatar)
- Name, pronouns
- Tier badge + member since
- Email, phone
- Home location
- Quick stats: LTV, order count, credits balance
- Edit button → inline edit name/email/phone/metafields

### Center Column (50%) — Timeline + Activity
- Tabbed view:
  - **Timeline** — all interactions, orders, credits, appointments merged chronologically
  - **Orders** — order history with line items
  - **Appointments** — past + upcoming
  - **Second Sight** — trade-in history
- Each tab loads from the same `GET /api/crm/clients/{id}` response
- Timeline supports cursor-based pagination via `GET /api/crm/clients/{id}/timeline?cursor=&limit=50`

### Right Column (25%) — Intelligence
- **Preferences** — stated (editable) + derived (read-only)
- **Fit Profile** — face shape, frame width, bridge, temple
- **Rx Status** — on file yes/no, expiry date
- **AI Styler** — tap to get AI read, shows thought + action chips
- **Suggestions** — top 4 product thumbnails from scoring algorithm

## API Calls

| Action | Endpoint |
|---|---|
| Load profile | `GET /api/crm/clients/{id}` |
| Load timeline | `GET /api/crm/clients/{id}/timeline?limit=50` |
| Get suggestions | `GET /api/crm/clients/{id}/suggestions?limit=6` |
| AI Styler | `POST /api/crm/clients/{id}/ai-styler` |
| Update client | `PATCH /api/crm/clients/{id}` |
| Add tag | `POST /api/crm/clients/{id}/tags` |
| Issue credit | `POST /api/crm/clients/{id}/credits` |
| Log interaction | `POST /api/crm/interactions` |
| Upload photo | `POST /api/crm/clients/{id}/photo` |

## Actions (floating action menu, bottom-right)
- "Log Note" → modal with type picker + text
- "Start Try-On" → navigates to try-on session flow
- "Recommend" → opens product search modal
- "Book Appointment" → appointment creation form
- "Issue Credit" → amount + reason form

## Gestures
- Swipe left on timeline entry → delete/edit (notes only)
- Long-press suggestion thumbnail → recommend to client
- Pull-to-refresh on timeline
