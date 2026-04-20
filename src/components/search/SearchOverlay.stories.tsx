import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import SearchOverlay from './SearchOverlay';
import { WishlistProvider } from '@/context/WishlistContext';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof SearchOverlay> = {
  component: SearchOverlay,
  decorators: [(Story) => <WishlistProvider><Story /></WishlistProvider>],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = { args: { open: true, onClose: noop } };
export const Closed: Story = { args: { open: false, onClose: noop } };
