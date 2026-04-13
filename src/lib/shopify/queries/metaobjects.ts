import { storefrontFetch } from '../storefront';
import type {
  AnnouncementBar,
  HomepageHero,
  EditorialPanel,
  CategoryPanel,
  StoreLocation,
  EyeTestCTA,
  LensOption,
} from '@/types/metaobjects';

// --- Shared helpers ---

function fieldValue(
  fields: Array<{ key: string; value: string | null }>,
  key: string
): string {
  return fields.find((f) => f.key === key)?.value ?? '';
}

function fieldRef(
  fields: Array<{ key: string; value: string | null; reference?: { image?: { url: string } } }>,
  key: string
): string {
  const field = fields.find((f) => f.key === key);
  return field?.reference?.image?.url ?? '';
}

// --- Announcement Bar ---

const ANNOUNCEMENT_BAR_QUERY = `
  query AnnouncementBars {
    metaobjects(type: "announcement_bar", first: 5) {
      nodes {
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url }
            }
          }
        }
      }
    }
  }
`;

interface MetaobjectNode {
  fields: Array<{ key: string; value: string | null; reference?: { image?: { url: string } } }>;
}

interface MetaobjectsResponse {
  metaobjects: { nodes: MetaobjectNode[] };
}

export async function getAnnouncementBars(): Promise<AnnouncementBar[]> {
  const data = await storefrontFetch<MetaobjectsResponse>(ANNOUNCEMENT_BAR_QUERY);
  return data.metaobjects.nodes.map((node) => ({
    message: fieldValue(node.fields, 'message'),
    linkText: fieldValue(node.fields, 'link_text') || undefined,
    linkUrl: fieldValue(node.fields, 'link_url') || undefined,
    active: fieldValue(node.fields, 'active') === 'true',
  }));
}

// --- Homepage Hero ---

const HOMEPAGE_HERO_QUERY = `
  query HomepageHeroes {
    metaobjects(type: "homepage_hero", first: 5) {
      nodes {
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url }
            }
          }
        }
      }
    }
  }
`;

export async function getHomepageHeroes(): Promise<HomepageHero[]> {
  const data = await storefrontFetch<MetaobjectsResponse>(HOMEPAGE_HERO_QUERY);
  return data.metaobjects.nodes.map((node) => ({
    headline: fieldValue(node.fields, 'headline'),
    imageLeft: fieldRef(node.fields, 'image_left'),
    imageRight: fieldRef(node.fields, 'image_right'),
    ctaText: fieldValue(node.fields, 'cta_text'),
    ctaLink: fieldValue(node.fields, 'cta_link'),
    active: fieldValue(node.fields, 'active') === 'true',
  }));
}

// --- Editorial Panels ---

const EDITORIAL_PANELS_QUERY = `
  query EditorialPanels {
    metaobjects(type: "editorial_panel", first: 20) {
      nodes {
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url }
            }
          }
        }
      }
    }
  }
`;

export async function getEditorialPanels(): Promise<EditorialPanel[]> {
  const data = await storefrontFetch<MetaobjectsResponse>(EDITORIAL_PANELS_QUERY);
  return data.metaobjects.nodes.map((node) => ({
    title: fieldValue(node.fields, 'title'),
    body: fieldValue(node.fields, 'body'),
    image: fieldRef(node.fields, 'image'),
    linkUrl: fieldValue(node.fields, 'link_url') || undefined,
    placement: fieldValue(node.fields, 'placement') as EditorialPanel['placement'],
  }));
}

// --- Category Panels ---

const CATEGORY_PANELS_QUERY = `
  query CategoryPanels {
    metaobjects(type: "category_panel", first: 10) {
      nodes {
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url }
            }
          }
        }
      }
    }
  }
`;

export async function getCategoryPanels(): Promise<CategoryPanel[]> {
  const data = await storefrontFetch<MetaobjectsResponse>(CATEGORY_PANELS_QUERY);
  return data.metaobjects.nodes
    .map((node) => ({
      title: fieldValue(node.fields, 'title'),
      image: fieldRef(node.fields, 'image'),
      collectionHandle: fieldValue(node.fields, 'collection_handle'),
      sortOrder: Number(fieldValue(node.fields, 'sort_order')) || 0,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

// --- Store Locations ---

const STORE_LOCATIONS_QUERY = `
  query StoreLocations {
    metaobjects(type: "store_location", first: 20) {
      nodes {
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url }
            }
          }
        }
      }
    }
  }
`;

export async function getStoreLocations(): Promise<StoreLocation[]> {
  const data = await storefrontFetch<MetaobjectsResponse>(STORE_LOCATIONS_QUERY);
  return data.metaobjects.nodes.map((node) => ({
    name: fieldValue(node.fields, 'name'),
    streetAddress: fieldValue(node.fields, 'street_address'),
    city: fieldValue(node.fields, 'city'),
    province: fieldValue(node.fields, 'province'),
    postalCode: fieldValue(node.fields, 'postal_code'),
    phone: fieldValue(node.fields, 'phone'),
    hours: JSON.parse(fieldValue(node.fields, 'hours') || '{}'),
    mapUrl: fieldValue(node.fields, 'map_url'),
    active: fieldValue(node.fields, 'active') === 'true',
  }));
}

// --- Eye Test CTA ---

const EYE_TEST_CTA_QUERY = `
  query EyeTestCTAs {
    metaobjects(type: "eye_test_cta", first: 5) {
      nodes {
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url }
            }
          }
        }
      }
    }
  }
`;

export async function getEyeTestCTAs(): Promise<EyeTestCTA[]> {
  const data = await storefrontFetch<MetaobjectsResponse>(EYE_TEST_CTA_QUERY);
  return data.metaobjects.nodes.map((node) => ({
    heading: fieldValue(node.fields, 'heading'),
    body: fieldValue(node.fields, 'body'),
    ctaText: fieldValue(node.fields, 'cta_text'),
    ctaLink: fieldValue(node.fields, 'cta_link'),
    image: fieldRef(node.fields, 'image') || undefined,
  }));
}

// --- Lens Options ---

const LENS_OPTIONS_QUERY = `
  query LensOptions {
    metaobjects(type: "lens_option", first: 50) {
      nodes {
        fields {
          key
          value
          reference {
            ... on MediaImage {
              image { url }
            }
          }
        }
      }
    }
  }
`;

export async function getLensOptions(): Promise<LensOption[]> {
  const data = await storefrontFetch<MetaobjectsResponse>(LENS_OPTIONS_QUERY);
  return data.metaobjects.nodes
    .map((node) => ({
      type: fieldValue(node.fields, 'type') as LensOption['type'],
      name: fieldValue(node.fields, 'name'),
      description: fieldValue(node.fields, 'description'),
      price: Number(fieldValue(node.fields, 'price')) || 0,
      sortOrder: Number(fieldValue(node.fields, 'sort_order')) || 0,
      compatibleLensTypes: JSON.parse(fieldValue(node.fields, 'compatible_lens_types') || '[]'),
      active: fieldValue(node.fields, 'active') === 'true',
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export {
  ANNOUNCEMENT_BAR_QUERY,
  HOMEPAGE_HERO_QUERY,
  EDITORIAL_PANELS_QUERY,
  CATEGORY_PANELS_QUERY,
  STORE_LOCATIONS_QUERY,
  EYE_TEST_CTA_QUERY,
  LENS_OPTIONS_QUERY,
};
