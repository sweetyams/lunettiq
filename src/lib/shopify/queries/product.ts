import { storefrontFetch } from '../storefront';
import type { Product } from '@/types/shopify';

const PRODUCT_BY_HANDLE_QUERY = `
  query ProductByHandle($handle: String!) {
    product(handle: $handle) {
      id
      title
      handle
      description
      descriptionHtml
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
      options {
        name
        values
      }
      variants(first: 50) {
        nodes {
          id
          title
          price {
            amount
            currencyCode
          }
          availableForSale
          selectedOptions {
            name
            value
          }
          image {
            url
            altText
            width
            height
          }
        }
      }
      images(first: 10) {
        nodes {
          url
          altText
          width
          height
        }
      }
      onFaceImages: metafield(namespace: "custom", key: "on_face_images") {
        value
      }
      faceNotes: metafield(namespace: "custom", key: "face_notes") {
        value
      }
      material: metafield(namespace: "custom", key: "material") {
        value
      }
      origin: metafield(namespace: "custom", key: "origin") {
        value
      }
      rxCompatible: metafield(namespace: "custom", key: "rx_compatible") {
        value
      }
      bridgeWidth: metafield(namespace: "custom", key: "bridge_width") {
        value
      }
      lensWidth: metafield(namespace: "custom", key: "lens_width") {
        value
      }
      templeLength: metafield(namespace: "custom", key: "temple_length") {
        value
      }
      frameWidth: metafield(namespace: "custom", key: "frame_width") {
        value
      }
      lensHeight: metafield(namespace: "custom", key: "lens_height") {
        value
      }
      acetateSource: metafield(namespace: "custom", key: "acetate_source") {
        value
      }
      hingeType: metafield(namespace: "custom", key: "hinge_type") {
        value
      }
      lensCoating: metafield(namespace: "custom", key: "lens_coating") {
        value
      }
      uvProtection: metafield(namespace: "custom", key: "uv_protection") {
        value
      }
      includedAccessories: metafield(namespace: "custom", key: "included_accessories") {
        value
      }
      warranty: metafield(namespace: "custom", key: "warranty") {
        value
      }
      tryOnImage: metafield(namespace: "custom", key: "tryon_image") {
        value
        reference {
          ... on MediaImage {
            image {
              url
            }
          }
        }
      }
      collections(first: 10) {
        nodes {
          id
          title
          handle
          description
        }
      }
    }
  }
`;

const PRODUCT_RECOMMENDATIONS_QUERY = `
  query ProductRecommendations($productId: ID!) {
    productRecommendations(productId: $productId) {
      id
      title
      handle
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
      images(first: 1) {
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
    }
  }
`;

interface RawProductResponse {
  product: {
    id: string;
    title: string;
    handle: string;
    description: string;
    descriptionHtml: string;
    priceRange: Product['priceRange'];
    options: Product['options'];
    variants: { nodes: Product['variants'] };
    images: { nodes: Product['images'] };
    onFaceImages: { value: string } | null;
    faceNotes: { value: string } | null;
    material: { value: string } | null;
    origin: { value: string } | null;
    rxCompatible: { value: string } | null;
    bridgeWidth: { value: string } | null;
    lensWidth: { value: string } | null;
    templeLength: { value: string } | null;
    frameWidth: { value: string } | null;
    lensHeight: { value: string } | null;
    acetateSource: { value: string } | null;
    hingeType: { value: string } | null;
    lensCoating: { value: string } | null;
    uvProtection: { value: string } | null;
    includedAccessories: { value: string } | null;
    warranty: { value: string } | null;
    tryOnImage: { value: string; reference?: { image?: { url: string } } } | null;
    collections: { nodes: Product['collections'] };
  } | null;
}

interface RawRecommendationsResponse {
  productRecommendations: Array<{
    id: string;
    title: string;
    handle: string;
    priceRange: Product['priceRange'];
    images: { nodes: Product['images'] };
    options: Product['options'];
  }>;
}

function parseMetafields(raw: RawProductResponse['product']): Product['metafields'] {
  if (!raw) return {};
  return {
    onFaceImages: raw.onFaceImages ? JSON.parse(raw.onFaceImages.value) : undefined,
    faceNotes: raw.faceNotes?.value ?? undefined,
    material: raw.material?.value ?? undefined,
    origin: raw.origin?.value ?? undefined,
    rxCompatible: raw.rxCompatible ? raw.rxCompatible.value === 'true' : undefined,
    bridgeWidth: raw.bridgeWidth ? Number(raw.bridgeWidth.value) : undefined,
    lensWidth: raw.lensWidth ? Number(raw.lensWidth.value) : undefined,
    templeLength: raw.templeLength ? Number(raw.templeLength.value) : undefined,
    frameWidth: raw.frameWidth ? Number(raw.frameWidth.value) : undefined,
    lensHeight: raw.lensHeight ? Number(raw.lensHeight.value) : undefined,
    acetateSource: raw.acetateSource?.value ?? undefined,
    hingeType: raw.hingeType?.value ?? undefined,
    lensCoating: raw.lensCoating?.value ?? undefined,
    uvProtection: raw.uvProtection?.value ?? undefined,
    includedAccessories: raw.includedAccessories?.value ?? undefined,
    warranty: raw.warranty?.value ?? undefined,
    tryOnImage: raw.tryOnImage?.reference?.image?.url ?? raw.tryOnImage?.value ?? undefined,
  };
}

export async function getProductByHandle(handle: string): Promise<Product | null> {
  const data = await storefrontFetch<RawProductResponse>(PRODUCT_BY_HANDLE_QUERY, { handle });

  if (!data.product) return null;

  const raw = data.product;
  return {
    id: raw.id,
    title: raw.title,
    handle: raw.handle,
    description: raw.description,
    descriptionHtml: raw.descriptionHtml,
    priceRange: raw.priceRange,
    options: raw.options,
    variants: raw.variants.nodes,
    images: raw.images.nodes,
    metafields: parseMetafields(raw),
    collections: raw.collections?.nodes,
  };
}

export async function getProductRecommendations(productId: string): Promise<Product[]> {
  const data = await storefrontFetch<RawRecommendationsResponse>(
    PRODUCT_RECOMMENDATIONS_QUERY,
    { productId }
  );

  return (data.productRecommendations ?? []).map((rec) => ({
    id: rec.id,
    title: rec.title,
    handle: rec.handle,
    description: '',
    descriptionHtml: '',
    priceRange: rec.priceRange,
    options: rec.options,
    variants: [],
    images: rec.images.nodes,
    metafields: {},
  }));
}

export { PRODUCT_BY_HANDLE_QUERY, PRODUCT_RECOMMENDATIONS_QUERY };
