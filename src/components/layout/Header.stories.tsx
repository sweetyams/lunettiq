import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Header from './Header';
import { CartProvider } from '@/context/CartContext';
import { CartDrawerProvider } from '@/context/CartDrawerContext';
import { WishlistProvider } from '@/context/WishlistContext';
import { SearchProvider } from '@/context/SearchContext';

const meta: Meta<typeof Header> = {
  component: Header,
  decorators: [(Story) => (
    <CartProvider><CartDrawerProvider><WishlistProvider><SearchProvider><Story /></SearchProvider></WishlistProvider></CartDrawerProvider></CartProvider>
  )],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
