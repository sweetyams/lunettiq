import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { getHomepageHeroes, getCategoryPanels, getEditorialPanels } from '@/lib/shopify/queries/metaobjects';
import { getCollectionProducts } from '@/lib/shopify/queries/collection';
import HeroSection from '@/components/home/HeroSection';
import CategoryPanels from '@/components/home/CategoryPanels';
import ProductRow from '@/components/home/ProductRow';
import LazyLoad from '@/components/shared/LazyLoad';
import type { HomepageHero, CategoryPanel as CategoryPanelType, EditorialPanel as EditorialPanelType } from '@/types/metaobjects';
import type { Product } from '@/types/shopify';

const EditorialPanel = dynamic(() => import('@/components/home/EditorialPanel'), { ssr: false });
const EditorialTwoUp = dynamic(() => import('@/components/home/EditorialTwoUp'), { ssr: false });
const StoreTeaser = dynamic(() => import('@/components/home/StoreTeaser'), { ssr: false });

export const revalidate = 60;

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

  let featuredProducts = featuredResult.products;
  if (featuredProducts.length === 0) {
    const fallback = await safeFetch(
      () => getCollectionProducts({ handle: 'optics', first: 8 }),
      { collection: null, products: [] as Product[], pageInfo: { hasNextPage: false, endCursor: null } }
    );
    featuredProducts = fallback.products;
  }

  const homepagePanels = editorialPanels.filter(
    (p) => p.placement === 'homepage' || p.placement === 'both'
  );

  const firstRowProducts = featuredProducts.slice(0, 4);
  const secondRowProducts = featuredProducts.slice(4, 8);
  const primaryCategories = categoryPanels.slice(0, 2);
  const secondaryCategories = categoryPanels.slice(2, 5);
  const fullBleedPanel = homepagePanels[0];
  const twoUpPanels = homepagePanels.slice(1, 3);
  const storeTeaserPanel = homepagePanels[3];

  return (
    <>
      <HeroSection heroes={heroes} />

      {primaryCategories.length > 0 && <CategoryPanels panels={primaryCategories} />}

      <ProductRow products={firstRowProducts} />

      {secondaryCategories.length > 0 && <CategoryPanels panels={secondaryCategories} />}

      <ProductRow products={secondRowProducts} />

      <LazyLoad>
        {fullBleedPanel && <EditorialPanel panel={fullBleedPanel} />}
      </LazyLoad>

      <LazyLoad>
        {twoUpPanels.length >= 2 && <EditorialTwoUp panels={twoUpPanels} />}
      </LazyLoad>

      <LazyLoad>
        <StoreTeaser
          image={storeTeaserPanel?.image}
          title={storeTeaserPanel?.title || 'Visit Our Stores'}
        />
      </LazyLoad>
    </>
  );
}
