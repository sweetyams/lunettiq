import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CategoryPanels from './CategoryPanels';
import { mockCategoryPanel } from '@/components/__mocks__/storyData';

const meta: Meta<typeof CategoryPanels> = { component: CategoryPanels };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    panels: [
      mockCategoryPanel,
      { ...mockCategoryPanel, title: 'Sun', collectionHandle: 'sunglasses', sortOrder: 1 },
      { ...mockCategoryPanel, title: 'Signature', collectionHandle: 'signature', sortOrder: 2 },
      { ...mockCategoryPanel, title: 'Permanent', collectionHandle: 'permanent', sortOrder: 3 },
      { ...mockCategoryPanel, title: 'Archives', collectionHandle: 'archives', sortOrder: 4 },
    ],
  },
};
