import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Recommendations from './Recommendations';
import { WishlistProvider } from '@/context/WishlistContext';
import { mockProducts } from '@/components/__mocks__/storyData';

const meta: Meta<typeof Recommendations> = {
  component: Recommendations,
  decorators: [(Story) => <WishlistProvider><Story /></WishlistProvider>],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { products: mockProducts } };
export const Empty: Story = { args: { products: [] } };
