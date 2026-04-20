import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ProductRow from './ProductRow';
import { WishlistProvider } from '@/context/WishlistContext';
import { mockProducts } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ProductRow> = {
  component: ProductRow,
  decorators: [(Story) => <WishlistProvider><Story /></WishlistProvider>],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { products: mockProducts, title: 'New Arrivals' } };
