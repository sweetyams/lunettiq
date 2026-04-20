import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import FavouriteIcon from './FavouriteIcon';
import { WishlistProvider } from '@/context/WishlistContext';

const meta: Meta<typeof FavouriteIcon> = {
  component: FavouriteIcon,
  decorators: [(Story) => <WishlistProvider><Story /></WishlistProvider>],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { productId: 'gid://shopify/Product/1' } };
