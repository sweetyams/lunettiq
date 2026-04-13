# Implementation Plan: Lunettiq Headless Shopify Storefront

## Overview

Incremental build of the Lunettiq headless e-commerce storefront — a Next.js 14 (App Router) + TypeScript + Tailwind CSS application consuming the Shopify Storefront API and Customer Account API. Tasks are ordered by dependency: project scaffolding → API layer → layout shell → pages (homepage, PLP, PDP, configurator, cart, account, static) → responsive pass → tests → deployment.

## Tasks

- [x] 1. Project scaffolding and core infrastructure
  - [x] 1.1 Initialize Next.js 14 project with App Router, TypeScript, and Tailwind CSS
    - Run `npx create-next-app@14` with App Router, TypeScript, Tailwind, ESLint enabled
    - Configure `tsconfig.json` path aliases (`@/` → `src/`)
    - Set up directory structure: `app/`, `components/`, `lib/`, `types/`, `hooks/`, `context/`
    - Create `.env.local.example` with required env vars: `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_ID`, `SHOPIFY_CUSTOMER_ACCOUNT_API_CLIENT_SECRET`
    - _Requirements: 28.1, 30.1_

  - [x] 1.2 Define core TypeScript types and interfaces
    - Create `types/shopify.ts` with Product, Variant, Collection, Cart, CartLineItem, CartLineAttribute, Money, Image types
    - Create `types/metaobjects.ts` with AnnouncementBar, HomepageHero, EditorialPanel, CategoryPanel, StoreLocation, EyeTestCTA, LensOption types
    - Create `types/configurator.ts` with LensConfiguration, LensType, LensIndex, LensCoating, SunLensOptions, TintColour, MirrorCoating, ConfiguratorStep, PrescriptionData, EyeRx types
    - Create `types/customer.ts` with WishlistData, PrescriptionRecord, LoyaltyData types
    - Create `types/filters.ts` with PLPFilters, SortOption types
    - _Requirements: 27.1, 27.4, 14.1_

  - [x] 1.3 Install testing dependencies
    - Install `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `fast-check`, `msw` (Mock Service Worker)
    - Configure `vitest.config.ts` with jsdom environment and path aliases
    - _Requirements: (testing infrastructure)_

- [x] 2. Shopify Storefront API client
  - [x] 2.1 Implement the Storefront API GraphQL client with retry logic
    - Create `lib/shopify/storefront.ts` with `storefrontFetch<T>(query, variables)` function
    - Read `SHOPIFY_STOREFRONT_ACCESS_TOKEN` and `NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN` from env
    - Implement exponential backoff retry for 429 and 5xx responses (max 3 retries)
    - Throw typed errors on final failure
    - _Requirements: 27.1, 27.3, 27.5, 30.4_

  - [ ]* 2.2 Write property test for API retry with exponential backoff
    - **Property 12: API Retry with Exponential Backoff**
    - Test that for any sequence of 429 responses followed by a 200, the retry logic returns the success. Verify delays increase exponentially. Verify failure after max retries.
    - **Validates: Requirements 27.3**

  - [x] 2.3 Write core Storefront API GraphQL queries and mutations
    - Create `lib/shopify/queries/product.ts` — product by handle (with metafields), product recommendations
    - Create `lib/shopify/queries/collection.ts` — collection by handle with products, filters, sort, cursor pagination
    - Create `lib/shopify/queries/metaobjects.ts` — announcement bar, homepage hero, editorial panels, category panels, store locations, eye test CTA, lens options
    - Create `lib/shopify/mutations/cart.ts` — cartCreate, cartLinesAdd, cartLinesUpdate, cartLinesRemove
    - _Requirements: 27.1, 27.4, 9.1, 9.4, 10.2, 10.3, 15.3, 20.3, 20.4_

- [x] 3. Authentication (Shopify Customer Account API OAuth)
  - [x] 3.1 Implement OAuth route handlers
    - Create `app/api/auth/login/route.ts` — initiate Shopify unified login OAuth redirect
    - Create `app/api/auth/callback/route.ts` — exchange code for tokens, store access + refresh tokens in HTTP-only cookies
    - Create `app/api/auth/logout/route.ts` — clear auth cookies, redirect to homepage
    - _Requirements: 22.1, 22.2, 22.4, 22.5, 22.6_

  - [x] 3.2 Implement auth middleware and session helpers
    - Create `middleware.ts` — intercept `/account/*` routes, verify auth token, refresh if expired, redirect to login if unauthenticated
    - Create `lib/shopify/customer.ts` — helper to query Customer Account API with auth token (profile, orders, addresses, metafields)
    - _Requirements: 22.3, 22.4, 27.2_

- [x] 4. Checkpoint — Ensure project builds and API client compiles
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Layout components (Root Layout, Announcement Bar, Header, Footer)
  - [x] 5.1 Implement Root Layout with Announcement Bar
    - Create `app/layout.tsx` — root layout wrapping all pages with AnnouncementBar, Header, Footer, CartDrawer
    - Create `components/layout/AnnouncementBar.tsx` — server component fetching metaobject, client dismiss logic with localStorage persistence
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

  - [x] 5.2 Implement Header with Primary Nav, Secondary Nav, and Mega Nav
    - Create `components/layout/Header.tsx` — container for PrimaryNav + SecondaryNav
    - Create `components/layout/PrimaryNav.tsx` — Optical, Sun, Explore, About links
    - Create `components/layout/MegaNav.tsx` — dropdown panel for Explore with sub-collection links, close on outside click / Escape
    - Create `components/layout/SecondaryNav.tsx` — Search, Stores, Account, Cart icon (with badge), Stylist Appointment CTA
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 5.3 Implement Mobile Navigation
    - Create `components/layout/MobileNav.tsx` — hamburger trigger, full-screen/slide-in panel with all nav items, close on link click / outside click / close button
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 5.4 Implement Footer
    - Create `components/layout/Footer.tsx` — Newsletter signup form, four link columns (Shop, Help, Company, Legal), footer bar
    - Create `components/layout/NewsletterSignup.tsx` — email input with client-side validation, submit to Shopify customer marketing endpoint
    - Create `components/layout/CurrencySelector.tsx` and `components/layout/LanguageSelector.tsx`
    - Display copyright and payment method icons
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6_

  - [ ]* 5.5 Write property test for email validation
    - **Property 11: Email Validation**
    - Test that valid email formats are accepted and invalid formats are rejected by the newsletter validator.
    - **Validates: Requirements 26.3**

- [x] 6. Homepage
  - [x] 6.1 Implement Hero Section
    - Create `app/page.tsx` — homepage server component fetching all homepage metaobjects
    - Create `components/home/HeroSection.tsx` — full-bleed dual images, headline overlay, CTA button linking to collection/page
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 6.2 Implement Category Panels
    - Create `components/home/CategoryPanels.tsx` — image cards for Optical, Sun, and featured sub-collections, linking to /collections/[handle]
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 6.3 Implement Product Rows
    - Create `components/home/ProductRow.tsx` — horizontally scrollable row of product cards from homepage-featured collection
    - Create `components/shared/ProductCard.tsx` — reusable card with image, title, price, colour swatches, optional favourite icon
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 6.4 Write property test for Product Card completeness
    - **Property 1: Product Card Completeness**
    - Test that for any valid product data with image, title, price, and colour options, the rendered card contains all required elements.
    - **Validates: Requirements 9.2**

  - [x] 6.5 Implement Editorial Panels and Store Teaser
    - Create `components/home/EditorialPanel.tsx` — full-width lifestyle image with overlaid text
    - Create `components/home/StoreTeaser.tsx` — store location teaser linking to /pages/stores
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 7. Product Listing Page (PLP)
  - [x] 7.1 Implement Collection Page with Product Grid and Infinite Scroll
    - Create `app/collections/[handle]/page.tsx` — server component fetching collection products, rendering 3-column grid
    - Implement cursor-based infinite scroll using Storefront API pagination cursor (client component wrapper)
    - Display error message for invalid collection handles or API failures
    - _Requirements: 9.1, 9.4, 9.5_

  - [x] 7.2 Implement Filter Bar with sorting
    - Create `components/plp/FilterBar.tsx` — inline filter controls for shape, colour, material, size + sort dropdown
    - Re-query Storefront API on filter/sort change without full page reload, reflect active filters visually
    - Persist filter state in URL search params
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 7.3 Implement Editorial Breaks in product grid
    - Inject EditorialPanel components at defined intervals within the product grid
    - _Requirements: 9.3_

  - [ ]* 7.4 Write property test for Editorial Panel interval placement
    - **Property 2: Editorial Panel Interval Placement**
    - Test that for any grid of N products with interval K, floor(N/K) panels are injected at positions i*K.
    - **Validates: Requirements 9.3**

- [x] 8. Checkpoint — Ensure homepage and PLP render correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Product Detail Page (PDP) — Core components
  - [x] 9.1 Implement PDP page and Image Gallery
    - Create `app/products/[handle]/page.tsx` — server component fetching product data with metafields, recommendations, lens options
    - Create `components/pdp/ImageGallery.tsx` — display all product images, update on colour variant change, swipe gestures on mobile, placeholder fallback
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

  - [x] 9.2 Implement Product Info Panel and Colour Selector
    - Create `components/pdp/ProductInfoPanel.tsx` — sticky panel with title, price (updates on variant change), description
    - Create `components/pdp/ColourSelector.tsx` — colour thumbnails for Option 1, visual highlight on selected, colour name label, updates gallery and variant on click
    - _Requirements: 12.1, 12.2, 12.3, 13.1, 13.2, 13.3, 13.4_

  - [x] 9.3 Implement Accordion Sections
    - Create `components/pdp/AccordionSection.tsx` — reusable expand/collapse component
    - Render Details (material, origin from metafields), Dimensions (bridge, lens width, temple from metafields), Care, and Shipping accordions
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 9.4 Implement On Faces Section
    - Create `components/pdp/OnFacesSection.tsx` — render on_face_images metafield images with face_notes, conditionally render only when data exists
    - _Requirements: 17.1, 17.2, 17.3_

  - [x] 9.5 Implement Recommendations and Eye Test CTA
    - Create `components/pdp/Recommendations.tsx` — query product recommendations endpoint, render product cards linking to PDPs
    - Create `components/pdp/EyeTestCTA.tsx` — fetch eye_test_cta metaobject, render CTA block linking to booking page
    - _Requirements: 18.1, 18.2, 18.3, 19.1, 19.2, 19.3_

- [x] 10. Lens Configurator (multi-step flow)
  - [x] 10.1 Implement Configurator shell and state machine
    - Create `components/pdp/LensConfigurator.tsx` — parent component with `useReducer` managing LensConfiguration state
    - Implement step navigation (forward, back), step indicator (current, completed, remaining)
    - Implement invalidation logic: changing lensType clears incompatible lensIndex and prescription; changing lensIndex does not affect coatings
    - _Requirements: 14.1, 14.7, 14.8, 14.9_

  - [x] 10.2 Implement Lens Type step
    - Create `components/pdp/configurator/LensTypeStep.tsx` — Single Vision, Progressive, Non-Prescription, Readers options
    - Show Prescription Sun and Non-Prescription Sun when product is in sunglasses collection
    - Disable unavailable options with reason label
    - _Requirements: 14.2, 14.3, 14.10_

  - [x] 10.3 Implement Lens Index (Material) step
    - Create `components/pdp/configurator/LensIndexStep.tsx` — Standard (1.50), Thin (1.61), Ultra-Thin (1.67), Thinnest (1.74), Polycarbonate
    - Display price differential, description, and recommendation based on Rx strength
    - Disable incompatible options with explanation
    - _Requirements: 14.4, 33.1, 33.2, 33.3, 33.4, 33.5, 33.6, 33.7_

  - [x] 10.4 Implement Coatings and Add-Ons step (including sunglasses options)
    - Create `components/pdp/configurator/CoatingsStep.tsx` — toggleable coating options (Anti-Reflective, Blue Light, Photochromic, Scratch-Resistant, Hydrophobic, Oleophobic), UV included label
    - Implement mutual exclusivity logic: selecting one disables conflicting option with explanation
    - For sunglasses: render Tint Colour selector (swatches), Polarization toggle, Mirror Coating options with prices
    - _Requirements: 34.1, 34.2, 34.3, 34.4, 34.5, 34.6, 34.7, 34.8, 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7_

  - [ ]* 10.5 Write property test for mutual exclusivity of lens coatings
    - **Property 14: Mutual Exclusivity of Lens Coatings**
    - Test that for any set of selected coatings, mutually exclusive coatings cannot coexist.
    - **Validates: Requirements 34.7**

  - [x] 10.6 Implement Prescription Input step
    - Create `components/pdp/configurator/PrescriptionStep.tsx` — manual Rx form (OD/OS: Sphere, Cylinder, Axis, PD; Add Power for progressive)
    - Implement field-level validation: Sphere [-20, +20] in 0.25 steps, Cylinder [-6, +6] in 0.25 steps, Axis [1, 180] integer, PD [50, 80] in 0.5 steps
    - Implement cross-field validation: Cylinder non-zero requires Axis
    - Implement prescription image upload option, "Send Later" option, saved Rx selector (authenticated), PD Measurement Guide overlay
    - Show magnification selector (+1.00 to +3.50 in 0.25 steps) for Readers; skip step for Non-Prescription
    - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5, 32.6, 32.7, 32.8, 32.9, 32.10, 32.11, 32.12, 32.13, 32.14_

  - [ ]* 10.7 Write property tests for prescription validation
    - **Property 13: Prescription Field-Level Range and Step Validation**
    - Test Sphere, Cylinder, Axis, PD validators accept valid values and reject out-of-range or wrong-step values.
    - **Validates: Requirements 32.4, 32.5, 32.6, 32.7**

  - [ ]* 10.8 Write property test for prescription cross-field validation
    - **Property 10: Prescription Cross-Field Validation**
    - Test that Cylinder non-zero without Axis is rejected; valid complete prescriptions are accepted.
    - **Validates: Requirements 24.3, 32.8**

  - [x] 10.9 Implement Running Price Total and Configuration Summary
    - Create `components/pdp/configurator/RunningPriceTotal.tsx` — dynamically updated price: frame + lens index upgrade + Σ coatings + polarization + mirror
    - Create `components/pdp/configurator/ConfigSummary.tsx` — frame colour, lens type, material, coatings, Rx status, itemised price breakdown, edit buttons per section
    - For sunglasses: show tint, polarization, mirror in summary
    - Show "Send Later" reminder if applicable
    - _Requirements: 14.5, 14.6, 36.1, 36.2, 36.3, 36.4, 36.5, 36.6, 36.7, 36.8_

  - [ ]* 10.10 Write property test for configurator pricing invariant
    - **Property 3: Configurator Pricing Invariant**
    - Test that for any complete configuration, running total = frame + lens index + Σ coatings + polarization + mirror, and summary breakdown sums to the same total.
    - **Validates: Requirements 14.5, 14.6, 36.3**

  - [ ]* 10.11 Write property test for back-navigation preserving state
    - **Property 4: Configurator Back-Navigation Preserves State**
    - Test that navigating back to step Si and forward preserves all non-invalidated selections.
    - **Validates: Requirements 14.7**

  - [ ]* 10.12 Write property test for invalidation clearing downstream
    - **Property 5: Configurator Invalidation Clears Downstream**
    - Test that changing a selection in step Si clears incompatible selections in later steps.
    - **Validates: Requirements 14.8**

  - [ ]* 10.13 Write property test for incomplete configuration disabling Add to Cart
    - **Property 6: Incomplete Configuration Disables Add to Cart**
    - Test that for any configurator state with at least one required step incomplete, Add to Cart is disabled.
    - **Validates: Requirements 15.2**

- [x] 11. Add to Cart and Cart Line Attribute Serialization
  - [x] 11.1 Implement Add to Cart button on PDP
    - Create `components/pdp/AddToCartButton.tsx` — disabled until configurator complete, disabled when out of stock (Sold Out label)
    - On click: call cartLinesAdd with variant ID + all configurator selections as cart line attributes (_lensType, _lensIndex, _coatings, _sunTint, _polarized, _mirrorCoating, _rxStatus, _rxData, _lensUpgradePrice, _coatingsPrice, _totalConfigPrice)
    - Create cart if none exists (cartCreate), then add line
    - Open Cart Drawer on success
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7_

  - [ ]* 11.2 Write property test for configuration serialization round-trip
    - **Property 7: Configuration Serialization to Cart Attributes**
    - Test that serializing any complete LensConfiguration to cart attributes and deserializing back produces an equivalent configuration.
    - **Validates: Requirements 15.3, 15.7**

- [x] 12. Cart Drawer and Checkout
  - [x] 12.1 Implement Cart Context and Provider
    - Create `context/CartContext.tsx` — React Context with cart state, cartId cookie persistence, isOpen, isLoading
    - Implement addToCart, updateLineItem, removeLineItem methods calling Storefront API mutations
    - Implement cart recovery: if cartId references expired cart, clear cookie and create new cart
    - _Requirements: 20.2, 15.5_

  - [x] 12.2 Implement Cart Drawer UI
    - Create `components/cart/CartDrawer.tsx` — slide-in panel from right, line items with image/title/variant/quantity/price, configuration summary for configured items
    - Quantity change → cartLinesUpdate, remove → cartLinesRemove
    - Display subtotal, empty cart message with continue shopping CTA
    - Close on outside click or close button
    - _Requirements: 20.1, 20.3, 20.4, 20.5, 20.6, 20.7_

  - [x] 12.3 Implement Checkout redirect
    - Create checkout button in Cart Drawer that redirects to `cart.checkoutUrl`
    - _Requirements: 21.1, 21.2, 21.3_

  - [ ]* 12.4 Write property test for Cart Drawer line item completeness
    - **Property 8: Cart Drawer Line Item Completeness**
    - Test that for any set of cart line items, the drawer renders image, title, variant info, quantity, and line price for each.
    - **Validates: Requirements 20.1**

  - [ ]* 12.5 Write property test for Cart Subtotal invariant
    - **Property 9: Cart Subtotal Invariant**
    - Test that for any cart with N items, subtotal = Σ(line price × quantity).
    - **Validates: Requirements 20.5**

- [x] 13. Checkpoint — Ensure PDP, configurator, and cart flow work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Account pages (authenticated)
  - [x] 14.1 Implement Account Dashboard
    - Create `app/account/page.tsx` — SSR page (auth-gated via middleware), query Customer Account API for profile, order history, addresses
    - Display profile section, order history, loyalty tier
    - _Requirements: 22.3, 25.1, 25.2, 25.3, 25.4_

  - [x] 14.2 Implement Wishlist page and Favourite icon
    - Create `app/account/wishlist/page.tsx` — display favourited products with links to PDPs
    - Create `context/WishlistContext.tsx` — React Context reading/writing customer metafield via Customer Account API
    - Create `components/shared/FavouriteIcon.tsx` — heart icon on product cards (filled/outline), toggle add/remove, visible only when authenticated
    - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6_

  - [x] 14.3 Implement Prescriptions page
    - Create `app/account/prescriptions/page.tsx` — list saved Prescription_Records with optometrist name, date, values
    - Implement add new prescription form with validation (Sphere, Cylinder, Axis, PD required fields)
    - Implement delete prescription
    - Save/read via Customer Account API customer metafield
    - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

  - [x] 14.4 Implement Loyalty section
    - Create `components/account/LoyaltySection.tsx` — display current tier (Essential/CULT/VAULT), benefits, progress indicator toward next tier
    - Read loyalty data from customer metafield
    - _Requirements: 25.1, 25.2, 25.3, 25.4_

- [x] 15. Store Locator page
  - [x] 15.1 Implement Store Locator
    - Create `app/pages/stores/page.tsx` (or handle via `app/pages/[handle]/page.tsx` with stores logic) — query store_location metaobjects
    - Display each store with name, address, phone, operating hours (structured by day), map/directions link
    - Expand/detail view on click, external directions link (Google Maps)
    - Empty state message when no stores exist
    - Mobile: single-column stacked layout
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6, 31.7, 31.8_

- [x] 16. Static and content pages
  - [x] 16.1 Implement static page template and routing
    - Create `app/pages/[handle]/page.tsx` — generic static page fetching content from Shopify Metaobjects, rendering About, Eye Exams, Stylist Appointment pages
    - _Requirements: 28.4_

  - [x] 16.2 Implement Journal/Editorial pages
    - Create `app/journal/[slug]/page.tsx` — editorial article page fetching content from Shopify Metaobjects
    - _Requirements: 28.5_

  - [x] 16.3 Implement 404 Not Found page
    - Create `app/not-found.tsx` — custom 404 page
    - _Requirements: 28.7_

- [x] 17. ISR revalidation webhook
  - [x] 17.1 Implement on-demand ISR revalidation route
    - Create `app/api/revalidate/route.ts` — webhook endpoint that triggers `revalidatePath` or `revalidateTag` for product/collection/metaobject updates from Shopify
    - _Requirements: 30.3, 31.5_

- [x] 18. Checkpoint — Ensure all pages render and account flow works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 19. Responsive design pass
  - [x] 19.1 Implement responsive layouts across all pages
    - PLP: single or two-column grid on mobile instead of three columns
    - Product Row: swipeable carousel on mobile
    - Ensure all interactive elements meet 44x44px minimum touch target on mobile
    - Configuration Summary: vertically stacked on mobile
    - Store Locator: single-column stacked on mobile
    - Mobile nav: hamburger menu below desktop breakpoint
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 36.6, 31.8, 4.1_

  - [ ]* 19.2 Write unit tests for responsive breakpoint behavior
    - Test PLP grid column changes at breakpoints
    - Test mobile nav visibility at breakpoints
    - _Requirements: 29.1, 29.2, 4.1_

- [x] 20. Integration tests
  - [ ]* 20.1 Write integration tests for Storefront API interactions
    - Mock Storefront API responses with MSW
    - Test product queries return expected structure with metafields
    - Test collection queries with filters, sort, and cursor pagination
    - Test cart mutations (create, add, update, remove)
    - Test metaobject queries (announcement bar, hero, editorial, stores, lens options)
    - _Requirements: 27.1, 27.3, 27.4, 27.5_

  - [ ]* 20.2 Write integration tests for Customer Account API interactions
    - Mock Customer Account API responses
    - Test OAuth flow (login redirect, callback token exchange, logout)
    - Test wishlist CRUD via customer metafield
    - Test prescription CRUD via customer metafield
    - _Requirements: 22.1, 22.2, 22.5, 23.2, 23.3, 24.2, 24.4_

  - [ ]* 20.3 Write integration tests for Lens Configurator end-to-end flow
    - Test full configurator flow: type → index → coatings → prescription → summary → add to cart
    - Test sunglasses flow with tint, polarization, mirror options
    - Test Readers flow with magnification selector
    - Test Non-Prescription flow skipping Rx step
    - _Requirements: 14.1, 32.1, 32.13, 32.14, 35.1_

- [x] 21. Deployment setup
  - [x] 21.1 Configure Vercel deployment and environment
    - Create `vercel.json` if needed for custom configuration
    - Document required Vercel environment variables
    - Ensure Next.js Image component is used for all product and editorial images (automatic optimization, lazy loading, responsive sizing)
    - Verify ISR revalidation intervals are configured (60s for products/collections, 300s for static pages)
    - Verify Storefront API token is server-side only (not in `NEXT_PUBLIC_` prefix)
    - _Requirements: 30.1, 30.2, 30.3, 30.4_

- [x] 22. Final checkpoint — Ensure all tests pass and build succeeds
  - Run `npm run build` to verify production build succeeds
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at natural breakpoints
- Property tests validate the 14 universal correctness properties from the design document using `fast-check`
- Unit tests validate specific examples and edge cases
- The Lens Configurator (tasks 10.x) is the most complex feature — it has 9 sub-tasks including 6 property tests
- All 14 correctness properties from the design are covered: Properties 1–14 map to tasks 6.4, 7.4, 10.10, 10.11, 10.12, 10.13, 11.2, 12.4, 12.5, 10.8, 5.5, 2.2, 10.7, 10.5
