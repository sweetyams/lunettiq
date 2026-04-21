import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import Footer from '@/components/layout/Footer';
import { CartProvider } from '@/context/CartContext';
import { CartDrawerProvider } from '@/context/CartDrawerContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { SearchProvider } from '@/context/SearchContext';
import CartDrawer from '@/components/cart/CartDrawer';
import TrackingPixels from '@/components/tracking/TrackingPixels';
import ConsentBanner from '@/components/tracking/ConsentBanner';
import PageViewTracker from '@/components/tracking/PageViewTracker';
import { getSettings } from '@/lib/crm/store-settings';

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const design = await getSettings('skeleton_color', 'skeleton_shimmer_from', 'skeleton_shimmer_to', 'product_card_bg');

  return (
    <CartProvider>
      <CartDrawerProvider>
        <WishlistProvider>
          <SearchProvider>
            <style>{`:root {
              --skeleton-bg: ${design.skeleton_color || '#F5F5F9'};
              --skeleton-from: ${design.skeleton_shimmer_from || '#f0f0f0'};
              --skeleton-to: ${design.skeleton_shimmer_to || '#e0e0e0'};
              --product-card-bg: ${design.product_card_bg || '#F5F5F9'};
            }`}</style>
            <AnnouncementBar />
            <Header />
            <MobileNav />
            <main className="min-h-screen">{children}</main>
            <Footer />
            <CartDrawer />
            <TrackingPixels />
            <PageViewTracker />
            <ConsentBanner />
          </SearchProvider>
        </WishlistProvider>
      </CartDrawerProvider>
    </CartProvider>
  );
}
