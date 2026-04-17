import AnnouncementBar from '@/components/layout/AnnouncementBar';
import Header from '@/components/layout/Header';
import MobileNav from '@/components/layout/MobileNav';
import Footer from '@/components/layout/Footer';
import { CartProvider } from '@/context/CartContext';
import { CartDrawerProvider } from '@/context/CartDrawerContext';
import { WishlistProvider } from '@/context/WishlistContext';
import CartDrawer from '@/components/cart/CartDrawer';

export default function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      <CartDrawerProvider>
        <WishlistProvider>
          <AnnouncementBar />
          <Header />
          <MobileNav />
          <main className="min-h-screen">{children}</main>
          <Footer />
          <CartDrawer />
        </WishlistProvider>
      </CartDrawerProvider>
    </CartProvider>
  );
}
