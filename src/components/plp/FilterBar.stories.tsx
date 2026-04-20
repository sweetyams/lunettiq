import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import FilterBar from './FilterBar';
import { mockProducts, noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof FilterBar> = { component: FilterBar };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    itemCount: 42,
    sort: 'relevance',
    filters: { shape: [], colour: [], material: [], size: [] },
    onSortChange: noop,
    onFilterChange: noop,
    onClearFilters: noop,
    products: mockProducts,
  },
};

export const WithActiveFilters: Story = {
  args: {
    ...Default.args,
    filters: { shape: ['round'], colour: ['black'], material: [], size: [] },
  },
};
