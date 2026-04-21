'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Collection, Product } from '@/types/shopify';
import type { SortOption } from '@/types/filters';
import type { EditorialPanel as EditorialPanelType } from '@/types/metaobjects';
import type { MemberContext } from '@/app/api/account/personalization/route';
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

type ProductWithTags = Product & { tags?: string[] };

function getProductTags(p: Product): string[] {
  return (p as ProductWithTags).tags ?? [];
}

function scoreForYou(product: Product, ctx: MemberContext): number {
  const tags = getProductTags(product).map(t => t.toLowerCase());
  let score = 0;
  for (const a of ctx.stated.avoid ?? []) {
    if (tags.some(t => t.includes(a.toLowerCase()))) return -1000;
  }
  if (ctx.fit?.faceShape && tags.includes(`face-shape:${ctx.fit.faceShape.toLowerCase()}`)) score += 8;
  for (const s of ctx.stated.shapes ?? []) { if (tags.includes(`shape:${s.toLowerCase()}`)) { score += 6; break; } }
  for (const m of ctx.stated.materials ?? []) { if (tags.includes(`material:${m.toLowerCase()}`)) { score += 4; break; } }
  for (const c of ctx.stated.colours ?? []) { if (tags.includes(`colour:${c.toLowerCase()}`)) { score += 3; break; } }
  if (ctx.derived?.shapes) { for (const [s, w] of Object.entries(ctx.derived.shapes)) { if (tags.includes(`shape:${s.toLowerCase()}`)) { score += Math.min(w, 3); break; } } }
  if (ctx.derived?.materials) { for (const [m, w] of Object.entries(ctx.derived.materials)) { if (tags.includes(`material:${m.toLowerCase()}`)) { score += Math.min(w, 3); break; } } }
  const fw = ctx.fit?.frameWidthMm;
  const pfw = product.metafields.frameWidth;
  if (fw && pfw) { const diff = Math.abs(pfw - fw); if (diff <= 2) score += 5; else if (diff <= 4) score += 2; else if (diff > 8) score -= 4; }
  if (ctx.recommendations.some(r => r.productId === product.id)) score += 10;
  return score;
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
  const searchParams = useSearchParams();

  const [sort, setSort] = useState<SortOption>(initialSort);
  const [filters, setFilters] = useState<ActiveFilters>(initialFilters);
  const [memberCtx, setMemberCtx] = useState<MemberContext | null>(null);
  const [fitFilterDismissed, setFitFilterDismissed] = useState(false);
  const [filterData, setFilterData] = useState<{ options: Record<string, string[]>; colourLabels?: Record<string, string>; products: Record<string, { colours: string[]; shapes: string[]; material: string | null; size: string | null }> } | null>(null);

  useEffect(() => {
    fetch('/api/storefront/filters')
      .then(r => r.json()).then(d => setFilterData(d.data)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/account/personalization')
      .then(r => r.json())
      .then(d => {
        if (d.data) {
          setMemberCtx(d.data);
          if (d.data.orderCount >= 2 && !searchParams.get('sort')) setSort('for-you');
        }
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fitSizeTag = useMemo(() => {
    if (!memberCtx?.fit?.frameWidthMm || fitFilterDismissed) return null;
    const fw = memberCtx.fit.frameWidthMm;
    if (fw < 130) return 'small';
    if (fw > 140) return 'large';
    return 'medium';
  }, [memberCtx, fitFilterDismissed]);

  const displayProducts = useMemo(() => {
    let list = [...initialProducts];

    // Metafield-based filtering
    if (filterData?.products) {
      const fd = filterData.products;
      const getFilterData = (p: Product) => {
        const numId = p.id.replace(/^gid:\/\/shopify\/Product\//, '');
        return fd[numId] ?? fd[p.handle] ?? null;
      };
      if (filters.colour.length > 0) {
        list = list.filter(p => { const pf = getFilterData(p); return pf && filters.colour.some(c => pf.colours.includes(c)); });
      }
      if (filters.shape.length > 0) {
        list = list.filter(p => { const pf = getFilterData(p); return pf && filters.shape.some(s => pf.shapes.includes(s)); });
      }
      if (filters.material.length > 0) {
        list = list.filter(p => { const pf = getFilterData(p); return pf && pf.material && filters.material.includes(pf.material); });
      }
      if (filters.size.length > 0) {
        list = list.filter(p => { const pf = getFilterData(p); return pf && pf.size && filters.size.includes(pf.size); });
      }
    }

    if (sort === 'for-you' && memberCtx) {
      const scored = list.map(p => ({ p, score: scoreForYou(p, memberCtx) }));
      scored.sort((a, b) => b.score - a.score);
      list = scored.map(s => s.p);
    } else if (memberCtx?.stated.avoid?.length) {
      const avoidSet = new Set((memberCtx.stated.avoid ?? []).map(a => a.toLowerCase()));
      const normal: Product[] = [];
      const demoted: Product[] = [];
      for (const p of list) {
        const tags = getProductTags(p).map(t => t.toLowerCase());
        if (tags.some(t => Array.from(avoidSet).some(a => t.includes(a)))) demoted.push(p);
        else normal.push(p);
      }
      list = [...normal, ...demoted];
    }

    return list;
  }, [initialProducts, sort, memberCtx, fitSizeTag, filters, filterData]);

  const buildSearchParams = useCallback(
    (newFilters: ActiveFilters, newSort: SortOption) => {
      const params = new URLSearchParams();
      if (newSort !== 'relevance' && newSort !== 'for-you') params.set('sort', newSort);
      if (newFilters.shape.length > 0) params.set('shape', newFilters.shape.join(','));
      if (newFilters.colour.length > 0) params.set('colour', newFilters.colour.join(','));
      if (newFilters.material.length > 0) params.set('material', newFilters.material.join(','));
      if (newFilters.size.length > 0) params.set('size', newFilters.size.join(','));
      return params.toString();
    },
    []
  );

  const updateUrl = useCallback(
    (newFilters: ActiveFilters, newSort: SortOption) => {
      const qs = buildSearchParams(newFilters, newSort);
      router.push(`/collections/${collectionHandle}${qs ? `?${qs}` : ''}`, { scroll: false });
    },
    [collectionHandle, router, buildSearchParams]
  );

  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      setSort(newSort);
      if (newSort !== 'for-you') updateUrl(filters, newSort);
    },
    [filters, updateUrl]
  );

  const handleFilterChange = useCallback(
    (newFilters: ActiveFilters) => {
      setFilters(newFilters);
      updateUrl(newFilters, sort === 'for-you' ? 'relevance' : sort);
    },
    [sort, updateUrl]
  );

  const handleClearFilters = useCallback(() => {
    const cleared: ActiveFilters = { shape: [], colour: [], material: [], size: [] };
    setFilters(cleared);
    setFitFilterDismissed(false);
    updateUrl(cleared, sort === 'for-you' ? 'relevance' : sort);
  }, [sort, updateUrl]);

  return (
    <div className="site-container py-8">
      <h1 className="text-2xl md:text-3xl font-light tracking-wide mb-6">
        {collection.title}
      </h1>

      <FilterBar
        itemCount={displayProducts.length}
        sort={sort}
        filters={filters}
        onSortChange={handleSortChange}
        onFilterChange={handleFilterChange}
        onClearFilters={handleClearFilters}
        filterOptions={filterData?.options as any}
        colourLabels={filterData?.colourLabels}
      />

      <div className="h-8 mb-4 flex items-center">
        {fitSizeTag && !filters.size.length && !fitFilterDismissed && (
          <span className="inline-flex items-center gap-1 px-3 py-1 text-xs bg-gray-100 rounded-full">
            Showing {fitSizeTag} frames based on your fit profile
            <button
              onClick={() => setFitFilterDismissed(true)}
              className="ml-1 text-gray-400 hover:text-black"
              aria-label="Show all sizes"
            >
              · Show all
            </button>
          </span>
        )}
      </div>

      <ProductGrid
        products={displayProducts}
        editorialPanels={editorialPanels}
        editorialInterval={9}
      />
    </div>
  );
}
