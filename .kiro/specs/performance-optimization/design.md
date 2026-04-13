# Design Document

## Overview

Performance optimization for the Lunettiq Next.js 14 headless Shopify site. The current codebase uses ISR with `revalidate = 60`, server components, and `next/image` but lacks streaming, lazy loading, Shopify CDN direct image delivery, client-side memoization, and bundle analysis tooling. This design addresses all 10 requirements from the spec.

## Architecture Changes

### 1. Shopify CDN Image Loader (Req 1)

Create `src/lib/shopify-image-loader.ts` exporting a custom `ImageLoader` that rewrites `cdn.shopify.com` URLs using Shopify's `_WIDTHx` transform syntax.

```typescript
// src/lib/shopify-image-loader.ts
import type { ImageLoaderProps } from 'next/image';

export default function shopifyImageLoader({ src, width }: ImageLoaderProps): string {
  const url = new URL(src);
  const path = url.pathname;
  const ext = path.substring(path.lastIndexOf('.'));
  const base = path.substring(0, path.lastIndexOf('.'));
  return `${url.origin}${base}_${width}x${ext}`;
}
```

Update `next.config.mjs`:
- Set `images.loader: 'custom'` and `images.loaderFile: './src/lib/shopify-image-loader.ts'`
- Remove `remotePatterns` (no longer needed with custom loader)

### 2. Suspense Streaming & Skeleton UI (Req 2)

Create skeleton components in `src/components/skeletons/`:
- `HeroSkeleton.tsx` — two side-by-side `bg-[#F5F5F9] animate-pulse` divs matching hero aspect ratio
- `ProductCardSkeleton.tsx` — single card placeholder with image box + text lines
- `ProductGridSkeleton.tsx` — grid of `ProductCardSkeleton` (6 items)
- `PDPSkeleton.tsx` — two-column layout placeholder matching PDP structure

Create `loading.tsx` route files:
- `src/app/loading.tsx` — renders `HeroSkeleton` + category panel placeholders
- `src/app/collections/[handle]/loading.tsx` — renders `ProductGridSkeleton`
- `src/app/products/[handle]/loading.tsx` — renders `PDPSkeleton`

Wrap below-fold PDP sections in `<Suspense>` boundaries in the PDP server page (`src/app/products/[handle]/page.tsx`):
- Fetch recommendations, eyeTestCTAs, lensOptions in separate async components wrapped with `<Suspense fallback={<Skeleton />}>`
- Keep the main product fetch blocking (it's above the fold)

### 3. Dynamic Imports for Below-Fold Components (Req 3)

In `src/app/page.tsx`, replace static imports of `EditorialPanel`, `EditorialTwoUp`, and `StoreTeaser` with `next/dynamic`:

```typescript
const EditorialPanel = dynamic(() => import('@/components/home/EditorialPanel'), { ssr: false });
const EditorialTwoUp = dynamic(() => import('@/components/home/EditorialTwoUp'), { ssr: false });
const StoreTeaser = dynamic(() => import('@/components/home/StoreTeaser'), { ssr: false });
```

In `ProductClient.tsx`, dynamically import below-fold PDP components:

```typescript
const Recommendations = dynamic(() => import('@/components/pdp/Recommendations'), { ssr: false });
const OnFacesSection = dynamic(() => import('@/components/pdp/OnFacesSection'), { ssr: false });
const EyeTestCTABlock = dynamic(() => import('@/components/pdp/EyeTestCTA'), { ssr: false });
const LensConfigurator = dynamic(() => import('@/components/pdp/LensConfigurator'), {
  loading: () => <div className="h-48 bg-[#F5F5F9] animate-pulse rounded" />,
});
```

Viewport-triggered loading: wrap each dynamic component container with an `IntersectionObserver`-based wrapper that only renders the component when it enters the viewport. On error, render an empty `<div>` to prevent layout breakage.

### 4. HTTP Cache Headers & SWR (Req 4)

Pages already use `export const revalidate = 60` which sets `s-maxage=60` on Vercel. Add `stale-while-revalidate` via `next.config.mjs` headers config:

```javascript
async headers() {
  return [
    {
      source: '/api/metaobjects/:path*',
      headers: [{ key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' }],
    },
  ];
}
```

No changes needed to middleware — it already passes through non-account requests via `NextResponse.next()` with the `/account/:path*` matcher.

The revalidation endpoint (`/api/revalidate/route.ts`) already returns 200 on success. No changes needed.

### 5. Client-Side Rendering Optimization (Req 5)

**ProductCard** — wrap export with `React.memo` and a custom comparator:

```typescript
export default memo(ProductCard, (prev, next) =>
  prev.product.id === next.product.id && prev.product.updatedAt === next.product.updatedAt
);
```

**ProductGrid** — wrap `gridItems` computation in `useMemo` keyed on `[products, editorialPanels, editorialInterval]`.

**Context splitting** — extract `isOpen`/`openCart`/`closeCart` from `CartContext` into a separate `CartDrawerContext` so drawer toggle doesn't re-render the product tree. Similarly extract wishlist loading state from item data.

**ProductCard hover** — the current implementation already uses local `useState` for hover, so parent re-renders are not triggered by hover. No change needed.

### 6. Image Placeholder & Progressive Loading (Req 6)

Add a CSS-based LQIP to the `ProductCard` and `HeroSection` image containers. The existing `bg-[#F5F5F9]` on ProductCard's image container already serves as a colour placeholder. Enhance with a pulse animation that fades out on image load:

```typescript
// In ProductCard image container, add onLoad handler to primary Image
const [loaded, setLoaded] = useState(false);
// Container: className includes `bg-[#F5F5F9] ${!loaded ? 'animate-pulse' : ''}`
// Image: onLoad={() => setLoaded(true)}
```

Apply the same pattern to `HeroSection` images. Transition is handled by the existing `object-cover` + opacity approach — no layout shift since containers use fixed aspect ratios.

### 7. Link Prefetching Strategy (Req 7)

- Header and CategoryPanels already use `<Link>` which has viewport-based prefetching by default in Next.js 14. No change needed.
- In `ProductCard`, the existing `<Link>` already prefetches by default. Add `prefetch={true}` explicitly for clarity.
- To limit concurrent prefetches on PLP, set `prefetch={false}` on ProductCard links and use an `IntersectionObserver` in `ProductGrid` that prefetches via `router.prefetch()` with a concurrency queue (max 3 concurrent).

### 8. Bundle Analysis Tooling (Req 8)

Install `@next/bundle-analyzer` as devDependency. Update `next.config.mjs`:

```javascript
import withBundleAnalyzer from '@next/bundle-analyzer';

const config = { /* existing config */ };

export default process.env.ANALYZE === 'true'
  ? withBundleAnalyzer({ enabled: true })(config)
  : config;
```

Add npm script: `"analyze": "ANALYZE=true next build"`

### 9. Collection Page Infinite Scroll API Route (Req 9)

Create `src/app/api/collections/[handle]/products/route.ts`:

```typescript
// GET /api/collections/[handle]/products?cursor=X&sort=Y&shape=Z...
// Returns { products, pageInfo } with Cache-Control: private, no-store
```

Update `CollectionClient.tsx` `loadMore` to call this API route via `fetch()` instead of dynamically importing the server function. On failure, show inline error with retry button, preserving already-loaded products.

### 10. Performance Measurement (Req 10)

Install `@lhci/cli` as devDependency. Create `lighthouserc.js` config targeting:
- `http://localhost:3000` (homepage)
- `http://localhost:3000/collections/optics` (PLP)
- `http://localhost:3000/products/<sample-handle>` (PDP)

Add npm script: `"perf:measure": "next build && next start & sleep 5 && lhci autorun"`

Output: JSON results in `.lighthouseci/` directory for before/after comparison.

## Files to Create

| File | Purpose |
|------|---------|
| `src/lib/shopify-image-loader.ts` | Custom Shopify CDN image loader |
| `src/components/skeletons/HeroSkeleton.tsx` | Hero section skeleton |
| `src/components/skeletons/ProductCardSkeleton.tsx` | Single product card skeleton |
| `src/components/skeletons/ProductGridSkeleton.tsx` | PLP grid skeleton |
| `src/components/skeletons/PDPSkeleton.tsx` | PDP page skeleton |
| `src/app/loading.tsx` | Homepage route loading UI |
| `src/app/collections/[handle]/loading.tsx` | PLP route loading UI |
| `src/app/products/[handle]/loading.tsx` | PDP route loading UI |
| `src/app/api/collections/[handle]/products/route.ts` | Paginated products API route |
| `src/components/shared/LazyLoad.tsx` | IntersectionObserver viewport wrapper |
| `src/context/CartDrawerContext.tsx` | Separated cart drawer open/close state |
| `lighthouserc.js` | Lighthouse CI configuration |

## Files to Modify

| File | Change |
|------|--------|
| `next.config.mjs` | Custom image loader, bundle analyzer, cache headers |
| `package.json` | Add `@next/bundle-analyzer`, `@lhci/cli` devDeps + scripts |
| `src/app/page.tsx` | Dynamic imports for below-fold components |
| `src/app/products/[handle]/page.tsx` | Suspense boundaries for below-fold data |
| `src/app/products/[handle]/ProductClient.tsx` | Dynamic imports for Recommendations, OnFaces, EyeTestCTA, LensConfigurator |
| `src/app/collections/[handle]/CollectionClient.tsx` | Use API route for loadMore, prefetch queue |
| `src/components/shared/ProductCard.tsx` | React.memo, LQIP onLoad, prefetch control |
| `src/components/plp/ProductGrid.tsx` | useMemo for gridItems, prefetch queue |
| `src/components/home/HeroSection.tsx` | LQIP pulse animation |
| `src/app/layout.tsx` | Split CartProvider / CartDrawerProvider |
| `src/context/CartContext.tsx` | Remove isOpen/openCart/closeCart to CartDrawerContext |

## Dependency on Existing Patterns

- All skeleton components use Tailwind's `animate-pulse` and `bg-[#F5F5F9]` matching existing container colours
- Dynamic imports use `next/dynamic` which is already available in Next.js 14
- The `LazyLoad` wrapper reuses the same `IntersectionObserver` pattern already in `CollectionClient.tsx`'s `InfiniteScrollTrigger`
- Cache headers leverage Next.js built-in `revalidate` export and `next.config.mjs` headers config
