import { storefrontFetch } from '../storefront';
import type { Collection, Product } from '@/types/shopify';

const COLLECTION_PRODUCTS_QUERY = `
  query CollectionProducts(
    $handle: String!
    $first: Int!
    $after: String
    $sortKey: ProductCollectionSortKeys
    $reverse: Boolean
    $filters: [ProductFilter!]
  ) {
    collection(handle: $handle) {
      id
      title
      handle
      description
      image {
        url
        altText
        width
        height
      }
      products(
        first: $first
        after: $after
        sortKey: $sortKey
        reverse: $reverse
        filters: $filters
      ) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          handle
          title
          priceRange {
            minVariantPrice {
              amount
              currencyCode
            }
            maxVariantPrice {
              amount
              currencyCode
            }
          }
          images(first: 2) {
            nodes {
              url
              altText
              width
              height
            }
          }
          options {
            name
            values
          }
          tags
        }
      }
    }
  }
`;

export type CollectionSortKey =
  | 'COLLECTION_DEFAULT'
  | 'PRICE'
  | 'TITLE'
  | 'CREATED'
  | 'BEST_SELLING';

export interface ProductFilter {
  productType?: string;
  tag?: string;
  variantOption?: { name: string; value: string };
  price?: { min?: number; max?: number };
  available?: boolean;
}

export interface CollectionProductsOptions {
  handle: string;
  first?: number;
  after?: string;
  sortKey?: CollectionSortKey;
  reverse?: boolean;
  filters?: ProductFilter[];
}

export interface CollectionProductsResult {
  collection: Collection | null;
  products: Product[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor: string | null;
  };
}

interface RawCollectionResponse {
  collection: {
    id: string;
    title: string;
    handle: string;
    description: string;
    image: Collection['image'];
    products: {
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
      nodes: Array<{
        id: string;
        handle: string;
        title: string;
        priceRange: Product['priceRange'];
        images: { nodes: Product['images'] };
        options: Product['options'];
        tags: string[];
      }>;
    };
  } | null;
}

export async function getCollectionProducts(
  options: CollectionProductsOptions
): Promise<CollectionProductsResult> {
  const { handle, first = 24, after, sortKey, reverse, filters } = options;

  const data = await storefrontFetch<RawCollectionResponse>(COLLECTION_PRODUCTS_QUERY, {
    handle,
    first,
    after: after ?? null,
    sortKey: sortKey ?? null,
    reverse: reverse ?? false,
    filters: filters ?? null,
  });

  if (!data.collection) {
    return { collection: null, products: [], pageInfo: { hasNextPage: false, endCursor: null } };
  }

  const raw = data.collection;

  const collection: Collection = {
    id: raw.id,
    title: raw.title,
    handle: raw.handle,
    description: raw.description,
    image: raw.image ?? undefined,
  };

  const products: Product[] = raw.products.nodes.map((node) => ({
    id: node.id,
    title: node.title,
    handle: node.handle,
    description: '',
    descriptionHtml: '',
    priceRange: node.priceRange,
    options: node.options,
    variants: [],
    images: node.images.nodes,
    metafields: {},
  }));

  return {
    collection,
    products,
    pageInfo: raw.products.pageInfo,
  };
}

export { COLLECTION_PRODUCTS_QUERY };
