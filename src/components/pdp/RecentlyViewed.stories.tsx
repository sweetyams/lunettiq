import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import RecentlyViewed from './RecentlyViewed';
import { WishlistProvider } from '@/context/WishlistContext';

const meta: Meta<typeof RecentlyViewed> = {
  component: RecentlyViewed,
  decorators: [(Story) => <WishlistProvider><Story /></WishlistProvider>],
  beforeEach: () => {
    localStorage.setItem('lunettiq_recently_viewed', JSON.stringify([
      { id: 'p1', slug: 'plateau-round', title: 'Plateau Round', imageUrl: null, price: '295.00' },
      { id: 'p2', slug: 'dix30-aviator', title: 'Dix30 Aviator', imageUrl: null, price: '325.00' },
    ]));
    return () => { localStorage.removeItem('lunettiq_recently_viewed'); };
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { currentProductId: 'p1' } };
