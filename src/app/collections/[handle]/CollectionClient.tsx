'use client';

import { useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Collection, Product } from '@/types/shopify';
import type { SortOption } from '@/types/filters';
import type { EditorialPanel as EditorialPanelType } from '@/types/metaobjects';
import FilterBar from '@/components/plp/FilterBar';
import ProductGrid from '@/components/plp/ProductGrid';

interface ActiveFilters {
  shape: string[];
  colour: string[];
  material: string[];
  size: string[];
}

interface CollectionClientProps {
  collection: Collection;
  initialProducts: Product[];
  initialPageInfo: { hasNextPage: boolean; endCursor: string | null };
  editorialPanels: EditorialPanelType[];
  collectionHandle: string;
  initialSort: SortOption;
  initialFilters: ActiveFilters;
}

export default function CollectionClient({
  collection,
  initialProducts,
  initialPageInfo,
  editorialPanels,
  collectionHandle,
  initialSort,
  initialFilters,
}: CollectionClientProps) {
  const router = useRouter();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const searchParams = useSearchParams();

  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [pageInfo, setPageInfo] = useState(initialPageInfo);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>(initialSort);
  const [filters, setFilters] = useState<ActiveFilters>(initialFilters);

  // Build URL search params from current filter/sort state
  const buildSearchParams = useCallback(
    (newFilters: ActiveFilters, newSort: SortOption) => {
      const params = new URLSearchParams();
      if (newSort !== 'relevance') params.set('sort', newSort);
      if (newFilters.shape.length > 0) params.set('shape', newFilters.shape.join(','));
      if (newFilters.colour.length > 0) params.set('colour', newFilters.colour.join(','));
      if (newFilters.material.length > 0) params.set('material', newFilters.material.join(','));
      if (newFilters.size.length > 0) params.set('size', newFilters.size.join(','));
      return params.toString();
    },
    []
  );

  // Navigate with updated search params (triggers server re-fetch via ISR)
  const updateUrl = useCallback(
    (newFilters: ActiveFilters, newSort: SortOption) => {
      const qs = buildSearchParams(newFilters, newSort);
      const url = `/collections/${collectionHandle}${qs ? `?${qs}` : ''}`;
      router.push(url, { scroll: false });
    },
    [collectionHandle, router, buildSearchParams]
  );

  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      setSort(newSort);
      updateUrl(filters, newSort);
    },
    [filters, updateUrl]
  );

  const handleFilterChange = useCallback(
    (newFilters: ActiveFilters) => {
      setFilters(newFilters);
      updateUrl(newFilters, sort);
    },
    [sort, updateUrl]
  );

  const handleClearFilters = useCallback(() => {
    const cleared: ActiveFilters = { shape: [], colour: [], material: [], size: [] };
    setFilters(cleared);
    updateUrl(cleared, sort);
  }, [sort, updateUrl]);

  // Infinite scroll: load more products
  const loadMore = useCallback(async () => {
    if (!pageInfo.hasNextPage || !pageInfo.endCursor || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams();
      params.set('cursor', pageInfo.endCursor);
      params.set('sort', sort);
      if (filters.shape.length > 0) params.set('shape', filters.shape.join(','));
      if (filters.colour.length > 0) params.set('colour', filters.colour.join(','));
      if (filters.material.length > 0) params.set('material', filters.material.join(','));
      if (filters.size.length > 0) params.set('size', filters.size.join(','));

      const res = await fetch(`/api/collections/${collectionHandle}/products?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load');

      const result = await res.json();
      setProducts((prev) => [...prev, ...result.products]);
      setPageInfo(result.pageInfo);
      setLoadError(null);
    } catch {
      setLoadError('Failed to load more products.');
    } finally {
      setIsLoadingMore(false);
    }
  }, [pageInfo, isLoadingMore, sort, filters, collectionHandle]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const hasActiveFilters =
    filters.shape.length > 0 ||
    filters.colour.length > 0 ||
    filters.material.length > 0 ||
    filters.size.length > 0;

  return (
    <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-8">
      <h1 className="text-2xl md:text-3xl font-light tracking-wide mb-6">
        {collection.title}
      </h1>

      <FilterBar
        itemCount={products.length}
        sort={sort}
        filters={filters}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        products={initialProducts}
      />

      <ProductGrid
        products={products}
        editorialPanels={editorialPanels}
        editorialInterval={9}
      />

      {/* Infinite scroll trigger / Load more */}
      {pageInfo.hasNextPage && (
        <div className="mt-8 flex justify-center">
          {isLoadingMore ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-black rounded-full animate-spin" />
              Loading more...
            </div>
          ) : (
            <InfiniteScrollTrigger onIntersect={loadMore} />
          )}
        </div>
      )}

      {loadError && (
        <div className="mt-4 flex flex-col items-center gap-2">
          <p className="text-sm text-red-600">{loadError}</p>
          <button
            onClick={loadMore}
            className="px-6 py-2 border border-black text-sm hover:bg-black hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Fallback load more button */}
      {pageInfo.hasNextPage && !isLoadingMore && !loadError && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            className="px-8 py-3 border border-black text-sm hover:bg-black hover:text-white transition-colors"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}

// IntersectionObserver-based infinite scroll trigger
function InfiniteScrollTrigger({ onIntersect }: { onIntersect: () => void }) {
  const ref = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting) {
            onIntersect();
          }
        },
        { rootMargin: '200px' }
      );
      observer.observe(node);
      return () => observer.disconnect();
    },
    [onIntersect]
  );

  return <div ref={ref} className="h-1" />;
}
