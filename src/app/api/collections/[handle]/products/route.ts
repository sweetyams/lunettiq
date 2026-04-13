import { NextRequest, NextResponse } from 'next/server';
import { getCollectionProducts } from '@/lib/shopify/queries/collection';

export async function GET(
  request: NextRequest,
  { params }: { params: { handle: string } }
) {
  const { searchParams } = request.nextUrl;
  const cursor = searchParams.get('cursor') ?? undefined;
  const sort = searchParams.get('sort') ?? 'relevance';

  const sortKeyMap: Record<string, { sortKey: string; reverse: boolean }> = {
    relevance: { sortKey: 'COLLECTION_DEFAULT', reverse: false },
    'price-asc': { sortKey: 'PRICE', reverse: false },
    'price-desc': { sortKey: 'PRICE', reverse: true },
    newest: { sortKey: 'CREATED', reverse: true },
  };
  const sortConfig = sortKeyMap[sort] ?? sortKeyMap.relevance;

  const tagFilters: Array<{ tag: string }> = [];
  for (const key of ['shape', 'colour', 'material', 'size']) {
    const val = searchParams.get(key);
    if (val) val.split(',').forEach((v) => tagFilters.push({ tag: `${key}:${v}` }));
  }

  try {
    const result = await getCollectionProducts({
      handle: params.handle,
      first: 24,
      after: cursor,
      sortKey: sortConfig.sortKey as 'COLLECTION_DEFAULT' | 'PRICE' | 'TITLE' | 'CREATED' | 'BEST_SELLING',
      reverse: sortConfig.reverse,
      filters: tagFilters.length > 0 ? tagFilters : undefined,
    });

    return NextResponse.json(
      { products: result.products, pageInfo: result.pageInfo },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to load products' }, { status: 500 });
  }
}
