import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import SizeGuide from './SizeGuide';

const meta: Meta<typeof SizeGuide> = { component: SizeGuide };
export default meta;
type Story = StoryObj<typeof meta>;

export const AllDimensions: Story = {
  args: { frameWidth: 138, lensWidth: 48, lensHeight: 42, bridgeWidth: 20, templeLength: 145 },
};

export const NoDimensions: Story = {
  args: { frameWidth: null, lensWidth: null, lensHeight: null, bridgeWidth: null, templeLength: null },
};
