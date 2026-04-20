import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import LensIndexStep from './LensIndexStep';
import { mockLensOptions, noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof LensIndexStep> = { component: LensIndexStep };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { lensOptions: mockLensOptions, lensType: 'singleVision', selected: null, onSelect: noop, onBack: noop },
};

export const Selected: Story = {
  args: { ...Default.args, selected: '1.61' },
};
