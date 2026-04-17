# Spec 01: Appointments Calendar

**Status:** DRAFT — awaiting approval
**Dependencies:** None (standalone)
**Permissions used:** org:appointments:read, org:appointments:create, org:appointments:update, org:appointments:delete

---

## What exists today

### DB schema (`src/lib/db/schema.ts`)
```
appointments table:
  id              uuid PK
  shopifyCustomerId  text (nullable)
  title           text (required)
  status          enum: scheduled | confirmed | completed | cancelled | no_show
  startsAt        timestamp (required)
  endsAt          timestamp (required)
  notes           text
  staffId         text
  locationId      text
  externalId      text
  createdAt       timestamp
  updatedAt       timestamp
  Indexes: customer, date, location
```

### API routes (all working, keep as-is)

| Route | Method | Auth | What it does |
|---|---|---|---|
| `/api/crm/appointments` | GET | read | Week query with staffId/locationId/status filters. Joins customer names. |
| `/api/crm/appointments` | POST | create | Creates appointment. Overlap check on staff. Audit log. |
| `/api/crm/appointments/[id]` | GET | read | Single appointment with customer details. |
| `/api/crm/appointments/[id]` | PATCH | update | Update fields. Status transition validation. Overlap check on reschedule. |
| `/api/crm/appointments/[id]` | DELETE | delete | Soft-cancel + audit log. |
| `/api/crm/appointments/slots` | GET | read | Available 30-min slots for a date+staff. 9AM-6PM. |

### Staff API (`/api/crm/staff`)
- GET returns: `{ id, firstName, lastName, email, role, locationIds, imageUrl }`
- Currently gated on `org:settings:staff` — needs a lighter endpoint for the calendar

### Existing files to replace
- `src/app/crm/appointments/page.tsx` — my hallucinated code, delete and rebuild
- `src/app/crm/appointments/actions.ts` — delete (not using server actions)
- `src/components/crm/WeekCalendar.tsx` — delete and rebuild
- `src/components/crm/StaffPicker.tsx` — delete and rebuild
- `src/components/crm/TimeSlotPicker.tsx` — delete and rebuild

### Existing files to keep
- `src/app/crm/appointments/new/page.tsx` — basic form, keep as deep-link fallback
- All API routes under `src/app/api/crm/appointments/` — working, keep as-is

### Existing components to reuse
- `ClientPicker` — modal for searching/selecting a client
- `CrmShell` / `useToast()` — toast notifications
- `CrmSidebar` — already has Appointments nav item

---

## What to build

### 1. Staff list endpoint

**File:** `src/app/api/crm/staff/list/route.ts`

```
GET /api/crm/staff/list
Auth: org:appointments:read (any role except read_only can use this)
Response: { data: [{ id, firstName, lastName, imageUrl }] }
```

Lightweight — no email, no role, no locationIds. Just enough for the picker UI.
Fetches from Clerk API same as existing staff route but returns fewer fields.

### 2. Appointments page (server component)

**File:** `src/app/crm/appointments/page.tsx`

Server component that:
1. Calls `requireCrmAuth('org:appointments:read')`
2. Fetches current week's appointments from DB (same query as GET API but direct DB call)
3. Fetches staff list from Clerk (lightweight: id, name, imageUrl)
4. Passes both to `AppointmentsClient`

### 3. AppointmentsClient

**File:** `src/app/crm/appointments/AppointmentsClient.tsx`

Client component. Owns all interactive state:

```
State:
  weekStart: Date (Monday of current week)
  staffFilter: string | null (staffId or null for all)
  events: CalendarEvent[] (refetched on week/staff change)
  panel: null | { mode: 'view', eventId: string } | { mode: 'create', date: string, hour?: number }

Layout:
  ┌─────────────────────────────────────────────────────────┐
  │ Appointments                                    [+ New] │
  │ [All] [Staff A] [Staff B] [Staff C]  ← StaffPicker     │
  ├───────────────────────────────────┬─────────────────────┤
  │                                   │                     │
  │         WeekCalendar              │   Side Panel        │
  │         (fills remaining space)   │   (360px, optional) │
  │                                   │                     │
  └───────────────────────────────────┴─────────────────────┘

Behavior:
  - On mount: render with server-fetched data
  - On week change: fetch GET /api/crm/appointments?week=X&staffId=Y
  - On staff filter change: same fetch
  - On event click: open view panel
  - On slot click: open create panel with date/hour pre-filled
  - On "+ New" click: open create panel with today's date
```

### 4. WeekCalendar

**File:** `src/components/crm/WeekCalendar.tsx`

Pure presentational component. No data fetching.

```
Props:
  weekStart: Date
  events: CalendarEvent[]
  onEventClick: (event: CalendarEvent) => void
  onSlotClick: (date: Date, hour: number) => void
  onWeekChange: (direction: 'prev' | 'next' | 'today') => void

CalendarEvent type:
  { id, title, customerName, status, startsAt, endsAt, staffId }

Rendering:
  - Header row: [Today] [<] [>] "Apr 14 – Apr 20, 2026"
  - Column headers: Mon 14, Tue 15, ... Sun 20 (today highlighted)
  - Grid: 56px time gutter + 7 equal columns
  - Rows: 9AM to 7PM, 60px per hour
  - Hour lines: light border
  - Events: absolutely positioned by startsAt/endsAt
    - top = (startHour - 9) * 60 + startMinute
    - height = durationMinutes
    - Left border colored by status:
      scheduled=#d4d4d4, confirmed=#2563eb, completed=#16a34a, cancelled=#dc2626, no_show=#d97706
    - Show title + customerName (if height > 30px)
  - Click empty area → onSlotClick(date, hour)
  - Click event → onEventClick(event)
```

### 5. StaffPicker

**File:** `src/components/crm/StaffPicker.tsx`

```
Props:
  staff: { id: string, firstName: string, lastName: string, imageUrl: string | null }[]
  value: string | null
  onChange: (staffId: string | null) => void

Rendering:
  - Horizontal row of pill buttons
  - First pill: "All" (value=null)
  - One pill per staff member: avatar (18px circle) + first name
  - Selected pill: dark bg, white text
  - Unselected: border, secondary text
```

No data fetching — receives staff array from parent.

### 6. TimeSlotPicker

**File:** `src/components/crm/TimeSlotPicker.tsx`

```
Props:
  date: string (YYYY-MM-DD)
  staffId: string
  duration?: number (default 30)
  value: string | null (selected slot start ISO)
  onSelect: (slot: { start: string, end: string }) => void

Behavior:
  - Fetches GET /api/crm/appointments/slots?date=X&staffId=Y&duration=Z
  - Groups slots: morning (before 12) / afternoon (12+)
  - Renders pill buttons for each slot time
  - Selected slot: accent bg

Shows loading state, empty state ("No available slots"), and prompt state ("Select staff and date").
```

### 7. View panel (inline in AppointmentsClient)

Not a separate component — it's simple enough to inline.

```
Shows:
  - Title (h2)
  - Date: "Thursday, April 16"
  - Time: "10:00 AM – 10:30 AM"
  - Client: name (linked to /crm/clients/[id]) or "Walk-in"
  - Status badge
  - Notes (if any)
  - Action buttons based on status:
    scheduled → [Confirm] [Cancel]
    confirmed → [Complete] [No Show] [Cancel]
    completed/cancelled/no_show → no actions
  - Close button (×)

Actions: PATCH /api/crm/appointments/[id] with { status } → toast → refetch → close panel
```

### 8. Create panel (inline in AppointmentsClient)

```
Form fields:
  - Title (text input, required)
  - Client (ClientPicker button → modal → selected name display)
  - Staff (StaffPicker, required for slot lookup)
  - Date (pre-filled from slot click, or date input)
  - Time slot (TimeSlotPicker, appears after staff + date selected)
  - Notes (textarea, optional)
  - [Create Appointment] button

Submit: POST /api/crm/appointments → toast → refetch → close panel
```

---

## Done criteria

- [ ] `/crm/appointments` shows a week calendar with real data from DB
- [ ] Events render at correct positions with status colors
- [ ] Can navigate weeks (prev/next/today)
- [ ] Can filter by staff member
- [ ] Can click event → view details + change status
- [ ] Can click empty slot → create appointment with pre-filled date/hour
- [ ] Can click "+ New" → create appointment with date picker
- [ ] Client search works via existing ClientPicker
- [ ] Time slots load from existing slots API
- [ ] Toast feedback on create/update
- [ ] All API calls use existing routes (no new CRUD routes needed)
- [ ] TypeScript compiles clean
- [ ] Follows CRM CSS var pattern (no raw Tailwind colors)

---

## Out of scope (handled by other specs)

- Appointment types/durations config (admin spec §5.4 — settings feature)
- Appointment reminders via Klaviyo (CRM spec §10.6 — messaging feature)
- Booking system integration (V2)
- Mobile/tablet view (V2)
