import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import LazyLoad from './LazyLoad';

const meta: Meta<typeof LazyLoad> = { component: LazyLoad };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: <div className="p-8 bg-gray-100 rounded">Lazy-loaded content</div>,
    fallback: <div className="p-8 bg-gray-200 rounded animate-pulse">Loading…</div>,
  },
};
