# Requirements Document

## Introduction

Performance optimization for the Lunettiq headless Shopify eyewear e-commerce site built on Next.js 14 App Router. The site currently uses ISR, server components, and next/image but has significant gaps in streaming, lazy loading, image delivery, caching, and client-side rendering efficiency. This spec targets measurable improvements to Largest Contentful Paint (LCP), First Input Delay (FID), Cumulative Layout Shift (CLS), and Time to Interactive (TTI) across the homepage, collection pages (PLP), and product detail pages (PDP).

## Glossary

- **App**: The Lunettiq Next.js 14 application
- **Shopify_CDN_Loader**: A custom Next.js image loader that generates Shopify CDN transform URLs directly, bypassing Vercel's image optimization proxy
- **Skeleton_UI**: Lightweight placeholder components rendered during data loading, using animated pulse shapes that match the layout of the content they replace
- **Streaming_Shell**: The initial HTML response containing layout chrome (header, footer, navigation) and Suspense fallbacks, sent to the browser before async data fetches complete
- **Dynamic_Import**: A Next.js `next/dynamic` call that code-splits a component into a separate JS chunk loaded on demand
- **Below_Fold_Component**: Any component not visible in the initial viewport without scrolling (e.g., EditorialPanel, StoreTeaser, Recommendations, OnFacesSection, LensConfigurator)
- **Cache_Header**: HTTP `Cache-Control` response header controlling browser and CDN caching behaviour
- **SWR_Pattern**: Stale-while-revalidate caching strategy where stale content is served immediately while fresh content is fetched in the background
- **Context_Provider**: A React context component (CartProvider, WishlistProvider) that wraps the component tree and triggers re-renders on state changes
- **ProductCard**: The shared client component (`src/components/shared/ProductCard.tsx`) rendering a product tile with hover image swap
- **ProductGrid**: The PLP grid component (`src/components/plp/ProductGrid.tsx`) rendering product cards with editorial panel interleaving
- **Bundle_Analyzer**: The `@next/bundle-analyzer` package that visualizes JavaScript bundle composition and chunk sizes
- **LQIP**: Low-Quality Image Placeholder — a blurred preview shown while the full image loads

## Requirements

### Requirement 1: Shopify CDN Image Loader

**User Story:** As a shopper, I want product images to load as fast as possible, so that I can browse eyewear without waiting for images to render.

#### Acceptance Criteria

1. THE App SHALL use a custom Shopify_CDN_Loader for all `next/image` components that serve images from `cdn.shopify.com`
2. WHEN an image is requested, THE Shopify_CDN_Loader SHALL generate a URL using Shopify's CDN `_WIDTHx` transform syntax with the requested width
3. THE App SHALL disable the default Vercel image optimization for Shopify CDN images by setting `unoptimized: true` on the custom loader or configuring `images.loader` in `next.config.mjs`
4. WHEN the Shopify_CDN_Loader generates a URL, THE Shopify_CDN_Loader SHALL preserve the original image path and append only the width transform parameter

### Requirement 2: Suspense Streaming and Skeleton UI

**User Story:** As a shopper, I want to see the page layout immediately while content loads, so that the site feels responsive even on slow connections.

#### Acceptance Criteria

1. WHEN the homepage is requested, THE App SHALL stream the Streaming_Shell (header, hero section) to the browser before below-fold data fetches complete
2. WHEN the PDP is requested, THE App SHALL wrap the recommendations, OnFacesSection, and EyeTestCTA sections in Suspense boundaries with Skeleton_UI fallbacks
3. WHEN the PLP is requested, THE App SHALL display a Skeleton_UI grid of placeholder cards while the initial product data loads
4. THE App SHALL provide `loading.tsx` files for the homepage, PLP, and PDP routes that render Skeleton_UI matching the layout of each page
5. WHEN a Suspense boundary is waiting for data, THE Skeleton_UI fallback SHALL match the dimensions of the content it replaces to prevent layout shift

### Requirement 3: Dynamic Imports for Below-Fold Components

**User Story:** As a shopper, I want the interactive parts of the page I can see to work immediately, so that I do not wait for off-screen features to load.

#### Acceptance Criteria

1. THE App SHALL load EditorialPanel, EditorialTwoUp, and StoreTeaser on the homepage using Dynamic_Import with SSR disabled
2. THE App SHALL load Recommendations, OnFacesSection, and EyeTestCTA on the PDP using Dynamic_Import with SSR disabled
3. THE App SHALL load LensConfigurator on the PDP using Dynamic_Import with a Skeleton_UI fallback
4. WHEN a dynamically imported component enters the viewport, THE App SHALL begin loading its JavaScript chunk
5. IF a Dynamic_Import fails to load, THEN THE App SHALL render an empty container without breaking the page layout

### Requirement 4: HTTP Cache Headers and Stale-While-Revalidate

**User Story:** As a shopper, I want repeat visits and navigation to feel instant, so that I can browse the catalogue without redundant loading.

#### Acceptance Criteria

1. THE App SHALL set `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` on all ISR page responses via Next.js configuration
2. WHEN the API revalidation endpoint receives a valid request, THE App SHALL purge the relevant cached pages and return a 200 status
3. THE App SHALL set `Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400` on API routes serving static content (editorial panels, category panels, homepage heroes)
4. WHEN the middleware processes a non-account request, THE middleware SHALL pass through without adding latency or modifying cache headers

### Requirement 5: Client-Side Rendering Optimization

**User Story:** As a shopper, I want smooth scrolling and interaction on product listing pages, so that browsing large catalogues does not feel sluggish.

#### Acceptance Criteria

1. THE App SHALL memoize ProductCard using `React.memo` with a custom equality check comparing `product.id` and `product.updatedAt`
2. THE App SHALL memoize the ProductGrid item list computation using `useMemo` to prevent re-computation on unrelated state changes
3. THE App SHALL split CartProvider and WishlistProvider so that cart drawer open/close state changes do not trigger re-renders in product listing components
4. WHEN the ProductCard hover state changes, THE ProductCard SHALL update only its own image opacity without triggering a parent re-render

### Requirement 6: Image Placeholder and Progressive Loading

**User Story:** As a shopper, I want to see a blurred preview of images while they load, so that the page does not flash empty boxes.

#### Acceptance Criteria

1. THE App SHALL display a CSS-based LQIP placeholder for all product images rendered by ProductCard
2. THE App SHALL display a CSS-based LQIP placeholder for hero images on the homepage
3. WHEN the full-resolution image finishes loading, THE App SHALL transition from the LQIP to the full image without layout shift
4. THE LQIP placeholder SHALL use a neutral background colour matching the site's image container colour (`#F5F5F9`)

### Requirement 7: Link Prefetching Strategy

**User Story:** As a shopper, I want the next page I am likely to visit to load instantly when I click, so that navigation feels seamless.

#### Acceptance Criteria

1. THE App SHALL use Next.js `<Link>` with default viewport-based prefetching for all navigation links in the header and category panels
2. WHEN a ProductCard enters the viewport on the PLP, THE App SHALL prefetch the corresponding PDP route
3. THE App SHALL limit concurrent prefetch requests to avoid saturating the network on pages with many product cards

### Requirement 8: Bundle Analysis Tooling

**User Story:** As a developer, I want to visualize the JavaScript bundle composition, so that I can identify and eliminate large dependencies.

#### Acceptance Criteria

1. THE App SHALL include `@next/bundle-analyzer` as a dev dependency
2. WHEN the `ANALYZE=true` environment variable is set, THE App SHALL generate a bundle analysis report during the build
3. THE bundle analysis configuration SHALL not affect production builds when `ANALYZE` is not set

### Requirement 9: Collection Page Infinite Scroll Optimization

**User Story:** As a shopper, I want loading more products on a collection page to be fast and not re-fetch data through a client-side server function import.

#### Acceptance Criteria

1. THE App SHALL fetch additional collection products via a dedicated API route instead of dynamically importing a server function from a client component
2. WHEN the infinite scroll trigger fires, THE App SHALL call the API route with the current cursor, sort, and filter parameters
3. THE API route SHALL return products with `Cache-Control: private, no-store` to ensure fresh paginated results
4. IF the API route fails, THEN THE App SHALL display an inline error message and a retry button without losing already-loaded products

### Requirement 10: Performance Measurement Before and After

**User Story:** As a developer, I want to capture page speed metrics before and after optimization, so that I can quantify the impact of each change and prove improvements.

#### Acceptance Criteria

1. THE App SHALL include a performance measurement script that runs Lighthouse CI audits against the homepage, a PLP route, and a PDP route
2. BEFORE any optimization changes are applied, THE developer SHALL run the measurement script and record baseline scores for LCP, FID/TBT, CLS, TTI, and overall Performance score
3. AFTER all optimization changes are applied, THE developer SHALL run the same measurement script and record post-optimization scores
4. THE measurement script SHALL output results in a structured format (JSON or markdown table) that enables side-by-side comparison of before and after metrics
5. THE App SHALL include `@lhci/cli` as a dev dependency and provide an npm script (`perf:measure`) to execute the audits
6. THE measurement configuration SHALL target production builds (`next build && next start`) to ensure results reflect real-world performance
