# Interactive Calendar — Design

Based on spec `08-appointments-spec.md` §7. Focuses on making the existing WeekCalendar fully interactive.

## Current State
- Week view with hour grid, day columns, event blocks
- Click empty slot → opens create panel
- Click event → opens view panel
- Staff filter + location filter
- No drag-and-drop, no resize, no inline create

## Target State

### 1. Click-to-create (quick create)
- Click any empty slot → popover appears at click position (not side panel)
- Popover: title input, client search, service dropdown, auto-filled time/staff/location
- One-click create, no multi-step wizard for quick bookings
- Pressing Enter in title field creates immediately

### 2. Drag-to-create
- Click and drag vertically on an empty column to select a time range
- Shows a ghost block while dragging with the time range
- On release → same quick-create popover with the time range pre-filled

### 3. Drag-to-reschedule
- Grab an existing event block → drag to a new time slot (same day or different day)
- Ghost block follows cursor, original stays dimmed
- On drop → confirmation toast: "Moved to Thu 2:00 PM" with Undo button
- Validates conflicts before applying

### 4. Resize to change duration
- Bottom edge of event blocks has a resize handle (cursor changes)
- Drag down to extend, up to shorten
- Snaps to 15-minute increments
- On release → updates end time, shows toast

### 5. Visual improvements
- Current time indicator (red horizontal line across all columns)
- Half-hour gridlines (lighter than hour lines)
- Hover state on empty slots (subtle highlight)
- Event blocks show time range, not just title
- Status indicated by left border style per spec §7.2

### 6. Implementation approach
- Use native pointer events (pointerdown/move/up) for drag — no library needed
- Track drag state: `{ type: 'move'|'resize'|'create', eventId?, startY, startTime, currentTime }`
- Ghost rendering via absolute-positioned div following pointer
- 15-minute snap: round to nearest 15min based on Y position
- Conflict check: client-side first (instant feedback), server-side on commit
- Optimistic updates with rollback on server error

### 7. Data flow
- All mutations go through existing PATCH /api/crm/appointments/[id]
- Create goes through POST /api/crm/appointments
- After mutation → refetch events for the week
- Toast with undo for drag operations (undo = PATCH back to original time)
