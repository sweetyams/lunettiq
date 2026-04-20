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

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <CartDrawerProvider>
        <WishlistProvider>
          <SearchProvider>
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
