# Inngest — Background Jobs

**Purpose:** Processes webhooks, runs scheduled jobs, handles async work.

## How It Works

Inngest receives events from webhook handlers and runs functions asynchronously with retries. The dev server provides a local dashboard for monitoring.

```
Webhook → inngest.send({ name, data }) → Inngest function → DB writes
Cron schedule → Inngest function → DB writes / Klaviyo events
```

## Registered Functions

### Shopify Sync
| Function | Trigger | Purpose |
|---|---|---|
| `syncCustomer` | `shopify/customer.updated` | Upsert customer projection |
| `syncOrder` | `shopify/order.updated` | Upsert order projection |
| `syncProduct` | `shopify/product.updated` | Upsert product + variants |
| `syncCollection` | `shopify/collection.updated` | Upsert collection |

### Square Sync
| Function | Trigger | Purpose |
|---|---|---|
| `syncSquareOrder` | `square/order.synced` | Fetch + upsert Square order |
| `syncSquareCustomer` | `square/customer.synced` | Match/create customer |

### Loyalty
| Function | Schedule | Purpose |
|---|---|---|
| `monthlyCredits` | 1st of month, 6am | Issue monthly credits to members |
| `birthdayCredits` | Daily 7am | Issue birthday credits |
| `creditReconciliation` | Daily 2am | Reconcile credit balances |
| `pointsOnPurchase` | On order webhook | Award 1pt/$1 + first-purchase bonus |
| `pointsBirthday` | Daily 8am | Award 200 birthday points |
| `pointsExpiryScan` | Daily 3am | Send expiry warnings (90/30/7 days) |
| `pointsExpiryExecute` | Daily 4am | Expire old points |
| `trialConversionScan` | Hourly | Convert/clawback day-31 trials |
| `trialReminder` | Daily 9am | Day 23 + 28 trial reminder emails |
| `referralQualify` | On event | Qualify referrals, issue rewards |
| `vaultGiftDispatch` | Daily 9am | Trigger VAULT anniversary gifts |

### Other
| Function | Schedule | Purpose |
|---|---|---|
| `dedupScan` | Daily 3am / on-demand | Find duplicate customers |
| `dailyDigest` | Daily 8am | Staff notification summary |
| `appointmentReminders` | Hourly | 24h appointment reminder emails |

## Files

| File | Purpose |
|---|---|
| `src/lib/inngest/client.ts` | Inngest client instance |
| `src/lib/inngest/functions.ts` | All function definitions |
| `src/app/api/inngest/route.ts` | Inngest serve endpoint |

## Environment Variables

```env
INNGEST_EVENT_KEY=your-event-key
INNGEST_SIGNING_KEY=your-signing-key
```

### Where to Find

1. Go to [app.inngest.com](https://app.inngest.com)
2. Select your app → Event Keys / Signing Keys

## Development

```bash
# Run the Inngest dev server (separate terminal):
npx inngest-cli@latest dev
# Dashboard at http://localhost:8288
```

The dev server auto-discovers functions from `/api/inngest`.

## Production

Inngest Cloud handles production. Set `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` in Vercel env vars. Functions are registered automatically on deploy.
