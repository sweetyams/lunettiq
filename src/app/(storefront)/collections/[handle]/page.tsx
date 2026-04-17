import { notFound } from 'next/navigation';
import { getCollectionProducts } from '@/lib/shopify/queries/collection';
import { getEditorialPanels } from '@/lib/shopify/queries/metaobjects';
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

  // Build tag-based filters from search params
  const tagFilters: Array<{ tag: string }> = [];
  if (shapeParam) {
    shapeParam.split(',').forEach((v) => tagFilters.push({ tag: `shape:${v}` }));
  }
  if (colourParam) {
    colourParam.split(',').forEach((v) => tagFilters.push({ tag: `colour:${v}` }));
  }
  if (materialParam) {
    materialParam.split(',').forEach((v) => tagFilters.push({ tag: `material:${v}` }));
  }
  if (sizeParam) {
    sizeParam.split(',').forEach((v) => tagFilters.push({ tag: `size:${v}` }));
  }

  try {
    const [result, editorialPanels] = await Promise.all([
      getCollectionProducts({
        handle,
        first: 24,
        sortKey: sortConfig.sortKey as 'COLLECTION_DEFAULT' | 'PRICE' | 'TITLE' | 'CREATED' | 'BEST_SELLING',
        reverse: sortConfig.reverse,
        filters: tagFilters.length > 0 ? tagFilters : undefined,
      }),
      getEditorialPanels().catch(() => []),
    ]);

    if (!result.collection) {
      notFound();
    }

    // Filter editorial panels for PLP placement
    const plpPanels = editorialPanels.filter(
      (p) => p.placement === 'plp' || p.placement === 'both'
    );

    return (
      <CollectionClient
        collection={result.collection}
        initialProducts={result.products}
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
      <div className="flex flex-col items-center justify-center min-h-[50vh] px-6">
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
