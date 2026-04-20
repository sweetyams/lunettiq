# Appointments & Appointment Management — Specification

## 1. Overview

The appointment system serves two surfaces:

- **CRM** (`/crm/appointments`) — staff create, view, reschedule, and manage appointments via a weekly calendar
- **Storefront** (`/account/appointments`) — customers self-book through a guided multi-step flow

Both surfaces write to the same `appointments` table. Staff are notified of all bookings regardless of origin.

---

## 2. Data Model

### 2.1 `appointments` table

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default random | |
| `shopify_customer_id` | `text` | nullable | Null = walk-in |
| `title` | `text` | NOT NULL | e.g. "Eye Exam", "Frame Fitting" |
| `status` | `appointment_status` enum | default `scheduled` | |
| `starts_at` | `timestamp` | NOT NULL | |
| `ends_at` | `timestamp` | NOT NULL | |
| `notes` | `text` | nullable | Free-text from staff or customer |
| `staff_id` | `text` | nullable | Clerk user ID of assigned staff |
| `location_id` | `text` | nullable | FK to `locations.id` |
| `external_id` | `text` | nullable | Reserved for external calendar sync |
| `created_at` | `timestamp` | default now | |
| `updated_at` | `timestamp` | default now | |

### 2.2 Status Enum

```
scheduled → confirmed → completed
                      → no_show
         → cancelled
confirmed → cancelled
```

Valid transitions enforced server-side:

| From | Allowed To |
|---|---|
| `scheduled` | `confirmed`, `cancelled`, `completed` |
| `confirmed` | `completed`, `cancelled`, `no_show` |
| `completed` | _(terminal)_ |
| `cancelled` | _(terminal)_ |
| `no_show` | _(terminal)_ |

### 2.3 Indexes

- `idx_appointments_customer` → `shopify_customer_id`
- `idx_appointments_date` → `starts_at`
- `idx_appointments_location` → `location_id`

---

## 3. CRM Surface (`/crm/appointments`)

### 3.1 Weekly Calendar View

- Default view: current week (Mon–Sun)
- Hours displayed: 9 AM – 8 PM, 64px per hour, 15-minute snap grid
- Navigation: Today / Prev / Next week buttons
- Filters: staff member (single-select), location (dropdown)
- Current time indicator (red line) on today's column, updates every 60s

### 3.2 Event Rendering

- Events positioned absolutely by `starts_at` / `ends_at`
- Left border color indicates status:
  - `scheduled` → tertiary
  - `confirmed` / `completed` → primary
  - `cancelled` / `no_show` → tertiary + 40% opacity + strikethrough
- Shows title, time range (if tall enough), customer name (if tall enough)

### 3.3 Interactions

| Action | Trigger | Result |
|---|---|---|
| Click empty slot | Opens side panel in "create" mode | |
| Drag on empty slot | Ghost preview → opens create panel with pre-filled time | |
| Click event | Opens side panel in "view" mode | |
| Drag event | Move to new day/time (15-min snap) | `PATCH` with new `startsAt`/`endsAt` |
| Drag bottom handle | Resize duration | `PATCH` with new `endsAt` |

### 3.4 Side Panel — View Mode

Displays:
- Date + time range
- Client name (linked to `/crm/clients/[id]`) or "Walk-in"
- Status badge
- Location name
- Notes

Action buttons based on current status:
- `scheduled` → Confirm, Cancel
- `confirmed` → Complete, No Show, Cancel

### 3.5 Side Panel — Create Mode

Fields:
1. **Title** — free text, required (placeholder: "Fitting, Consultation…")
2. **Client** — client picker modal (optional; omit for walk-in)
3. **Staff** — staff picker (defaults to current user)
4. **Location** — dropdown from active locations
5. **Date** — date input
6. **Time** — `TimeSlotPicker` component (appears after staff + date selected)
7. **Notes** — textarea, optional

Submit → `POST /api/crm/appointments`

### 3.6 Standalone Create Page (`/crm/appointments/new`)

Simpler form with `datetime-local` inputs (no slot picker). Accepts optional `?client=<id>` query param. Redirects to `/crm/appointments` on success.

---

## 4. Storefront Surface (`/account/appointments`)

### 4.1 Booking Flow (5 steps)

| Step | Field | UI |
|---|---|---|
| 0 | Service | Grid of cards: Eye Exam (30m), Frame Fitting (30m), Lens Consultation (30m), Adjustment & Repair (15m) |
| 1 | Location | List of active locations with address |
| 2 | Date | 14-day lookahead grid (Sundays excluded) |
| 3 | Time | Available slots grid (fetched per location+date) |
| 4 | Confirm | Summary card + optional notes textarea |

Back navigation at each step. Cancel resets entire flow.

### 4.2 Appointment List

- **Upcoming**: future + non-cancelled, sorted by date
- **Past**: past or cancelled, dimmed

### 4.3 Auth

- Requires Shopify Customer Account access token (via cookie)
- Dev bypass: `DEV_CUSTOMER_ID` env var in non-production

---

## 5. API Endpoints

### 5.1 CRM APIs (Clerk auth required)

#### `GET /api/crm/appointments`

Query params: `week` (ISO date), `staffId`, `locationId`, `status`

Returns appointments for the week with joined customer name. Default: current week.

Permission: `org:appointments:read`

#### `POST /api/crm/appointments`

Body: `{ title, customerId?, staffId?, locationId?, startsAt, endsAt, notes? }`

- Validates staff overlap (excludes cancelled)
- Creates audit log entry
- Sends staff notification

Permission: `org:appointments:create`

#### `GET /api/crm/appointments/[id]`

Returns single appointment with customer contact info (firstName, lastName, email, phone).

Permission: `org:appointments:read`

#### `PATCH /api/crm/appointments/[id]`

Body: any subset of `{ title, notes, staffId, status, startsAt, endsAt }`

- Validates status transitions against allowed matrix
- Re-checks staff overlap if time/staff changed
- Creates audit log with diff

Permission: `org:appointments:update`

#### `DELETE /api/crm/appointments/[id]`

Soft-delete: sets status to `cancelled`. Creates audit log.

Permission: `org:appointments:delete`

#### `GET /api/crm/appointments/slots`

Query params: `date` (required), `staffId` (required), `duration` (default 30), `locationId`

Returns available `{ start, end }` slots for a staff member on a given day.

- Business hours: 9 AM – 6 PM
- 30-minute step between slot starts
- Excludes slots that overlap any non-cancelled booking for that staff

Permission: `org:appointments:read`

### 5.2 Storefront APIs (Shopify Customer auth)

#### `GET /api/account/appointments`

Returns all appointments for the authenticated customer, ordered by `starts_at` desc. Enriched with location name.

#### `GET /api/account/appointments?slots=1&date=...&locationId=...`

Public (no auth). Returns available slots for a location on a date.

- Business hours: 10 AM – 6 PM
- Excludes past slots
- Checks overlap by **location** (not staff)

#### `POST /api/account/appointments`

Body: `{ locationId, startsAt, title?, notes? }`

- Duration fixed at 30 minutes
- Overlap check by location
- Sends staff notification ("Online booking: …")

---

## 6. Slot Availability Logic

Two different strategies:

| Surface | Conflict check by | Hours | Step |
|---|---|---|---|
| CRM | Staff member | 9–18 | 30 min |
| Storefront | Location | 10–18 | 30 min |

CRM checks ensure a single staff member isn't double-booked. Storefront checks ensure a location isn't over-capacity (currently 1 concurrent appointment per location — no capacity multiplier yet).

---

## 7. Permissions (RBAC)

| Permission | owner | manager | optician | sa | read_only |
|---|---|---|---|---|---|
| `org:appointments:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `org:appointments:create` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `org:appointments:update` | ✓ | ✓ | ✓ | ✓ | ✗ |
| `org:appointments:delete` | ✓ | ✓ | ✗ | ✗ | ✗ |

---

## 8. Notifications

All appointment creation (CRM or storefront) triggers `notifyStaff()`:

- CRM-created: `"New appointment: {title}"` + time + walk-in indicator
- Customer-booked: `"Online booking: {title}"` + customer name + time

Notification entity type: `appointment`, linked by `entityId`.

---

## 9. Audit Trail

All CRM mutations write to `audit_log`:

| Action | Trigger |
|---|---|
| `create` | New appointment via CRM |
| `update` | Status change, reschedule, edit |
| `delete` | Cancellation via DELETE endpoint |

Diff stored as JSON for updates. Customer self-bookings are **not** audited (no staff actor).

---

## 10. Components

| Component | Path | Purpose |
|---|---|---|
| `WeekCalendar` | `src/components/crm/WeekCalendar.tsx` | Drag-and-drop weekly calendar grid |
| `TimeSlotPicker` | `src/components/crm/TimeSlotPicker.tsx` | Morning/afternoon slot selector |
| `StaffPicker` | `src/components/crm/StaffPicker.tsx` | Staff filter/selector |
| `ClientPicker` | `src/components/crm/ClientPicker.tsx` | Client search modal |
| `AppointmentsClient` (CRM) | `src/app/crm/appointments/AppointmentsClient.tsx` | CRM page orchestrator |
| `AppointmentsClient` (Storefront) | `src/app/(storefront)/account/appointments/AppointmentsClient.tsx` | Customer booking flow |

---

## 11. Known Gaps / Future Work

- [ ] **Location capacity** — storefront currently allows only 1 concurrent appointment per location; needs a capacity multiplier
- [ ] **Reminders** — no email/SMS reminders before appointments
- [ ] **Recurring appointments** — not supported
- [ ] **External calendar sync** — `external_id` column exists but is unused
- [ ] **Customer cancellation** — customers cannot cancel from the storefront
- [ ] **Appointment types/durations** — hardcoded in storefront; should be configurable per location
- [ ] **Staff availability / working hours** — no per-staff schedule; assumes all staff available 9–18
- [ ] **Buffer time** — no gap between back-to-back appointments
- [ ] **Timezone handling** — timestamps stored without explicit timezone; relies on server locale
