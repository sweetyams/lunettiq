# Project Structure — Lunettiq

Premium eyewear e-commerce + CRM. Single Next.js 14 App Router monolith.

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| DB | Postgres (Neon) via Drizzle ORM |
| Staff Auth | Clerk (roles in publicMetadata) |
| Customer Auth | Shopify Customer Account API (OAuth, HTTP-only cookies) |
| Commerce | Shopify Storefront + Admin API |
| Jobs | Inngest |
| Cache | Upstash Redis |
| Payments | Square (POS) |
| Email | Klaviyo |
| Deploy | Vercel |

## Three Apps, One Codebase

### 1. Storefront — `src/app/(storefront)/`

Customer-facing headless Shopify. ISR `revalidate=60`. Dynamic imports below-fold.

Layout chain: CartProvider → CartDrawerProvider → WishlistProvider → SearchProvider → AnnouncementBar + Header + MobileNav + Footer + CartDrawer + TrackingPixels

| Route | What |
|---|---|
| `/` | Homepage (hero, categories, product rows, editorial) |
| `/collections/[handle]` | PLP — grid, filters, infinite scroll |
| `/products/[handle]` | PDP — gallery, configurator, recs |
| `/search` | Search results |
| `/journal`, `/journal/[slug]` | Editorial/blog |
| `/pages/[handle]` | Static (stores, membership, loyalty) |
| `/account` | Dashboard (orders, loyalty, profile) |
| `/account/prescriptions` | Saved Rx |
| `/account/wishlist` | Favourites |
| `/account/appointments` | Booking |
| `/account/loyalty` | Tier status |
| `/account/points` | Points balance |
| `/account/referrals` | Referral program |
| `/account/gift-membership` | Gift memberships |
| `/r/[code]` | Referral redirect |

Components: `components/home/`, `plp/`, `pdp/` (incl. `configurator/`), `cart/`, `layout/`, `account/`, `search/`, `shared/`, `skeletons/`, `tracking/`

### 2. CRM — `src/app/crm/`

Staff-only. Clerk-gated. `force-dynamic`. CrmShell + sidebar.

Auth: pages → `requirePermission('org:...')`. API → `requireCrmAuth()`.

| Route | What |
|---|---|
| `/crm` | Dashboard |
| `/crm/clients` | Client list (search, filters, sort) |
| `/crm/clients/[id]` | Client profile (3-col canvas) |
| `/crm/clients/new` | Create client |
| `/crm/clients/duplicates` | Duplicate detection |
| `/crm/products` | Catalogue + families |
| `/crm/products/[id]` | Product detail + analytics |
| `/crm/orders` | Order list |
| `/crm/orders/[id]` | Order detail |
| `/crm/draft-orders` | Draft orders |
| `/crm/loyalty` | Loyalty mgmt |
| `/crm/loyalty/events` | Brand events |
| `/crm/loyalty/gifts` | Gift memberships |
| `/crm/loyalty/trials` | Trials |
| `/crm/loyalty/referrals` | Referral tracking |
| `/crm/appointments` | Calendar |
| `/crm/segments` | Segment builder (rule engine) |
| `/crm/second-sight` | Trade-in queue |
| `/crm/reports` | Sales + product analysis |
| `/crm/settings/*` | 16 settings pages |

Settings: tags, locations, staff, audit, appointment-types, loyalty, integrations, product-mapping, product-options, families, filters, metafield-visibility, system, store, design

Components: `components/crm/` — CrmShell, CrmSidebar, CrmTour, CommandPalette, GlobalSearch, ClientPicker, ProductSearchModal, WeekCalendar, TimeSlotPicker, MembershipCard, CreditsLedger, CreditAdjustModal, InteractionTimeline, ActivityTimeline, TagManager, PreferencesEditor, FitProfileEditor, ConsentToggle, StaffPicker, LogInteractionModal, ProductSuggestions, TryOnHistory, CustomFields, CustomerEditForm, StaffScheduleEditor

### 3. API — `src/app/api/`

130+ routes. Pattern: `handler()` + `requireCrmAuth()` + `jsonOk()`/`jsonError()`.

| Namespace | # | Auth | What |
|---|---|---|---|
| `api/crm/*` | ~80 | Clerk | CRM ops |
| `api/account/*` | ~22 | Shopify OAuth | Customer account |
| `api/storefront/*` | 6 | Public | Product/search/filter |
| `api/checkout/*` | 3 | Public (validated) | Draft order checkout |
| `api/auth/*` | 3 | — | OAuth flow |
| `api/webhooks/*` | 2 | HMAC | Shopify + Square |
| `api/inngest` | 1 | Signing key | Background jobs |
| `api/revalidate` | 1 | Secret | ISR revalidation |
| `api/cart` | 1 | Public | Cart proxy |
| `api/collections/[handle]/products` | 1 | Public | Paginated products |
| `api/system/status` | 1 | — | Health check |

CRM API: clients (CRUD, credits, membership, tags, timeline, AI styler, suggestions, export, tryon), products (CRUD, families, search, analytics, intelligence, sync, interactions), orders, draft-orders, appointments (CRUD, slots), segments (CRUD, AI suggest/analyze/explain/refine, analytics), staff (CRUD, invite, schedule, suspend, offboard), settings (store, locations, integrations, loyalty, families, filters, metafield-visibility), reports (sales, product-analysis, AI), loyalty (gifts, membership-products), events, referrals, second-sight, interactions, notifications, dashboard, search, system (sync, backfill, reconcile), tryon

Account API: me, profile, birthday, credits/redeem, points/convert, loyalty-status, membership/manage, prescriptions/scan, wishlist, appointments, appointment-types, preferences, personalization/products, referrals, trial/start/cancel, gift-membership/redeem, archive-vote, pixels

## Service Layer — `src/lib/`

| Module | # | What |
|---|---|---|
| `lib/crm/` | 33 | Auth, permissions, shopify-admin, loyalty-config, membership-config, segment-rules, segment-aggregator, points, milestones, subscriptions, integration-registry, integration-keys, integrations, product-sales, product-score, recurrence, notify, audit, normalize, api-response, route-handler, location-scope, location-names, timezone, early-access, second-sight-rates, ai-usage, store-settings, regenerate-slugs, use-permissions, shopify-admin.types |
| `lib/shopify/` | 13 | Storefront client (retry/backoff), Admin GraphQL, customer API, auth, queries, mutations, slug utils, errors |
| `lib/db/` | 2 | Drizzle client + schema (43KB) |
| `lib/inngest/` | 2 | Client + functions (58KB) |
| `lib/tracking/` | 2 | Pixel registry + conditional loading |
| `lib/square/` | 1 | Square POS client |
| `lib/klaviyo/` | 1 | Event emitter |
| `lib/tryon/` | 1 | Face tracker |
| `lib/configurator/` | 1 | Cart attributes ↔ lens config |
| `lib/validators/` | 1 | Rx field validation |
| `lib/shopify-image-loader.ts` | 1 | Shopify CDN loader |

## DB — `src/lib/db/schema.ts`

70+ tables/enums. Three categories:

**Projection** (Shopify mirror, webhook-synced): `customers_projection`, `orders_projection`, `products_projection`, `product_variants_projection`, `collections_projection`, `draft_orders_projection`

**CRM-owned:** `interactions`, `second_sight_intakes`, `appointments`, `staff_schedules`, `appointment_types`, `custom_designs`, `credits_ledger`, `preferences_derived`, `audit_log`, `segments`, `duplicate_candidates`, `client_links`, `locations`, `product_interactions`, `product_feedback`, `try_on_sessions`, `loyalty_tiers`, `referrals`, `membership_trials`, `gift_memberships`, `brand_events`, `event_invites`, `archive_votes`, `gift_fulfilments`, `notifications`, `ai_requests`, `returns`, `search_queries`, `search_synonyms`, `credit_codes`

**Product config:** `product_families`, `product_family_members`, `filter_groups`, `product_filters`, `colour_groups`, `product_colours`, `product_mappings`, `option_groups`, `options`, `price_rules`, `constraint_rules`, `step_definitions`, `configuration_snapshots`

**Infra:** `integrations_config`, `store_settings`

## Contexts — `src/context/`

`CartContext` (cart + cookie), `CartDrawerContext` (open/close), `WishlistContext` (metafield CRUD), `SearchContext` (overlay)

## Types — `src/types/`

`shopify.ts` (Product, Variant, Collection, Cart, Money, Image), `metaobjects.ts` (AnnouncementBar, HomepageHero, EditorialPanel, CategoryPanel, StoreLocation, EyeTestCTA, LensOption), `configurator.ts` (LensConfiguration, LensType, LensIndex, LensCoating, SunLensOptions), `customer.ts` (WishlistData, PrescriptionRecord, LoyaltyData), `filters.ts` (PLPFilters, SortOption)

## Middleware — `src/middleware.ts`

Dual auth: Clerk for `/crm/*`, Shopify OAuth refresh for `/account/*`. CORS for native app. Tokens in `lunettiq_access_token` / `lunettiq_refresh_token` cookies.

## Patterns

- CRM pages: `requirePermission('org:...')` → `*Client.tsx`
- CRM API: `handler()` → `requireCrmAuth()` → `jsonOk(data)`
- Storefront: Server component, ISR 60s, `safeFetch()` fallback
- Below-fold: `next/dynamic` + `ssr: false` + `LazyLoad`
- Integrations: gated on `isIntegrationEnabled()` / `getKey()`
- Webhooks: Shopify → HMAC → Inngest → idempotent upsert
- Roles: `owner`, `manager`, `sa`, `readonly` in `publicMetadata.role`
