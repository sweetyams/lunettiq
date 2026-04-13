// Shopify Storefront API types

export interface Money {
  amount: string;
  currencyCode: string;
}

export interface Image {
  url: string;
  altText: string | null;
  width?: number;
  height?: number;
}

export interface SelectedOption {
  name: string;
  value: string;
}

export interface ProductVariant {
  id: string;
  title: string;
  price: Money;
  availableForSale: boolean;
  selectedOptions: SelectedOption[];
  image?: Image;
}

export interface ProductMetafields {
  onFaceImages?: string[];   // JSON array of image URLs
  faceNotes?: string;
  material?: string;
  origin?: string;
  rxCompatible?: boolean;
  bridgeWidth?: number;      // mm
  lensWidth?: number;        // mm
  templeLength?: number;     // mm
  tryOnImage?: string;       // Front-facing transparent PNG for virtual try-on
}

export interface Product {
  id: string;
  title: string;
  handle: string;
  description: string;       // HTML
  descriptionHtml: string;
  priceRange: {
    minVariantPrice: Money;
    maxVariantPrice: Money;
  };
  options: {
    name: string;
    values: string[];
  }[];
  variants: ProductVariant[];
  images: Image[];
  metafields: ProductMetafields;
  collections?: Collection[];
}

export interface Collection {
  id: string;
  title: string;
  handle: string;
  description: string;
  image?: Image;
}

export interface CartLineAttribute {
  key: string;   // e.g. "_lensType", "_lensIndex", "_coatings", "_rxStatus"
  value: string;
}

export interface CartLineItem {
  id: string;
  quantity: number;
  merchandise: ProductVariant;
  attributes: CartLineAttribute[];
  cost: {
    totalAmount: Money;
  };
}

export interface CartCost {
  subtotalAmount: Money;
  totalAmount: Money;
}

export interface ShopifyCart {
  id: string;
  checkoutUrl: string;
  lines: CartLineItem[];
  cost: CartCost;
}
