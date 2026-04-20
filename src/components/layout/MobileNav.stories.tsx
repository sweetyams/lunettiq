import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import MobileNav from './MobileNav';

const meta: Meta<typeof MobileNav> = {
  component: MobileNav,
  parameters: { viewport: { defaultViewport: 'mobile1' } },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
