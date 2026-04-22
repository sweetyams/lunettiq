# Glossary — Lunettiq

## Business Domain

| Term | Meaning |
|---|---|
| Lunettiq | Premium eyewear, Montréal. Optical + sunglasses + reglaze. |
| Second Sight | Trade-in program. Old frames → graded A/B/C/D → store credit. Rate = tier (10–35%) × MSRP × grade multiplier. |
| Lens Configurator | Multi-step PDP: lens type → material → coatings → Rx → summary. Client-side state machine → cart line attributes. |
| Reglaze | Lens-replacement service. Customer sends frames, gets new lenses. No frame base price — lens-only. |
| Product Family | Frame model group (e.g. "SHELBY"). Each colour = separate Shopify product. Family links for cross-colour PDP nav. |
| Channel | Pricing context: `optical` ($290 base), `sun` ($250 base), `reglaze` (lens-only). |

## Loyalty

| Term | Meaning |
|---|---|
| Essential | $19/mo · $199/yr · $12/mo credit · 15% trade-in · standard shipping |
| CULT | $39/mo · $399/yr · $25/mo credit · 30% trade-in · lens refresh · frame rotation 25% off · named optician · priority shipping |
| VAULT | $79/mo · $799/yr · $45/mo credit · 35% trade-in · free frame swap · unlimited consultations · archive vote · private WhatsApp · overnight shipping |
| Credits | Store currency. Monthly via membership, birthday, manual, Second Sight. `credits_ledger` `currency='credit'`. |
| Points | Engagement currency. Purchases, referrals, reviews, milestones. 100 pts = $5. Min 200 pts. Expire 18mo. `credits_ledger` `currency='points'`. |
| Credits Ledger | Append-only tx log. Dual currency. Types: `issued_membership`, `issued_birthday`, `issued_manual`, `issued_second_sight`, `redeemed_order`, `expired`, `adjustment`, + points variants. |
| Lens Refresh | Annual $40 lens credit. CULT + VAULT. |
| Frame Rotation | Annual trade-in. CULT: 25% off. VAULT: free swap (≤ MSRP). |
| Pause | Membership hold. Max 2mo per 12mo cycle. Credits stop, balance preserved. |
| Grace Period | 60 days post-cancel. Credits still redeemable. |
| Referral Milestones | 3 → tier upgrade 3mo. 5 → free engraving. 10 → VAULT event invite. |
| Membership Product | Shopify product `9128814903553`. 6 variants: 3 tiers × monthly/annual. |

## Lens & Optical

| Term | Meaning |
|---|---|
| Lens Type | Single Vision, Progressive, Non-Rx (Plano), Readers, Anti-Fatigue, Computer/Degressive. |
| Lens Index | 1.50 (Standard), 1.61 (Thin), 1.67 (Ultra-Thin), 1.74 (Thinnest), Polycarbonate. |
| Lens Coating | Anti-Reflective, Blue Light, Photochromic (Transitions), Scratch-Resistant, Hydrophobic, Oleophobic. |
| Sun Lens | Tint (gray/brown/green/rose/yellow), polarization, mirror (silver/gold/blue/green). |
| Rx | OD + OS: Sphere [-20,+20], Cylinder [-6,+6], Axis [1-180], PD [50-80]. Add Power for progressive. |
| Rx State | `none` → `pending` → `provided` → `validated` → `flagged`. |
| Option Layer | `channel`, `lens_path`, `material`, `finish_state`, `treatment`, `shipping`. |
| Constraint Rule | `requires`, `excludes`, `allowed_only_with`, `hidden_until`, `default_if`, `defer_if_no_rx`. |

## CRM

| Term | Meaning |
|---|---|
| Client | Record in `customers_projection`. Key: `shopifyCustomerId`. Shopify = source of truth, local = webhook-synced mirror. |
| Interaction | Staff-logged touchpoint: note, phone, email, SMS, in-store, fitting, purchase assist, follow-up, complaint, product rec. |
| Segment | Rule-based customer group. Conditions: tags, tier, status, dates, metafields. Logic: AND/OR. |
| Client Canvas | 3-col profile. Left: nav/summary. Center: timeline. Right: membership, credits, preferences, fit. |
| Duplicate Candidates | System-detected dupes. Staff → merge or dismiss. |
| Custom Design | Bespoke frame order. Production status workflow. Links to draft order. |
| Audit Log | Append-only staff actions: create, update, delete, login, consent, tag, credit adjust, sync. |

## Staff Roles

| Role | Access |
|---|---|
| `owner` | All (`*`) |
| `manager` | Clients, orders, products, segments, appointments, Second Sight, reports. No settings. |
| `optician` | Client read/update, Rx CRUD, fit profile, interactions, appointments, try-on. |
| `sa` | Client read/update, interactions, orders, products, appointments, try-on. |
| `read_only` | Read-only: clients, orders, products, segments. |

## Technical

| Term | Meaning |
|---|---|
| Projection Table | Local Postgres mirror of Shopify. Webhook-synced. Read-only. Tables: `customers_projection`, `orders_projection`, `products_projection`, `product_variants_projection`, `collections_projection`, `draft_orders_projection`. |
| Integration Gating | Non-core integrations conditional on `isIntegrationEnabled()` / `getKey()`. No hardcoded imports. |
| `handler()` | CRM API wrapper. `lib/crm/route-handler.ts`. |
| `requireCrmAuth()` | Clerk auth check for API routes. Returns staff + role. |
| `requirePermission()` | Page-level Clerk check. Redirects if unauthorized. |
| `jsonOk()` / `jsonError()` | API response helpers. `lib/crm/api-response.ts`. |
| `safeFetch()` | Storefront fetcher with try/catch fallback. No page crash on API fail. |
| ISR | `revalidate=60` on storefront pages. On-demand via `/api/revalidate`. |
| Inngest Functions | Crons: monthly credits (1st 6AM ET), birthday (daily 7AM ET), reconciliation (2AM ET). Webhook handlers. `lib/inngest/functions.ts` (58KB). |
| Store Settings | DB config in `store_settings`. Skeleton colours, design tokens, feature flags. `getSettings()`. |
