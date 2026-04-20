import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import OpticianShelf from './OpticianShelf';

const meta: Meta<typeof OpticianShelf> = { component: OpticianShelf };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    recommendations: [
      { productId: 'gid://shopify/Product/1', reason: 'Matches your face shape', staffName: 'Marie', date: '2026-03-15' },
      { productId: 'gid://shopify/Product/2', reason: 'Popular in your size', staffName: 'Marie', date: '2026-03-15' },
    ],
    opticianName: 'Marie',
  },
};
