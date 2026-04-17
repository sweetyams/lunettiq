# Spec 08: Appointments — Booking, Calendar, CRM, Notifications

**Status:** DRAFT — ready for review
**Supersedes:** Spec 01 (appointments calendar) — extends it to full booking system
**Depends on:** Spec 02 + 07 (roles, permissions), Spec 07 (Klaviyo messaging, consent model), existing CRM data model
**Last updated:** April 2026

---

## 0. What this spec covers

A full appointments system with four surfaces:

1. **Client-facing booking flow** — public web, conversion-optimized, mobile-first
2. **Internal calendar CMS** — staff schedule view, drag-and-drop, conflict handling
3. **Client appointment management** — booked clients can reschedule, add to calendar, complete intake, receive reminders
4. **Notification pipeline** — email + SMS, per-customer consent, bilingual, branded

Plus the parts that tie them together: multi-location routing, service catalogue, staff availability rules, intake forms, post-appointment CRM follow-up, and the reporting layer that makes no-shows and booking conversion measurable.

References studied: BonLook (location-scoped booking, optometrist/optician split), Warby Parker (tiered exam types with duration/price upfront, pre-filled intake form, insurance at booking). Lunettiq will lean closer to BonLook operationally but with Warby's intake polish.

---

## Contents

1. [Principles](#1-principles)
2. [Service catalogue and staff mapping](#2-service-catalogue-and-staff-mapping)
3. [Availability model](#3-availability-model)
4. [Data model](#4-data-model)
5. [Booking flow — client-facing](#5-booking-flow--client-facing)
6. [Client appointment management](#6-client-appointment-management)
7. [Internal calendar](#7-internal-calendar)
8. [Notifications](#8-notifications)
9. [Intake forms](#9-intake-forms)
10. [Post-appointment CRM follow-up](#10-post-appointment-crm-follow-up)
11. [No-show and late policy](#11-no-show-and-late-policy)
12. [Reporting](#12-reporting)
13. [APIs](#13-apis)
14. [Permissions](#14-permissions)
15. [Tech stack](#15-tech-stack)
16. [V1 scope / later](#16-v1-scope--later)
17. [Open decisions](#17-open-decisions)

---

## 1. Principles

- **Two taps to book.** From the "Book appointment" link on the storefront, a returning client should land on a confirmed slot in two decisions. Service first, then time. Everything else pre-fills.
- **Location is not a detour.** If the client is already in a location context (came from the Plateau store page), skip the location selector.
- **Staff are people, not resources.** A returning client books Emma, not "Associate 2." Show photos, names, and specialties. Staff preference persists across bookings.
- **Clinical and styling are different services.** Eye exams (optometrist) and fittings (stylist/optician) have different durations, different staff pools, different intake requirements, different reminders. Don't force them into one template.
- **Consent drives channel.** If a client opted out of SMS, reminders go by email. If they opted out of email, SMS. If both, the client still gets a single transactional confirmation (legally permitted) and then no marketing reminders — only an at-the-door status update.
- **Every booking is an audit-safe event.** Created, rescheduled, cancelled, completed, no-show. All stamped with actor, surface, reason, location, timestamp.
- **The CRM is the source of truth.** Calendar views are projections. Storefront booking posts to CRM API, not a third-party system. No divergence.

---

## 2. Service catalogue and staff mapping

### 2.1 Service types (V1)

| Service | Duration | Staff role required | Buffer (before/after) | Price | Bookable online |
|---|---|---|---|---|---|
| Comprehensive eye exam | 30 min | optician + optometrist on site | 5 / 10 | $95 (covered by RAMQ where applicable) | ✅ |
| Contact lens fitting | 45 min | optometrist | 5 / 10 | $125 | ✅ |
| Quick vision check | 15 min | optometrist | 0 / 5 | $45 | ✅ |
| Styling session (with stylist) | 45 min | sales associate or stylist | 10 / 10 | free · members priority | ✅ |
| Frame fitting + adjustment | 20 min | any staff | 5 / 5 | free | ✅ |
| Second Sight intake | 30 min | sales associate | 10 / 10 | n/a | ✅ |
| Custom design consultation | 60 min | owner or senior stylist | 15 / 15 | free · by invite | ❌ (staff-initiated only) |
| Collection preview (CULT/VAULT) | 60 min | owner or senior stylist | 15 / 15 | free · members only | ✅ (tier-gated) |

Services are configured at `/settings/business/appointments` by the owner. Each service has:

```ts
{
  id: string;
  name: { en: string; fr: string };
  description: { en: string; fr: string };
  duration_minutes: number;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  required_staff_role: 'optometrist' | 'optician' | 'stylist' | 'sa' | 'any';
  required_permission: string | null;
  price: number | null;
  price_note: { en: string; fr: string } | null;
  online_bookable: boolean;
  member_tier_required: 'essential' | 'cult' | 'vault' | null;
  locations_offering: string[];   // location IDs where this service is available
  intake_form_id: string | null;
  reminder_template_id: string;
  confirmation_template_id: string;
  post_appointment_template_id: string | null;
  active: boolean;
}
```

Bilingual copy (French/English) is mandatory from day one given the Montreal base.

### 2.2 Location offering

A service is only bookable at locations that explicitly offer it. Plateau might offer all eight services, DIX30 might only offer fittings and styling (no optometrist on staff). This is exactly how BonLook handles it — their Square One and Notre-Dame locations offer exams, others don't.

The location page shows only services actually available there. If a client tries to deep-link to a service not offered at their current location, they get a redirect to locations that do offer it.

### 2.3 Staff can offer multiple services

A staff member is tagged with their role capabilities:

```ts
staff.service_capabilities = ['frame_fitting', 'styling_session', 'second_sight_intake']
```

Managers and owners configure this at `/settings/staff/[id]/services`. The booking flow filters available staff based on the service picked.

---

## 3. Availability model

### 3.1 Hours of operation

Each location has weekly operating hours, configurable at `/settings/locations/[id]`:

```
Monday    10:00 – 19:00
Tuesday   10:00 – 19:00
Wednesday 10:00 – 19:00
Thursday  10:00 – 20:00
Friday    10:00 – 20:00
Saturday  10:00 – 18:00
Sunday    closed
```

Plus exception dates: public holidays, seasonal closures, special events. Exceptions override the weekly pattern.

### 3.2 Staff schedules

Each staff member has their own weekly availability, independent of location hours. An optometrist might only be at Plateau on Tuesdays and Thursdays. A stylist might work Wednesday–Sunday.

```
staff_schedules table:
  staff_id, location_id, day_of_week, start_time, end_time, effective_from, effective_until
```

Staff can also set:
- **Time off** (vacation, sick) — blocks all bookings
- **Personal blocks** (lunch, admin time, recurring meetings) — blocks specific windows
- **Booking buffers** — a staff member can say "minimum 2 hours notice" or "no bookings in the last hour of my shift"

### 3.3 Slot generation

At any given moment, a slot is available if **all** of these are true:

- The location is open
- A qualified staff member is scheduled
- No existing appointment conflicts (including buffers)
- No exception, time off, or personal block overlaps
- The slot is at least `minimum_notice_hours` in the future (service-configurable, default 2h)
- The slot is within `booking_window_days` from now (default 60)

Slots snap to a configurable grid (default 15 minutes — fittings fit a 15min grid, exams fit a 30min grid, longer services round up).

### 3.4 The Emma constraint

Returning clients who picked Emma last time will see Emma's availability first. If Emma is booked solid, the UI offers: (a) wait for Emma's next slot, (b) see other stylists. This small move drives strong preference stickiness — the relational capital Lunettiq cares about.

---

## 4. Data model

Extending the existing `appointments` table from Spec 01.

### 4.1 `appointments` — extended

```ts
appointments {
  id                    uuid PK
  shopify_customer_id   text                    // null for walk-ins being booked at the desk
  walk_in_name          text                    // for unknown clients
  walk_in_email         text
  walk_in_phone         text

  service_id            text                    // FK to services
  location_id           text                    // FK to locations

  staff_id              text                    // assigned staff (can be null = "any")
  preferred_staff_id    text                    // client's wish; staff_id may differ if reassigned

  starts_at             timestamp with tz
  ends_at               timestamp with tz
  buffer_starts_at      timestamp with tz       // derived, stored for fast conflict query
  buffer_ends_at        timestamp with tz

  status                enum                    // requested, scheduled, confirmed,
                                                // checked_in, completed, cancelled,
                                                // no_show, rescheduled
  reason                text                    // visit reason — free text client fills
  internal_notes        text                    // staff-only

  booking_source        enum                    // storefront, crm_web, tablet, phone_call,
                                                // walk_in, klaviyo_rebook
  booked_by_staff_id    text                    // if booked on behalf

  intake_form_id        text                    // FK
  intake_completed_at   timestamp with tz
  intake_payload        jsonb

  confirmation_sent_at  timestamp with tz
  reminders_sent        jsonb                   // array of {channel, template, sent_at}

  cancel_reason         text
  cancelled_at          timestamp with tz
  cancelled_by          text                    // customer | staff id

  rescheduled_from_id   uuid                    // links to previous appointment
  rescheduled_to_id     uuid

  checkin_at            timestamp with tz
  checkout_at           timestamp with tz

  outcome_tag           enum                    // purchased, prescription_updated,
                                                // recommendations_made, follow_up_needed,
                                                // no_engagement
  outcome_notes         text
  follow_up_due_at      timestamp with tz       // if outcome = follow_up_needed

  external_calendar_event_id text               // Google Calendar sync, V2
  created_at            timestamp
  updated_at            timestamp

  Indexes:
    (staff_id, starts_at)    // staff calendar query
    (location_id, starts_at) // location calendar query
    (shopify_customer_id)    // client profile query
    (status, starts_at)      // upcoming appointments query
    (buffer_starts_at, buffer_ends_at) // conflict detection
}
```

### 4.2 Supporting tables

```ts
services (see §2.1)
service_locations { service_id, location_id }     // many-to-many
staff_service_capabilities { staff_id, service_id }

staff_schedules {
  staff_id, location_id, day_of_week (0-6),
  start_time, end_time, effective_from, effective_until
}

staff_time_off {
  staff_id, starts_at, ends_at, reason, approved_by_staff_id
}

staff_blocks {
  staff_id, recurring (bool), day_of_week, start_time, end_time,
  starts_at, ends_at,  // for one-offs
  reason  // 'lunch', 'admin', 'training'
}

location_hours {
  location_id, day_of_week, open_time, close_time
}

location_exceptions {
  location_id, date, open_time, close_time, note
}

appointment_reminders_scheduled {
  appointment_id, channel, template_id, send_at, status
}

intake_forms (see §9)
intake_form_fields
```

---

## 5. Booking flow — client-facing

### 5.1 Entry points

| Where | Context preloaded |
|---|---|
| `/book` | Nothing — full flow with service + location selector |
| `/locations/plateau/book` | Location preset to Plateau |
| `/services/eye-exam/book` | Service preset |
| `/locations/plateau/book?service=styling&staff=emma` | Everything preset — one-screen booking |
| Klaviyo "rebook" email | Service + location + (optionally) staff preset |
| Storefront nav "Book appointment" | Full flow |
| Post-purchase thank-you page | Contextual suggestion: "Book your fitting to finalize your lenses" |

### 5.2 Step-by-step (default flow)

**Step 1 — Service.** Card grid of available services. Each card shows:
- Name, duration, price, one-sentence description
- "What happens in this appointment" details (expandable)
- Member tier badge if applicable (CULT/VAULT only)

Selected card highlights. Next button activates.

**Step 2 — Location** (skipped if preset). Map view + list. Shows:
- Location name, address, hours today, phone
- Which services are offered there (the one picked is checked)
- Distance from current location (with permission)
- Photo of storefront

**Step 3 — Staff** (optional). "Anyone available" is the default CTA. Secondary: "Choose a stylist."

If expanded, shows cards with: photo, name, role (Optometrist, Senior Stylist, etc.), short bio (2 sentences — "Emma specializes in rimless and titanium frames. French / English."), and next-available date.

For returning clients who previously booked with someone, that person's card is auto-flagged with "Your last stylist" and pre-selected.

**Step 4 — Time.** Calendar with available days highlighted. Click a day → time slots appear grouped by morning / afternoon / evening. Each slot is a button.

Mobile behaviour: horizontal date scroller with sticky header. 7 days visible at a time. Swipe for later weeks.

Slots that would require a different staff member (if "anyone" was chosen) are subtly labelled: "10:00 – with Thomas." The flexibility is transparent.

**Step 5 — Your details.** If logged in, all pre-filled from Shopify Customer Account. If guest:
- First name, last name (required)
- Email (required, with consent checkbox)
- Phone (required for SMS confirmation; separate SMS consent checkbox)
- Reason for visit (dropdown: new glasses, renewing Rx, eye concern, styling advice, other + free text)
- Anything we should know (free text, optional)

Insurance checkbox (eye exam only): "I have RAMQ coverage" / "I have private insurance" / "Paying out of pocket." If private insurance: two fields for provider and member ID — captured but not validated in V1.

**Step 6 — Confirm.** One-screen summary. Edit any field inline. Primary CTA: "Confirm booking."

Micro-copy under the button: "You'll receive a confirmation by email and SMS within a minute. Free to reschedule up to 12 hours before your appointment."

### 5.3 Logged-in shortcut

For returning clients in a Shopify Customer Accounts session, offer a single-screen express flow: Service + Time + Staff (if preferred last time) in one scrollable view, everything else auto-filled. Three taps to confirm.

### 5.4 Empty states

If no slots available in the selected week: show next available date prominently, with "Join the waitlist" as a secondary option.

**Waitlist** (V2 in spec, V1 worth building): client gets notified if an earlier slot opens up. Stored in `appointment_waitlist` with customer, service, location, preferred staff, preferred date range, created_at.

### 5.5 Tier-gated services

If a service requires CULT or VAULT membership and the logged-out user tries to book it: show a membership-aware gate. "Collection preview is a CULT member perk. Log in or become a member to book." Don't hide it — hiding perks kills the loyalty signal.

### 5.6 Conversion details that matter

- Service card grid, not a dropdown. Rare exception for mobile where grid becomes a vertical stack.
- No account required to book. Account creation is offered as a checkbox after confirmation: "Save your details for faster rebooking" — opt-in, not forced.
- Next available today/tomorrow is surfaced before the full calendar. Most clients book within 7 days.
- Progress indicator across the top (5 dots). Back navigation preserves state.
- Cancel within 12h cutoff shown at confirmation. Set expectations early.

---

## 6. Client appointment management

### 6.1 Confirmation page

After booking, the client lands on a confirmation page with:

- Appointment summary card (service, date, time, location, staff, address)
- Map of location with "Get directions" link
- Add to calendar (ICS download + Google Calendar + Apple Calendar deep links)
- Modify or cancel buttons
- Contextual content: "While you wait, browse our archive" / "Here are 3 frames we'd suggest based on your reason for visit"
- Upsell (soft): "Book a companion styling session" if the exam was the primary booking

### 6.2 Manage link

Every confirmation email and SMS includes a secure per-appointment URL: `lunettiq.com/appointments/[token]`. Token is signed + scoped to this appointment only.

The page shows:
- Current appointment details
- Reschedule button → opens the time-picker flow, preserving service/location/staff
- Cancel button → confirms reason
- Add to calendar
- Intake form (if not yet completed) — prominently shown
- Contact the location directly (phone, email)
- Prepare for your visit (checklist: bring insurance card, current glasses, Rx from previous optometrist if applicable)

For logged-in clients, the same surface exists at `/account/appointments`, showing upcoming and past appointments.

### 6.3 Reschedule rules

- Self-service reschedule allowed up to **12 hours before** the appointment (service-configurable)
- After 12h: "Contact us to reschedule" with a click-to-call and click-to-email
- Rescheduling creates a new appointment and links via `rescheduled_from_id` / `rescheduled_to_id`. The original stays in the DB with status = `rescheduled`.
- Rescheduled appointments inherit the intake form completion state (no need to re-fill)
- Reschedule audit trail: who changed it, when, old slot, new slot

### 6.4 Cancel flow

Simple 2-step: confirm intention, optional reason (dropdown: conflict came up, no longer needed, illness, other + free text). No punishment for cancelling. If a client cancels 3+ times in 90 days, the system flags for staff review but doesn't block — the flag is data, not enforcement.

---

## 7. Internal calendar

Extends Spec 01's week calendar. Not redescribed here; the additions:

### 7.1 Multi-location view

Top-level filter: single location, multiple locations (stack columns), all locations (grid view with mini calendars per location).

For an owner with 3 locations, the default is a 3-column overview showing today at each location.

### 7.2 Staff lanes

Within a location, the week view can split by staff lanes (vertical strip per staff member × day). Useful when 4–5 staff work simultaneously. Toggle: "Combined / Split by staff."

Each lane colour-less (per the B/W design decision) but uses left border width to encode status:
- Solid border: confirmed
- Dashed border: requested (not yet confirmed by staff)
- 2px border: checked in
- Hatched fill: completed
- Strikethrough: cancelled

### 7.3 Drag-and-drop rescheduling

Staff can drag an appointment to a new slot. Drop zone validates (availability, qualified staff, buffers). On drop:
- Confirmation modal: "Reschedule Marie's exam from Thu 10:00 to Fri 14:00?"
- Optional: "Notify client by their preferred channel" (checked by default)
- Confirm → DB update + audit + Klaviyo trigger

Conflicts (accidental double-booking) are refused with a red flash and explanation.

### 7.4 Quick-create appointment

Click an empty slot → popover with:
- Client picker (search existing, or create new inline)
- Service dropdown
- Staff (defaults to the lane)
- Reason
- Auto-notify checkbox

One-shot create, no modal wizard.

### 7.5 Appointment detail panel

Click any appointment → side panel slides in (same pattern as Spec 01):

Panel content:
- Client card (name, tier badge, link to full profile)
- Service, duration, price
- Status + action buttons appropriate to status (see §11)
- Staff assigned (with reassign option)
- Visit reason (from client)
- Intake form status — if incomplete, "Send reminder" button
- Internal notes (staff-only, rich text)
- Notification log: "Confirmation email sent 2 min ago. SMS confirmation delivered. Reminder scheduled 24h before."
- Reschedule / Cancel / Mark no-show / Mark completed buttons
- Previous appointments with this client (compact list, last 3)

### 7.6 Today view

Separate top-level view at `/crm/appointments/today`:

```
┌─────────────────────────────────────────────────┐
│ Today · Apr 17 · Plateau (4) · DIX30 (2)        │
├─────────────────────────────────────────────────┤
│ 09:30  Marie Dubois       Styling       Emma    │
│        checked in 3m ago                         │
│                                                  │
│ 10:00  Thomas Lefèvre     Eye exam      Benjamin │
│        arrived — waiting                         │
│                                                  │
│ 10:30  Walk-in: Sophie G. Fitting       Any     │
│        no intake yet                             │
└─────────────────────────────────────────────────┘
```

Status chips: arrived, waiting, in-session, completed, ran-over. Each updated live.

### 7.7 Check-in / check-out

Staff flow at the desk:

- Client arrives → tap "Arrived" on the appointment → status → `checked_in`, timestamp stored
- Session starts → (optional) tap "Started" for wait-time analytics
- Session ends → tap "Complete" → prompt for outcome tag + notes (see §10)

Running late detection: if `starts_at` + 10 minutes passes without check-in, appointment enters "running late" state. Reminder can fire to client via SMS ("Running late? No worries — let us know") — opt-in per location.

### 7.8 Conflict and double-book handling

The booking system prevents conflicts at creation. But edge cases exist:
- Staff member calls in sick — their day needs to be reassigned or rescheduled
- Walk-in takes 45 minutes when booked for 20 — the next appointment is pushed

Staff sees a "Bump" action on appointments: slide the next N appointments forward by X minutes, with auto-notify clients.

---

## 8. Notifications

### 8.1 Channels and consent

Every notification respects the consent model from Spec 07 §10:

- `emailMarketingConsent = true` → email reminders OK
- `custom.marketing_consent_sms = true` → SMS reminders OK
- `custom.do_not_contact = true` → transactional confirmations only
- Neither consent → transactional confirmation only (legally permitted for booked appointments)

Transactional messages (booking confirmation, cancellation notice) always send — they're service-of-contract, not marketing. Canadian CASL permits this.

Reminders and follow-ups check consent. The client's preferences at booking also matter: at the detail-capture step, they choose "How should we remind you?" — email / SMS / both / none.

### 8.2 Message schedule

For a booked appointment, these fire automatically:

| When | Channel | Template | Fires if |
|---|---|---|---|
| On booking confirmation | email + SMS | `appt_confirmation` | Always (transactional) |
| Booking + 1 min | email | `appt_intake_form_request` | Service has intake form, not yet filled |
| 72h before appointment | email | `appt_72h_reminder` | Service duration ≥ 30min and client email consent |
| 24h before appointment | SMS | `appt_24h_sms_reminder` | SMS consent |
| 24h before appointment | email | `appt_24h_email_reminder` | No SMS consent but email consent |
| 2h before appointment | SMS | `appt_2h_final_reminder` | SMS consent, service duration ≥ 30min |
| On check-in | — | — | No notification, just state change |
| Post-appointment + 2h | email | `appt_thank_you_and_next` | Email consent |
| Post-appointment + 3d | email | `appt_feedback_request` | Email consent, outcome = completed |
| Post-appointment + 30d (or at service-specific interval) | email | `appt_rebook_nudge` | Email consent, outcome relevant (e.g., Rx renewal due) |

Rules respected:
- No SMS between 9pm and 9am local time (deferred to next morning)
- French / English based on customer's language preference (default FR in Montreal)
- Transactional messages always send regardless of quiet hours

### 8.3 Template content

All templates are bilingual, brand-styled, and editable in Klaviyo. The CRM stores a reference to the template ID; Klaviyo stores the content.

**Example — confirmation email (EN):**

```
Subject: Your appointment at Lunettiq Plateau is confirmed

Hi [First name],

You're booked in with Emma for a styling session on
Thursday April 17 at 2:00pm.

Location: Lunettiq Plateau
          1234 Saint-Denis, Montréal H2J 2T8

We'll send you a reminder 24 hours before.

Manage your appointment: [short URL]
Add to your calendar: [ICS link]

See you soon,
The Lunettiq team
```

Tone is calm and brand-voiced. No emoji. No marketing cross-sell in transactional messages. The "manage" link drops straight into §6.2.

**Example — 2h SMS:**

```
Hi Marie — your Lunettiq styling session with Emma is at 2pm today at Plateau. Running late? Reply LATE.
Reschedule: l.nqq.co/abc123
```

160-char budget respected. Replies go to an inbox (§8.5).

### 8.4 Scheduling engine

Inngest handles scheduled sends. On appointment creation:

1. `scheduleReminders(appointmentId)` job runs immediately
2. It inserts rows into `appointment_reminders_scheduled` with `send_at` timestamps
3. A cron job runs every minute, picks up rows due in the next minute, fires Klaviyo API
4. On fire, row status becomes `sent` with a log entry

On cancel or reschedule:
- All future scheduled reminders for the old appointment are marked `cancelled`
- New reminders are scheduled for the new slot (if rescheduled)

On failure (Klaviyo down, invalid email): retry 3 times with exponential backoff, then log to `notification_failures` for staff review.

### 8.5 Inbound messages

SMS replies and email replies route back into the CRM as interactions on the client profile. V1: replies create an unread notification for the assigned staff member. V2: full inbox UI.

Keywords handled automatically:
- `STOP` or `UNSUBSCRIBE` → opts out of SMS marketing, still receives transactional
- `LATE` → flags appointment as "client running late," alerts staff
- `CANCEL` → triggers cancel confirmation flow (reply `YES CANCEL` to confirm)
- `RESCHEDULE` → replies with the manage URL

### 8.6 Staff-side notifications

Staff get notified in the CRM (not email) when:
- A booking comes in for one of their appointments (real-time)
- A client reschedules their upcoming appointment
- A client cancels with less than 12h notice
- A client marked "running late"
- A client replied to an SMS

Notification centre lives in the CRM header as a bell icon. No email spam to staff — they're on the system all day.

---

## 9. Intake forms

### 9.1 Purpose

Cuts in-person paperwork time. Warby Parker's research: pre-filled intake saves ~10 minutes per appointment. For eye exams specifically, this is material.

### 9.2 Form types (V1)

| Form | Used by | Fields |
|---|---|---|
| Eye exam intake | Comprehensive eye exam, Quick vision check, Contact lens fitting | Medical history (Y/N for common conditions), medications, last eye exam date, current Rx if known, specific concerns, insurance card upload, RAMQ number if applicable |
| Styling brief | Styling session, Collection preview | What you're looking for (new pair / replacement / second pair), daily environment (office / outdoor / mixed), face shape quiz (optional), style direction (5 sample looks to rank), budget band, must-have features |
| Second Sight intake | Second Sight intake | Photos of frames being traded in, purchase year if known, condition self-assessment |

### 9.3 Form behaviour

- Emailed to the client 1 minute after booking (transactional)
- Linked in the manage-appointment page
- Auto-saves on every field change (no lost progress)
- On submit, payload stored as `intake_payload` JSONB on the appointment
- Staff see a "Completed" badge on the appointment and can review the intake in the detail panel
- If the form isn't completed 24h before, a reminder email goes out ("Save 10 minutes at your appointment — fill this in now")
- If still not completed at appointment time, the client can fill it at the desk on a tablet

### 9.4 Clinical data handling

The eye exam intake includes medical information. This is sensitive under Quebec Law 25. Rules:

- Stored encrypted at rest in the CRM DB
- Access gated by `org:rx:read` permission (optometricians have this; stylists don't)
- Retention: 7 years per medical record regulation (Spec 07 §7.2)
- On customer data deletion request: Rx data has a documented retention requirement and is not deleted with the rest of the profile (customer is informed at the request point)

### 9.5 Form builder (V2)

V1 ships with the three forms above, hardcoded. V2 allows the owner to build custom forms via a simple drag-and-drop editor at `/settings/business/intake-forms`.

---

## 10. Post-appointment CRM follow-up

Every completed appointment becomes a chapter in the client's story. Follow-up is not optional — it's the reason the appointment was worth logging.

### 10.1 Outcome capture

At appointment completion (staff clicks "Mark completed"), a modal opens:

```
How did it go?

Outcome tag (required):
  ○ Purchased
  ○ Prescription updated (no purchase)
  ○ Recommendations made — following up
  ○ Needs follow-up appointment
  ○ No engagement — archive

Outcome notes (optional, rich text, audit logged):
  [                                          ]

Follow-up due date (if applicable):
  [Date picker]

Create follow-up task? [ ] Yes, remind me in [N] days

This appointment added:
  ✓ Completes the intake form on file
  ✓ Records as interaction on Marie's profile
  ✓ Triggers post-appointment email tomorrow
  [Complete appointment]
```

### 10.2 Timeline integration

The completed appointment appears on the client's profile timeline with the outcome tag and notes. Example rendering (using the pattern from Spec 07 §4.5):

```
Apr 17 — Eye exam with Benjamin · prescription updated
         "Sphere right -2.25, left -2.50. Mentioned she's
          been experiencing eye strain at end of day —
          recommended blue-light lenses. Rx PDF on file."
         Outcome: recommendations_made · follow-up due May 1
```

### 10.3 Automatic actions on completion

Depending on outcome tag, the system takes automatic actions:

| Outcome | Automatic actions |
|---|---|
| Purchased | Klaviyo "Post-purchase thank you" event fires. Order links auto-detected and attached. |
| Rx updated | Rx metafield updated, `custom.rx_last_updated` to today, reminder for renewal in 24 months scheduled. |
| Recommendations made | Tag added: `in-recommendation-follow-up`. Follow-up task created for assigned SA for the date specified. Email with recommendations sent (staff can edit before it goes). |
| Needs follow-up | Follow-up appointment booking link sent by email. Task created. |
| No engagement | Tag added: `one-time-visit`. No further action. Logged for analytics. |

### 10.4 Recommendation email

If outcome = "Recommendations made," the system drafts an email to the client including:

- Summary of the appointment in natural language (AI-generated from staff notes + frames discussed)
- 3–5 frame recommendations pulled from the try-on session (if one happened during the appointment)
- A gentle CTA: "Ready to come back and try these on? Book your next visit."

Staff reviews and can edit before sending. V2: auto-send with staff approval workflow.

### 10.5 Follow-up task system

`appointment_follow_ups` table drives the "My follow-ups" panel on the staff dashboard. Each follow-up has:
- Client, appointment reference, due date, status, assigned staff
- Quick actions: mark done, reassign, snooze, log note

If a follow-up is overdue by 3 days, it escalates to the manager's view. Nothing falls through.

---

## 11. No-show and late policy

### 11.1 No-show detection

An appointment auto-transitions to `no_show` status if:
- 20 minutes past `starts_at` with no check-in
- AND staff hasn't manually marked it `running_late` or checked it in

Configurable per service — a styling session might tolerate 30 minutes, an eye exam with a waiting doctor only 10.

### 11.2 On no-show

- Status = `no_show`, timestamp logged
- Client profile gets a `no_show` interaction entry
- Follow-up email fires: "We missed you at your appointment today. Would you like to rebook?" (if consented)
- If 3+ no-shows in 90 days: tag `repeat-no-show` added, flagged for manager review
- No fee in V1. V2 might introduce a hold card for high-demand services (eye exams) — store payment method at booking, charge a no-show fee only if the client no-shows. Common pattern in high-end clinics. Requires legal review.

### 11.3 Running late

If client replies `LATE` to SMS, or staff marks it manually:
- `status = running_late`
- Logged with timestamp
- Next appointment's start is unaffected — staff can decide whether to compress or reschedule

---

## 12. Reporting

### 12.1 Appointments dashboard

At `/crm/appointments/reports`:

**Headline metrics (last 30 days by default):**
- Total appointments booked, by service breakdown
- Show-up rate (completed / booked) — target >85%
- No-show rate — target <10%
- Booking-to-purchase conversion — % of completed appointments that led to an order within 14 days
- Average rescheduling count per appointment
- Booking lead time (median days between booking and appointment)
- Booking source breakdown (storefront / CRM / Klaviyo / walk-in)
- Channel breakdown (email / SMS / both)

**Per-staff metrics:**
- Completed appointments per staff per week
- Conversion rate (staff → purchase within 14 days)
- Average appointment duration actual vs. scheduled
- Client rebooking rate (do Emma's clients come back to Emma?)

**Per-location metrics:**
- Utilization: booked hours / available hours
- Peak times (heatmap)
- Popular services

**Per-service metrics:**
- Volume trend
- Conversion to purchase
- Drop-off (rescheduling, no-show)

### 12.2 AI insights on appointments

Claude surfaces patterns:
- "No-show rate is spiking on Friday evenings" → suggests moving those to a different slot or adding deposits
- "Thomas's styling sessions convert 40% higher than average" → opportunity to promote him more
- "Clients who fill intake forms before arriving spend 28% more" → validate the ROI of intake completion incentives

### 12.3 Exports

All reports exportable as CSV. Daily roll-up emailed to owner if they enable it in `/settings/reports/subscriptions`.

---

## 13. APIs

### 13.1 Public (storefront)

All unauthenticated — rate-limited aggressively.

```
GET  /api/public/services?location_id=X
GET  /api/public/locations
GET  /api/public/availability
     Query: service_id, location_id, staff_id, date_from, date_to
     Returns: array of {start, end, staff_id} slots

POST /api/public/appointments
     Body: { service_id, location_id, staff_id?, starts_at,
             customer: { email, phone, first_name, last_name, ... },
             reason, intake_preferences: {email, sms} }
     Returns: { id, token, confirmation_url }

GET  /api/public/appointments/:token
POST /api/public/appointments/:token/reschedule
POST /api/public/appointments/:token/cancel
POST /api/public/appointments/:token/intake
```

Rate limits: 30 req/min per IP on availability (it's a high-read surface), 5/min on writes.

Spam and bot mitigation: CAPTCHA on booking, honeypot field, email verification for first-time bookers before the slot is held (60 seconds to verify or the slot returns to pool).

### 13.2 Internal (CRM + mobile)

Authenticated via Clerk, permission-gated.

```
GET  /api/crm/appointments                  # list with filters
GET  /api/crm/appointments/[id]
POST /api/crm/appointments                   # staff booking on behalf
PATCH /api/crm/appointments/[id]             # reschedule, reassign, notes
POST /api/crm/appointments/[id]/checkin
POST /api/crm/appointments/[id]/complete
POST /api/crm/appointments/[id]/noshow
POST /api/crm/appointments/[id]/cancel

GET  /api/crm/availability                   # same as public but with internal fields
GET  /api/crm/appointments/today
GET  /api/crm/appointments/follow-ups        # pending follow-ups for current user

POST /api/crm/appointments/bulk-bump        # bump N appointments by X minutes
POST /api/crm/appointments/reassign-day     # reassign all of staff X to staff Y for a day
```

### 13.3 Webhook out

Every appointment state change fires a webhook to:
- Klaviyo (for notifications and event stream)
- Internal audit log
- Optionally Google Calendar (staff calendar sync, V2)

---

## 14. Permissions

New permissions added to Spec 07 §1.4:

```
org:appointments:read              # view appointments (existing)
org:appointments:create            # create (existing)
org:appointments:update            # update (existing)
org:appointments:delete            # delete (existing)
org:appointments:checkin           # new — desk staff only
org:appointments:complete          # new — any staff present
org:appointments:reassign          # new — manager+
org:appointments:bulk_bump         # new — manager+
org:appointments:view_all_staff    # new — see everyone's calendar, not just own
org:appointments:reports           # new — reporting access
```

Role assignments (additions to Spec 07 §1.5):

| Role | New permissions |
|---|---|
| Owner | all |
| Manager | all |
| Optometrist | read, update own, checkin, complete |
| Optician | read, update own, checkin, complete |
| SA | read, create, update own, checkin, complete |
| Stylist (future) | + reassign, view_all_staff |
| Read-only | read, reports |

Location scoping applies throughout — an SA at Plateau cannot see DIX30 appointments unless granted cross-location access.

---

## 15. Tech stack

Consistent with the broader architecture from Spec 07 §23:

| Concern | Choice |
|---|---|
| Frontend (storefront booking) | Next.js 14 App Router, same Next app as main site |
| Frontend (CRM calendar) | Next.js (CRM app) |
| Scheduling engine | Inngest (same as other background jobs) |
| Messaging | Klaviyo (email + SMS) |
| Calendar file generation | `ics` npm package for ICS downloads |
| Slot search | Postgres queries against `appointments` + `staff_schedules` projection |
| Real-time staff notifications | Server-Sent Events from CRM API (V1) or Pusher (V2 if SSE at scale gets hairy) |
| Timezone handling | `date-fns-tz` + store all timestamps in UTC with explicit TZ context |
| ICS + calendar deep links | Generated server-side, signed tokens |
| CAPTCHA | Turnstile (Cloudflare, free, privacy-friendly) |

---

## 16. V1 scope / later

### V1 (ships together)

- Service catalogue admin (English/French bilingual, 8 V1 services)
- Multi-location booking with service-location matrix
- Staff scheduling + time off + personal blocks
- Public booking flow (6 steps, express 3-step for logged-in)
- Client appointment management (reschedule, cancel, intake)
- Internal calendar (week + today views, drag-drop reschedule)
- Appointment detail panel with outcomes + follow-ups
- Notification pipeline (confirmation, reminders, post-visit)
- Bilingual templates (FR/EN)
- Intake forms (3 types, hardcoded)
- Post-appointment outcome capture + CRM timeline integration
- No-show auto-detection
- Basic reporting (10 headline metrics)
- Klaviyo sync for both transactional and marketing events

### V2

- Waitlist for full slots (auto-notify when opens)
- Staff preference stickiness with ML-based suggestion
- Recurring appointments (e.g., quarterly eye checks for certain clients)
- Custom intake form builder
- Google Calendar two-way sync for staff
- SMS inbox / reply handling UI
- Payment at booking (hold card for no-show fee on eye exams)
- AI-drafted recommendation email after appointment
- Virtual appointments (video styling consult)
- Gift-an-appointment (buy a styling session for a friend)
- Tablet check-in kiosk mode

---

## 17. Open decisions

| # | Question | Recommendation |
|---|---|---|
| 1 | No-show policy — fees or not? | V1 no fees. V2 holds card for eye exams only. Review after 6 months of V1 data. |
| 2 | Can clients book for someone else? | V1 yes, with a checkbox "Booking for someone else" — fills name/email separately, sends confirmation to both. |
| 3 | Booking window length | Default 60 days. Eye exams often booked further out — bump to 90 days for clinical services. |
| 4 | Minimum notice | 2 hours default. Styling sessions: 1 hour. Eye exams: 4 hours. |
| 5 | Cancel cutoff | 12 hours for V1 uniformly. Can tighten on eye exams later. |
| 6 | Insurance validation | V1 captures only, no validation. V2 integrates with RAMQ API if feasible. |
| 7 | Walk-in handling | V1 logs as appointment with `booking_source = walk_in` and minimal client info. The calendar shows walk-ins retroactively inserted. |
| 8 | Multi-language | FR + EN at launch. Spanish and Mandarin for V2 if customer data warrants. |
| 9 | Notifications when a staff is offboarded mid-week | Automatic reassign-day helper opens for the manager; clients are notified. |
| 10 | Calendar subscription (staff view in Google Cal) | V2 read-only; V3 two-way. |

---

## 18. Implementation order

Suggested sequencing for a single engineer with help from designer + content:

### Phase A — Foundation (1 week)
Service catalogue, staff schedule model, availability query engine, tests for slot generation.

### Phase B — Public booking flow (2 weeks)
The 6-step flow, mobile + desktop, confirmation page, manage page with token auth.

### Phase C — CRM calendar (1–2 weeks)
Extend Spec 01's calendar with drag-drop, detail panel, today view, check-in/out.

### Phase D — Notifications (1 week)
Klaviyo templates (bilingual), Inngest scheduling, channel logic by consent.

### Phase E — Intake forms (1 week)
Three form types, rendering, submission, display in CRM.

### Phase F — Post-appointment + follow-ups (1 week)
Outcome capture, timeline integration, follow-up tasks, auto-actions.

### Phase G — Reporting + polish (1 week)
The 10 metrics, CSV export, AI insight generation.

**Total estimate:** 8–10 weeks for a thorough V1. Compressible to 6 weeks if the team accepts V2-deferring some polish (waitlist, AI insights, walk-in retroactive entry).

---

## 19. Success metrics

Six months post-launch, these should be true:

- Booking conversion (landing → confirmed) above 40% for logged-in users, 25% for guests
- Show-up rate above 85%
- No-show rate below 10%
- Intake form completion rate above 60% before appointment
- Booking-to-purchase conversion above 35% for styling sessions
- Average reschedule count per appointment below 0.3
- Staff-reported satisfaction (CRM survey): calendar is better than their previous tool
- Clients who booked with a preferred staff member rebook with them 65%+ of the time

If these aren't hitting, we've built the wrong thing. Each has an obvious next move if it misses.

---

*Cross-reference: Spec 01 (base calendar), Spec 02 (roles), Spec 07 (messaging, consent, permissions, Clerk setup) · CRM admin spec §5.4 (service config)*
