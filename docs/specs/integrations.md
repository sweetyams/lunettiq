# Lunettiq — Integration Specs

---

## 1. Polar Analytics (Cookieless Analytics & Attribution)

### Purpose
Privacy-first analytics for the storefront. Revenue tracking, conversion funnels, marketing attribution — without cookies. GDPR and Law 25 compliant out of the box. No consent banner needed.

### Why Polar over GA4
- Cookieless — no consent banner required (Law 25 compliance for free)
- Built for Shopify — native integration, accurate revenue attribution
- Server-side tracking — no ad blockers killing your data
- First-party data — no data shared with Google

### Integration Points
- **Storefront** — tracking pixel in `<head>`, auto-tracks pageviews + purchases
- **Shopify native** — pulls orders, customers, products automatically
- **CRM** — link to Polar dashboard for attribution reports

### Implementation
```html
<!-- app/(storefront)/layout.tsx — add to <head> -->
<script defer src="https://cdn.polaranalytics.com/tracking.js" data-site-id="{SITE_ID}"></script>
```

Conditional on integration being enabled:
```typescript
import { isIntegrationEnabled, getIntegrationKey } from '@/lib/crm/integrations';

// In layout or a client component
if (await isIntegrationEnabled('polar')) {
  const siteId = await getIntegrationKey('polar', 'NEXT_PUBLIC_POLAR_SITE_ID');
  // Render the script tag
}
```

### What Polar Tracks Automatically
- Page views (all pages)
- Add to cart events
- Checkout started / completed
- Revenue + AOV + conversion rate
- Marketing attribution (UTM, referrer, first/last touch)
- Customer LTV cohorts

### No Custom Events Needed
Polar pulls everything from Shopify's native events. No custom `track()` calls required.

### Env Vars
```
NEXT_PUBLIC_POLAR_SITE_ID=
```

### Setup
1. Create account at polaranalytics.com
2. Connect Shopify store (one-click)
3. Copy Site ID → paste in CRM Integrations page
4. Done — data starts flowing immediately

---

## 2. Klaviyo (Email & SMS Marketing)

### Purpose
Transactional emails, marketing flows, segment-triggered campaigns. Replaces manual email for membership welcome, credit reminders, Rx expiry, referral confirmations.

### Integration Points
- **Shopify native sync** — Klaviyo pulls customers + orders automatically via Shopify integration
- **CRM → Klaviyo** — push custom events for flows not triggered by Shopify
- **Klaviyo → CRM** — webhook on email open/click for timeline enrichment

### Events to Push (via Klaviyo Track API)

| Event | Trigger | Data |
|---|---|---|
| `Membership Activated` | Inngest post-purchase | tier, period, credit_amount |
| `Membership Cancelled` | Cancel action | tier, grace_ends |
| `Credits Issued` | Monthly credit cron | amount, balance, tier |
| `Credits Expiring` | 30 days before expiry | amount, expiry_date |
| `Rx Expiring` | 60 days before expiry | expiry_date, optician_name |
| `Referral Qualified` | Referral converts | referrer_name, reward_amount |
| `Appointment Reminder` | 24h before appointment | title, date, location |
| `Second Sight Graded` | Intake graded | grade, credit_amount |
| `Lens Refresh Due` | 18mo since last order | last_order_date |

### Flows to Build in Klaviyo
1. Membership welcome series (3 emails over 7 days)
2. Monthly credit issued notification
3. Credit expiry warning (30 days, 7 days)
4. Rx expiry reminder (90 days, 30 days)
5. Post-purchase follow-up (7 days after order)
6. Referral reward confirmation
7. Appointment reminder (24h)
8. Win-back (90 days no purchase, member)

### Anti-Spam Rules
- Max 2 marketing emails/month per customer
- Suppress email if customer has active on-site session (V2, requires PostHog)
- Bundle multiple triggers into one email (credit expiry + Rx expiry = one email)

### Env Vars
```
KLAVIYO_API_KEY=
KLAVIYO_PRIVATE_KEY=
```

### API Routes Needed
- `POST /api/webhooks/klaviyo` — receive engagement webhooks
- Inngest functions call Klaviyo Track API directly (no route needed)

### Implementation
```typescript
// lib/klaviyo.ts
async function trackEvent(email: string, event: string, properties: Record<string, unknown>) {
  await fetch('https://a.klaviyo.com/api/events/', {
    method: 'POST',
    headers: { 'Authorization': `Klaviyo-API-Key ${KLAVIYO_API_KEY}`, 'Content-Type': 'application/json', 'revision': '2024-02-15' },
    body: JSON.stringify({ data: { type: 'event', attributes: { metric: { data: { type: 'metric', attributes: { name: event } } }, profile: { data: { type: 'profile', attributes: { email } } }, properties } } })
  });
}
```

---

## 3. Yotpo (Reviews & UGC)

### Purpose
Product reviews, photo reviews, Q&A on PDPs. Social proof for premium eyewear.

### Integration Points
- **PDP** — display reviews + average rating below product details
- **Post-purchase** — Yotpo sends review request email (14 days after delivery)
- **CRM** — pull review data per product for the product analytics page

### Data Flow
```
Shopify order fulfilled
  ↓ (Yotpo Shopify integration, automatic)
Yotpo sends review request email (14 days)
  ↓
Customer submits review + photo
  ↓
Review appears on PDP (after moderation)
```

### Storefront Integration
```typescript
// PDP: fetch reviews via Yotpo API
GET https://api.yotpo.com/v1/widget/{APP_KEY}/products/{product_id}/reviews.json

// Display: star rating, review count, review cards with photos
```

### CRM Integration
- `/api/crm/products/[id]/analytics` — include Yotpo review stats (avg rating, count, sentiment)
- Product analysis page — flag products with <3 reviews or <4.0 avg rating

### Env Vars
```
YOTPO_APP_KEY=
YOTPO_SECRET_KEY=
```

### Moderation
- Auto-approve reviews ≥4 stars with no flagged content
- Queue reviews <4 stars for manual review in Yotpo dashboard
- Photo reviews get priority display on PDP

---

## 4. PostHog (Analytics & Feature Flags)

### Purpose
Product analytics, session recordings, feature flags, A/B testing. Replaces Google Analytics with a privacy-first, self-hostable alternative.

### Integration Points

#### Pixels / Event Tracking
| Event | Page | Data |
|---|---|---|
| `$pageview` | All | path, referrer |
| `product_viewed` | PDP | product_id, handle, price, collection |
| `product_added_to_cart` | PDP | product_id, variant_id, price |
| `collection_viewed` | PLP | collection_handle, product_count |
| `search_performed` | Search | query, result_count, personalized |
| `search_result_clicked` | Search | query, product_id, position |
| `membership_page_viewed` | Membership | — |
| `membership_selected` | Membership | tier, period, price |
| `checkout_started` | Cart | cart_total, item_count |
| `wishlist_added` | PDP/PLP | product_id |
| `prescription_saved` | Account | method (manual/scan) |
| `journal_article_viewed` | Journal | handle, pillar, author |

#### Implicit Preference Tracking (V2)
- Products viewed but not purchased → weak negative signal
- Time on PDP → interest level
- Filter usage patterns → preference signals
- Search queries → demand signals
- Feed into `preferences_derived` table via nightly Inngest job

#### Feature Flags
| Flag | Purpose |
|---|---|
| `personalization_v2` | Enable/disable PLP personalization |
| `search_overlay` | Gradual rollout of new search |
| `membership_annual_discount` | Test different annual savings |
| `journal_enabled` | Show/hide journal in nav |

#### Session Recordings
- Record sessions on PDP + checkout for UX analysis
- Auto-flag sessions with rage clicks or error pages
- Privacy: mask all input fields, don't record on /account pages

### Implementation
```typescript
// app/(storefront)/layout.tsx — add PostHog provider
import posthog from 'posthog-js'
posthog.init(POSTHOG_KEY, { api_host: 'https://app.posthog.com' })

// Track custom events
posthog.capture('product_viewed', { product_id, handle, price })
```

### CRM Integration
- Customer profile → link to PostHog person profile for session history
- Search dashboard → PostHog funnels for search → click → purchase conversion
- Product analytics → PostHog insights for view-to-cart conversion per product

### Env Vars
```
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Privacy (Law 25 / Quebec)
- PostHog respects Do Not Track
- Cookie consent banner required before initializing
- Session recordings disabled until consent given
- No PII in event properties (use customer_id, not email)
- Data retention: 12 months

---

## Integration Priority

| Integration | Priority | Depends On |
|---|---|---|
| Polar Analytics | V2.0 — ship with launch | Shopify (native) |
| PostHog | V2.0 — ship with accounts | Nothing |
| Klaviyo | V2.0 — ship with accounts | Shopify (native) |
| Yotpo | V2.2 — after order volume grows | Shopify (native) |
