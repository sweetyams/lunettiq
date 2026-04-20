import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ProductCard from './ProductCard';
import { WishlistProvider } from '@/context/WishlistContext';
import { mockProduct } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ProductCard> = {
  component: ProductCard,
  decorators: [(Story) => <WishlistProvider><Story /></WishlistProvider>],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const WithProduct: Story = { args: { product: mockProduct } };

export const Light: Story = {
  args: {
    light: { id: 'gid://shopify/Product/1', handle: 'plateau-round', title: 'Plateau Round', imageUrl: 'https://placehold.co/800x1000/F5F5F9/333?text=Lunettiq', price: '295.00' },
  },
};
