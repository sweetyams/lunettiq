import { getHomepageHeroes, getCategoryPanels, getEditorialPanels } from '@/lib/shopify/queries/metaobjects';
import { getCollectionProducts } from '@/lib/shopify/queries/collection';
import HeroSection from '@/components/home/HeroSection';
import CategoryPanels from '@/components/home/CategoryPanels';
import ProductRow from '@/components/home/ProductRow';
import EditorialPanel from '@/components/home/EditorialPanel';
import EditorialTwoUp from '@/components/home/EditorialTwoUp';
import StoreTeaser from '@/components/home/StoreTeaser';
import type { HomepageHero, CategoryPanel as CategoryPanelType, EditorialPanel as EditorialPanelType } from '@/types/metaobjects';
import type { Product } from '@/types/shopify';

export const revalidate = 60;

/** Safe fetch wrapper — returns fallback on any error */
async function safeFetch<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    console.error('Homepage fetch error:', error);
    return fallback;
  }
}

export default async function HomePage() {
  const [heroes, categoryPanels, editorialPanels, featuredResult] = await Promise.all([
    safeFetch<HomepageHero[]>(() => getHomepageHeroes(), []),
    safeFetch<CategoryPanelType[]>(() => getCategoryPanels(), []),
    safeFetch<EditorialPanelType[]>(() => getEditorialPanels(), []),
    safeFetch(
      () => getCollectionProducts({ handle: 'homepage-featured', first: 8 }),
      { collection: null, products: [] as Product[], pageInfo: { hasNextPage: false, endCursor: null } }
    ),
  ]);

  // If no homepage-featured collection, try optics as fallback
  let featuredProducts = featuredResult.products;
  if (featuredProducts.length === 0) {
    const fallback = await safeFetch(
      () => getCollectionProducts({ handle: 'optics', first: 8 }),
      { collection: null, products: [] as Product[], pageInfo: { hasNextPage: false, endCursor: null } }
    );
    featuredProducts = fallback.products;
  }

  // Filter editorial panels for homepage placement
  const homepagePanels = editorialPanels.filter(
    (p) => p.placement === 'homepage' || p.placement === 'both'
  );

  // Split featured products into two rows of 4
  const firstRowProducts = featuredProducts.slice(0, 4);
  const secondRowProducts = featuredProducts.slice(4, 8);

  // Split category panels: first 2 for primary (Optical/Sun), rest for secondary
  const primaryCategories = categoryPanels.slice(0, 2);
  const secondaryCategories = categoryPanels.slice(2, 5);

  // Editorial panels
  const fullBleedPanel = homepagePanels[0];
  const twoUpPanels = homepagePanels.slice(1, 3);
  const storeTeaserPanel = homepagePanels[3];

  return (
    <>
      {/* a. Hero — dual full-bleed editorial images */}
      <HeroSection heroes={heroes} />

      {/* b. Category entry — Glasses / Sunglasses */}
      {primaryCategories.length > 0 && (
        <CategoryPanels panels={primaryCategories} />
      )}

      {/* c. Product row — 4 cards */}
      <ProductRow products={firstRowProducts} />

      {/* d. Category entry — Signature / Permanent / Archives */}
      {secondaryCategories.length > 0 && (
        <CategoryPanels panels={secondaryCategories} />
      )}

      {/* e. Second product row — 4 cards */}
      <ProductRow products={secondRowProducts} />

      {/* f. Full-bleed lifestyle image — Craftsmanship */}
      {fullBleedPanel && <EditorialPanel panel={fullBleedPanel} />}

      {/* g. Editorial 2-up panels */}
      {twoUpPanels.length >= 2 && <EditorialTwoUp panels={twoUpPanels} />}

      {/* h. Stores full-bleed image */}
      <StoreTeaser
        image={storeTeaserPanel?.image}
        title={storeTeaserPanel?.title || 'Visit Our Stores'}
      />
    </>
  );
}
