import { notFound } from 'next/navigation';
import { getCollectionProducts } from '@/lib/shopify/queries/collection';
import { getEditorialPanels } from '@/lib/shopify/queries/metaobjects';
import { filterByAccess, getEarlyAccessLabel } from '@/lib/crm/early-access';
import { getAccessToken } from '@/lib/shopify/auth';
import CollectionClient from './CollectionClient';

export const revalidate = 60;

interface CollectionPageProps {
  params: { handle: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default async function CollectionPage({ params, searchParams }: CollectionPageProps) {
  const handle = decodeURIComponent(params.handle);

  // Parse filter/sort from URL search params
  const sortParam = (typeof searchParams.sort === 'string' ? searchParams.sort : undefined) as
    | 'relevance'
    | 'for-you'
    | 'price-asc'
    | 'price-desc'
    | 'newest'
    | undefined;

  const shapeParam = typeof searchParams.shape === 'string' ? searchParams.shape : undefined;
  const colourParam = typeof searchParams.colour === 'string' ? searchParams.colour : undefined;
  const materialParam = typeof searchParams.material === 'string' ? searchParams.material : undefined;
  const sizeParam = typeof searchParams.size === 'string' ? searchParams.size : undefined;

  // Build Storefront API sort key
  const sortKeyMap: Record<string, { sortKey: string; reverse: boolean }> = {
    relevance: { sortKey: 'COLLECTION_DEFAULT', reverse: false },
    'price-asc': { sortKey: 'PRICE', reverse: false },
    'price-desc': { sortKey: 'PRICE', reverse: true },
    newest: { sortKey: 'CREATED', reverse: true },
  };
  const sortConfig = sortKeyMap[sortParam ?? 'relevance'];

  // Filters are applied client-side using metafield data from /api/storefront/filters

  try {
    const [result, editorialPanels] = await Promise.all([
      getCollectionProducts({
        handle,
        first: 100,
        sortKey: sortConfig.sortKey as 'COLLECTION_DEFAULT' | 'PRICE' | 'TITLE' | 'CREATED' | 'BEST_SELLING',
        reverse: sortConfig.reverse,
      }),
      getEditorialPanels().catch(() => []),
    ]);

    if (!result.collection) {
      notFound();
    }

    // Early access gating — filter products by customer tier
    let customerTier: string | null = null;
    try {
      const token = getAccessToken();
      if (token) {
        const { getCustomerProfile } = await import('@/lib/shopify/customer');
        const profile = await getCustomerProfile(token);
        const customerId = profile.id.replace(/^gid:\/\/shopify\/Customer\//, '');
        const { db } = await import('@/lib/db');
        const { customersProjection } = await import('@/lib/db/schema');
        const { eq } = await import('drizzle-orm');
        const { getTierFromTags } = await import('@/lib/crm/loyalty-config');
        const client = await db.select({ tags: customersProjection.tags }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, customerId)).then(r => r[0]);
        customerTier = getTierFromTags(client?.tags ?? null);
      }
    } catch {}
    if (process.env.DEV_CUSTOMER_ID && (process.env.NODE_ENV !== 'production' || process.env.DEMO_MODE === '1')) {
      try {
        const { db } = await import('@/lib/db');
        const { customersProjection } = await import('@/lib/db/schema');
        const { eq } = await import('drizzle-orm');
        const { getTierFromTags } = await import('@/lib/crm/loyalty-config');
        const client = await db.select({ tags: customersProjection.tags }).from(customersProjection).where(eq(customersProjection.shopifyCustomerId, process.env.DEV_CUSTOMER_ID)).then(r => r[0]);
        customerTier = getTierFromTags(client?.tags ?? null);
      } catch {}
    }

    const accessibleProducts = filterByAccess(result.products.map(p => ({ ...p, tags: (p as any).tags ?? [] })), customerTier);

    // Filter editorial panels for PLP placement
    const plpPanels = editorialPanels.filter(
      (p) => p.placement === 'plp' || p.placement === 'both'
    );

    return (
      <CollectionClient
        collection={result.collection}
        initialProducts={accessibleProducts}
        initialPageInfo={result.pageInfo}
        editorialPanels={plpPanels}
        collectionHandle={handle}
        initialSort={sortParam ?? 'relevance'}
        initialFilters={{
          shape: shapeParam ? shapeParam.split(',') : [],
          colour: colourParam ? colourParam.split(',') : [],
          material: materialParam ? materialParam.split(',') : [],
          size: sizeParam ? sizeParam.split(',') : [],
        }}
      />
    );
  } catch {
    return (
      <div className="site-container flex flex-col items-center justify-center min-h-[50vh]">
        <p className="text-lg text-gray-600 mb-4">Unable to load products. Please try again.</p>
        <a
          href={`/collections/${handle}`}
          className="px-6 py-2 border border-black text-sm hover:bg-black hover:text-white transition-colors"
        >
          Retry
        </a>
      </div>
    );
  }
}
