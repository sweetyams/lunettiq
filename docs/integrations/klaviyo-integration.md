# Klaviyo — Email & SMS

**Purpose:** Transactional and marketing emails/SMS. Triggered by CRM events.

## How It Works

The CRM fires Klaviyo events via the API. Klaviyo flows (configured in the Klaviyo dashboard) listen for these events and send the actual emails/SMS.

```
CRM action → fireKlaviyoEvent() → Klaviyo API → Klaviyo Flow → Email/SMS
```

We never send emails directly — Klaviyo handles all delivery.

## Events Fired

| Event Name | Trigger | Data |
|---|---|---|
| `Appointment Reminder` | 24h before appointment | title, time, location, first_name |
| `Points Expiry Warning` | 90/30/7 days before expiry | days_until_expiry, points, first_name |
| `Trial Reminder Day 23` | Day 23 of CULT trial | days_left, credits_used, first_name |
| `Trial Reminder Day 28` | Day 28 of CULT trial | days_left, credits_used, first_name |
| `Event Invitation` | VAULT event invite sent | event_title, event_date, event_location |
| `Gift Membership` | Gift membership purchased | code, tier, from_name, message |

## Files

| File | Purpose |
|---|---|
| `src/lib/klaviyo/events.ts` | `fireKlaviyoEvent()` — single function for all events |

## Environment Variables

```env
KLAVIYO_PRIVATE_KEY=pk_xxx    # Klaviyo Private API Key
```

### Where to Find

1. Go to [klaviyo.com](https://www.klaviyo.com) → Settings → API Keys
2. Create a Private API Key with Events write scope

## Safety Guards

Three layers prevent accidental emails to real customers:

1. **`NODE_ENV !== 'production'`** — blocks all events in dev automatically
2. **`DISABLE_EXTERNAL_COMMS=true`** — explicit kill switch (set in `.env.local`)
3. **`ALLOWED_TEST_EMAILS`** — comma-separated allowlist for staging

All blocked events log to console: `[klaviyo:blocked] Event Name → email@example.com`

## Klaviyo Setup (Flows)

For each event above, create a matching Flow in Klaviyo:

1. Klaviyo → Flows → Create Flow → Metric Triggered
2. Trigger: the event name (e.g. "Appointment Reminder")
3. Design the email template using the event data properties
4. Activate the flow

## Production

1. Set `KLAVIYO_PRIVATE_KEY` in Vercel env vars
2. Set `DISABLE_EXTERNAL_COMMS=false` (or remove it)
3. Optionally set `ALLOWED_TEST_EMAILS` for a staged rollout
4. Create all flows in Klaviyo dashboard
5. Test with a real email in the allowlist before going fully live
