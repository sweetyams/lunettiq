import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import LensTypeStep from './LensTypeStep';
import { mockLensOptions, noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof LensTypeStep> = { component: LensTypeStep };
export default meta;
type Story = StoryObj<typeof meta>;

export const Optical: Story = {
  args: { lensOptions: mockLensOptions, isSunglasses: false, selected: null, onSelect: noop },
};

export const Sunglasses: Story = {
  args: { ...Optical.args, isSunglasses: true },
};

export const WithSelection: Story = {
  args: { ...Optical.args, selected: 'singleVision' },
};
