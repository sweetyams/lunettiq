import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ProductInfoPanel from './ProductInfoPanel';
import { WishlistProvider } from '@/context/WishlistContext';
import { mockProduct, mockVariant } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ProductInfoPanel> = {
  component: ProductInfoPanel,
  decorators: [(Story) => <WishlistProvider><Story /></WishlistProvider>],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { product: mockProduct, selectedVariant: mockVariant } };
export const NoVariant: Story = { args: { product: mockProduct, selectedVariant: null } };
