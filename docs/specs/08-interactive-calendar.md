# Spec 08: Interactive Appointments Calendar

**Status:** IMPLEMENTED
**Dependencies:** Spec 01 (base calendar), Spec 02 (roles/permissions)
**Source:** `data/08-appointments-spec.md` §7 (Internal Calendar)
**Permissions used:** org:appointments:read, org:appointments:create, org:appointments:update

---

## What exists today

### WeekCalendar (`src/components/crm/WeekCalendar.tsx`)
- Week view with hour grid (9AM–8PM), 7 day columns, 64px per hour
- Event blocks positioned absolutely by start/end time
- Click empty slot → fires `onSlotClick(date, hour)`
- Click event → fires `onEventClick(event)`
- Week navigation (prev/next/today)
- Current time indicator (red line on today's column)
- Half-hour dashed gridlines
- Status indicated by left border color

### AppointmentsClient (`src/app/crm/appointments/AppointmentsClient.tsx`)
- Staff filter + location filter dropdowns
- Side panel for viewing/creating appointments
- Fetches events via `GET /api/crm/appointments?week=X&staffId=Y&locationId=Z`
- Creates via `POST /api/crm/appointments`
- Status changes via `PATCH /api/crm/appointments/[id]`

### API routes (all working)
| Route | Method | What it does |
|---|---|---|
| `GET /api/crm/appointments` | GET | Week query with staff/location/status filters |
| `POST /api/crm/appointments` | POST | Create with overlap check + audit |
| `PATCH /api/crm/appointments/[id]` | PATCH | Update fields, status transitions, overlap check |
| `GET /api/crm/appointments/slots` | GET | Available 30-min slots for date+staff |

---

## What was built (this spec)

### 1. Drag-to-create

**Interaction:** Click and drag vertically on an empty column to select a time range.

```
Pointer events:
  pointerdown on empty slot → start drag { type: 'create', dayIdx, startY, currentY }
  pointermove → update currentY
  pointerup → if distance > 10px: fire onQuickCreate(start, end)
              if distance < 10px: fire onSlotClick(date, hour) (simple click)

Visual:
  Ghost block appears during drag:
  - Absolute positioned in the day column
  - top = min(startY, currentY), height = abs(currentY - startY)
  - Background: var(--crm-text-primary) at 10% opacity
  - Dashed border
  - Shows time range text: "2:00 PM – 2:45 PM"

Time snapping:
  All Y positions snap to 15-minute increments
  yToTime(y, dayDate) → converts pixel Y to a Date with snapped hours/minutes
```

**Wiring in AppointmentsClient:**
`onQuickCreate` opens the create panel with the time range pre-filled.

### 2. Drag-to-move (reschedule)

**Interaction:** Grab an existing event block and drag to a new time/day.

```
Pointer events:
  pointerdown on event → start drag { type: 'move', eventId, dayIdx, offsetY, origStart, origEnd }
  pointermove → update currentDayIdx (from data-day-col attribute), currentY
  pointerup → compute newStart from (currentY - offsetY), preserve duration
              if changed: fire onEventMove(eventId, newStart, newEnd)

Visual:
  - Original event: opacity 0.7 during drag, follows cursor position
  - Ghost block in target column: var(--crm-text-primary) at 15% opacity, shows new time
  - Cursor: 'grabbing' during drag, 'grab' on hover

Cross-day:
  data-day-col={dayIdx} attribute on each column div
  pointermove reads the closest [data-day-col] to determine target day
```

**Wiring in AppointmentsClient:**
```ts
onEventMove={async (id, newStart, newEnd) => {
  PATCH /api/crm/appointments/{id} { startsAt, endsAt }
  if ok → toast('Appointment moved') + refetch
  if conflict → toast('Conflict — could not move', 'error')
}}
```

### 3. Resize (change duration)

**Interaction:** Drag the bottom edge of an event to extend or shorten.

```
Pointer events:
  pointerdown on resize handle (6px tall div at bottom of event) → { type: 'resize', eventId, currentY, origEnd }
  pointermove → update currentY
  pointerup → compute newEnd from currentY, validate newEnd > startsAt
              fire onEventResize(eventId, newEnd)

Visual:
  - Resize handle: invisible 6px div at bottom, cursor: 's-resize'
  - During resize: event height follows cursor, opacity 0.7
  - Snaps to 15-minute increments

Constraint:
  Minimum height = 24px (~6 minutes visual, but snaps to 15min)
  newEnd must be > startsAt
```

**Wiring in AppointmentsClient:**
```ts
onEventResize={async (id, newEnd) => {
  PATCH /api/crm/appointments/{id} { endsAt }
  if ok → toast('Duration updated') + refetch
}}
```

### 4. Current time indicator

```
State: now (Date), updated every 60 seconds via setInterval
Position: ((now.hours * 60 + now.minutes - HOUR_START * 60) / 60) * HOUR_PX
Render: red 2px horizontal line + 8px red dot at left edge
Only shown: if current time is within HOUR_START–HOUR_END and on today's column
```

### 5. Event block rendering

```
Position:
  top = ((startHour - HOUR_START) * 60 + startMinutes) / 60 * HOUR_PX
  height = max(durationMinutes / 60 * HOUR_PX, 24)

Content (height-dependent):
  Always: title (bold, truncated)
  > 28px: time range "2:00 PM – 2:30 PM"
  > 44px: customer name

Style:
  background: var(--crm-surface)
  border: 1px solid var(--crm-border-light)
  borderLeft: 3px solid {status color}
  Cancelled: opacity 0.4, text-decoration line-through

Status border colors:
  scheduled → var(--crm-text-tertiary)
  confirmed → var(--crm-text-primary)
  completed → var(--crm-text-primary)
  cancelled → var(--crm-text-tertiary)
  no_show   → var(--crm-text-tertiary)
```

### 6. Location filter

Added to AppointmentsClient alongside staff filter:
```
<select> All locations / Location A / Location B </select>
Passes locationId to GET /api/crm/appointments query
```

### 7. View panel enhancements

When clicking an appointment, the side panel now shows:
- When (date + time range)
- Client (linked to profile)
- Status (badge)
- Location (resolved name from locations table)
- Notes
- Action buttons (Confirm, Complete, No Show, Cancel — context-dependent)

---

## CalendarEvent type

```ts
interface CalendarEvent {
  id: string;
  title: string;
  customerName: string | null;
  customerId: string | null;
  status: string;
  startsAt: string;   // ISO
  endsAt: string;     // ISO
  staffId: string | null;
  locationId?: string | null;
  notes?: string | null;
}
```

---

## WeekCalendar props

```ts
interface Props {
  weekStart: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onSlotClick: (date: Date, hour: number) => void;
  onWeekChange: (direction: 'prev' | 'next' | 'today') => void;
  onEventMove?: (eventId: string, newStart: Date, newEnd: Date) => void;
  onEventResize?: (eventId: string, newEnd: Date) => void;
  onQuickCreate?: (start: Date, end: Date) => void;
}
```

All drag callbacks are optional — if not provided, the corresponding interaction is disabled. This keeps the component reusable in read-only contexts.

---

## Constants

```ts
HOUR_START = 9      // first visible hour
HOUR_END = 20       // last visible hour (exclusive)
HOUR_PX = 64        // pixels per hour
SNAP_MIN = 15       // snap grid in minutes
```

---

## Files modified

| File | Change |
|---|---|
| `src/components/crm/WeekCalendar.tsx` | Full rebuild with drag interactions |
| `src/app/crm/appointments/AppointmentsClient.tsx` | Wired onEventMove, onEventResize, onQuickCreate; added location filter |
| `src/app/crm/appointments/page.tsx` | Events now include locationId + notes |

---

## Not in scope (deferred to future specs)

Per `08-appointments-spec.md`:
- Staff lanes (split by staff member) — §7.2
- Multi-location column view — §7.1
- Today view (`/crm/appointments/today`) — §7.6
- Check-in / check-out flow — §7.7
- Bump (slide N appointments forward) — §7.8
- Conflict detection on drag (currently server-side only) — could add client-side pre-check
- Undo on drag operations — toast with undo button
