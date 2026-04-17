// Shopify Admin API types for CRM write-through layer

export interface ShopifyAddress {
  id?: number;
  address1?: string;
  address2?: string;
  city?: string;
  province?: string;
  country?: string;
  zip?: string;
  phone?: string;
  default?: boolean;
}

export interface CustomerFields {
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  tags?: string;
  note?: string;
  accepts_marketing?: boolean;
  addresses?: ShopifyAddress[];
}

export interface ShopifyCustomer {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  tags: string;
  note: string | null;
  accepts_marketing: boolean;
  created_at: string;
  updated_at: string;
  addresses: ShopifyAddress[];
}

export interface ShopifyMetafield {
  id: number;
  namespace: string;
  key: string;
  value: string;
  type: string;
  owner_id: number;
  owner_resource: string;
  created_at: string;
  updated_at: string;
}

export interface ShopifyCustomerResponse {
  customer: ShopifyCustomer;
}

export interface ShopifyMetafieldResponse {
  metafield: ShopifyMetafield;
}

export interface ShopifyMetafieldsResponse {
  metafields: ShopifyMetafield[];
}

export interface StagedUploadTarget {
  url: string;
  resourceUrl: string;
  parameters: { name: string; value: string }[];
}

export interface ShopifyFileResponse {
  url: string;
}

export interface ShopifyAdminError {
  errors: Record<string, string[]> | string;
}

export type AdminResult<T> = { ok: true; data: T } | { ok: false; error: string };
