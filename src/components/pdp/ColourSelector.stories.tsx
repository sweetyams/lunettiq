import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ColourSelector from './ColourSelector';
import { mockProduct, noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ColourSelector> = { component: ColourSelector };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    colours: ['Noir', 'Tortoise'],
    variants: mockProduct.variants,
    selectedColour: 'Noir',
    onColourChange: noop,
  },
};
