import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import AnnouncementBarClient from './AnnouncementBarClient';

const meta: Meta<typeof AnnouncementBarClient> = { component: AnnouncementBarClient };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { message: 'Free shipping on orders over $150' },
};

export const WithLink: Story = {
  args: { message: 'New Signature collection is here.', linkText: 'Shop now', linkUrl: '/collections/signature' },
};
