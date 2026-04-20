import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import EditorialTwoUp from './EditorialTwoUp';
import { mockEditorialPanel } from '@/components/__mocks__/storyData';

const meta: Meta<typeof EditorialTwoUp> = { component: EditorialTwoUp };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { panels: [mockEditorialPanel, { ...mockEditorialPanel, title: 'Crafted in Japan' }] },
};
