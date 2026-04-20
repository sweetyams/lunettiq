import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ProductGrid from './ProductGrid';
import { WishlistProvider } from '@/context/WishlistContext';
import { mockProducts, mockEditorialPanel } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ProductGrid> = {
  component: ProductGrid,
  decorators: [(Story) => <WishlistProvider><Story /></WishlistProvider>],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { products: mockProducts, editorialPanels: [mockEditorialPanel], editorialInterval: 6 },
};

export const SkipAnimation: Story = {
  args: { products: mockProducts, editorialPanels: [], editorialInterval: 6, skipAnimation: true },
};

export const Empty: Story = {
  args: { products: [], editorialPanels: [], editorialInterval: 6 },
};
