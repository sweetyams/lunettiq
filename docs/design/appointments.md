# Appointments — Design Document

**Author:** —  
**Date:** 2026-04-17  
**Status:** Draft  
**Spec:** [`specs/appointments.md`](../../specs/appointments.md)

---

## 1. Problem Statement

Lunettiq staff need to manage in-store appointments (fittings, consultations, eye exams) across multiple locations, while customers need a self-service way to book online. The system must prevent double-booking, support walk-ins, and give staff full calendar visibility.

## 2. Goals & Non-Goals

### Goals
- Unified appointment record for both CRM-created and customer-booked appointments
- Weekly drag-and-drop calendar for staff with real-time conflict detection
- Guided multi-step storefront booking flow
- Role-based access (owner/manager can delete; SA/optician can create/update; read-only can view)
- Audit trail for all CRM mutations
- Staff notifications on every new booking

### Non-Goals (for now)
- Recurring / repeating appointments
- Email/SMS reminders
- External calendar sync (Google, Outlook)
- Multi-resource capacity per location (currently 1 concurrent per location on storefront)
- Customer self-cancellation

## 3. Architecture

```
┌─────────────────┐     ┌──────────────────────┐
│  Storefront UI   │     │      CRM UI          │
│  /account/appts  │     │  /crm/appointments   │
└────────┬────────┘     └──────────┬───────────┘
         │                         │
         ▼                         ▼
┌─────────────────┐     ┌──────────────────────┐
│ /api/account/   │     │ /api/crm/            │
│ appointments    │     │ appointments/*       │
│ (Shopify auth)  │     │ (Clerk auth + RBAC)  │
└────────┬────────┘     └──────────┬───────────┘
         │                         │
         └──────────┬──────────────┘
                    ▼
         ┌─────────────────┐
         │  appointments   │  ← Postgres (Neon)
         │  table          │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │  audit_log      │  ← CRM writes only
         │  notifications  │  ← both surfaces
         └─────────────────┘
```

### Key decisions

1. **Single table, two entry points.** Both surfaces write to `appointments`. No separate "booking" entity — keeps queries simple and avoids sync.

2. **Conflict check differs by surface.** CRM checks staff overlap (a staff member can't be in two places). Storefront checks location overlap (a location has limited capacity). This is intentional — CRM staff manage their own schedule, customers just need a slot at a store.

3. **Soft deletes only.** `DELETE` sets status to `cancelled` rather than removing the row. Preserves audit history and prevents orphaned references.

4. **No Inngest for appointments.** Unlike Shopify webhooks, appointments are CRM-owned data with synchronous writes. No eventual consistency needed — direct DB inserts in route handlers.

## 4. Data Model

### 4.1 Schema (existing)

```sql
CREATE TYPE appointment_status AS ENUM (
  'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
);

CREATE TABLE appointments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shopify_customer_id TEXT,          -- null = walk-in
  title         TEXT NOT NULL,
  status        appointment_status DEFAULT 'scheduled',
  starts_at     TIMESTAMP NOT NULL,
  ends_at       TIMESTAMP NOT NULL,
  notes         TEXT,
  staff_id      TEXT,                -- Clerk user ID
  location_id   TEXT,                -- FK locations.id
  external_id   TEXT,                -- reserved
  created_at    TIMESTAMP DEFAULT now(),
  updated_at    TIMESTAMP DEFAULT now()
);
```

### 4.2 State Machine

```
scheduled ──→ confirmed ──→ completed
    │              │
    │              ├──→ no_show
    │              │
    │              └──→ cancelled
    │
    └──→ cancelled
    └──→ completed (skip confirm for walk-ins)
```

Transitions enforced in `PATCH /api/crm/appointments/[id]` via a lookup table. Invalid transitions return `400`.

## 5. Slot Availability

### 5.1 Algorithm

```
Given: date, entity (staff or location), duration, business hours

1. Query all non-cancelled appointments for entity on date
2. Generate candidate slots from business_start to business_end, stepping by 30 min
3. For each candidate, check: does [candidate_start, candidate_end) overlap any booked range?
4. If no overlap → slot is available
```

### 5.2 Surface differences

| | CRM | Storefront |
|---|---|---|
| Entity | `staff_id` | `location_id` |
| Hours | 09:00–18:00 | 10:00–18:00 |
| Duration | Configurable (default 30m) | Fixed per service type |
| Past filtering | No | Yes (excludes slots before now) |

### 5.3 Race condition mitigation

No row-level locking currently. The `POST` endpoints do a final overlap check before insert. In the rare case of a race, the second request gets a `409 Conflict`. The UI handles this gracefully with an error toast.

**Future:** If volume increases, wrap the check+insert in a serializable transaction or use an advisory lock on `(staff_id, date)`.

## 6. API Design

### 6.1 CRM endpoints

| Method | Path | Permission | Purpose |
|---|---|---|---|
| `GET` | `/api/crm/appointments` | `read` | List week's appointments |
| `POST` | `/api/crm/appointments` | `create` | Create appointment |
| `GET` | `/api/crm/appointments/[id]` | `read` | Single appointment + customer info |
| `PATCH` | `/api/crm/appointments/[id]` | `update` | Update fields / transition status |
| `DELETE` | `/api/crm/appointments/[id]` | `delete` | Soft-cancel |
| `GET` | `/api/crm/appointments/slots` | `read` | Available slots for staff+date |

### 6.2 Storefront endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/account/appointments` | Customer token | List my appointments |
| `GET` | `/api/account/appointments?slots=1` | None | Available slots for location+date |
| `POST` | `/api/account/appointments` | Customer token | Book appointment |

### 6.3 Response format

All CRM endpoints use the shared `jsonOk` / `jsonList` / `jsonError` helpers for consistent envelope:

```json
{ "data": [...], "meta": { "total": 12, "limit": 12, "offset": 0 } }
```

## 7. UI Components

### 7.1 CRM — WeekCalendar

The calendar is the most complex component. Key design choices:

- **Pointer events for all interactions** — unified model for mouse and touch. `pointerdown` → `pointermove` → `pointerup` handles create-drag, move-drag, and resize-drag.
- **15-minute snap grid** — all positions snap to nearest 15 min for clean alignment.
- **64px per hour** — enough vertical space for 30-min events to show title + time.
- **Ghost elements during drag** — semi-transparent preview shows where the event will land.
- **Optimistic UI** — calendar updates immediately on drag-end, rolls back on API error.

### 7.2 CRM — Side Panel

Slides in from the right (360px fixed width). Two modes:
- **View:** read-only details + status action buttons
- **Create:** form with progressive disclosure (time slots appear after staff + date selected)

### 7.3 Storefront — Booking Wizard

5-step linear flow. Each step is a distinct UI state within a single client component. No URL changes between steps — state is local. Back button at each step, Cancel resets all.

## 8. Notifications & Audit

### 8.1 Notifications

`notifyStaff()` is called on every `POST` (both surfaces). Creates a row in `notifications` table for all active staff. Notification includes:
- Title: "New appointment: {title}" or "Online booking: {title}"
- Body: time + customer name or "walk-in"
- Entity link: `appointment` / `{id}`

### 8.2 Audit

CRM mutations write to `audit_log` with:
- `action`: create / update / delete
- `entity_type`: "appointment"
- `entity_id`: appointment UUID
- `staff_id`: acting Clerk user
- `diff`: JSON of changed fields (for updates)

Customer self-bookings skip audit (no staff actor).

## 9. Security Considerations

- **CRM auth:** Every CRM endpoint calls `requireCrmAuth(permission)` which validates the Clerk session and checks the role-permission matrix.
- **Storefront auth:** Customer endpoints validate the Shopify access token cookie. Slot queries are intentionally public (no PII exposed).
- **Overlap checks:** Server-side only. Client-side slot pickers are a UX convenience, not a security boundary.
- **Soft deletes:** Cancelled appointments remain queryable for audit purposes.

## 10. Future Enhancements

Prioritized by likely impact:

| Priority | Enhancement | Complexity |
|---|---|---|
| P1 | **Customer cancellation** — add `DELETE /api/account/appointments/[id]` | Low |
| P1 | **Configurable service types** — move from hardcoded array to `appointment_types` table or Shopify metaobject | Medium |
| P2 | **Email/SMS reminders** — Inngest cron job, 24h + 1h before `starts_at` | Medium |
| P2 | **Staff working hours** — `staff_schedules` table, filter slots against availability | Medium |
| P2 | **Location capacity** — add `max_concurrent` to `locations`, adjust storefront overlap check | Low |
| P3 | **Buffer time** — configurable gap (e.g. 10 min) between appointments | Low |
| P3 | **Recurring appointments** — `recurrence_rule` column (iCal RRULE), expand on read | High |
| P3 | **Google Calendar sync** — OAuth + Calendar API, bidirectional via `external_id` | High |
| P3 | **Timezone-aware timestamps** — migrate to `timestamptz`, store customer/location timezone | Medium |
