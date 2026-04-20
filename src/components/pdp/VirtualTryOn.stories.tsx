import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import VirtualTryOn from './VirtualTryOn';

const meta: Meta<typeof VirtualTryOn> = { component: VirtualTryOn };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { frameImageUrl: 'https://placehold.co/400x200/F5F5F9/333?text=Frame+PNG', frameName: 'Plateau Round' },
};
