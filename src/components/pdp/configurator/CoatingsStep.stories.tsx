import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CoatingsStep from './CoatingsStep';
import { mockLensOptions, noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof CoatingsStep> = { component: CoatingsStep };
export default meta;
type Story = StoryObj<typeof meta>;

export const Optical: Story = {
  args: {
    selectedCoatings: [], sunOptions: null, isSunglasses: false, lensType: 'singleVision',
    lensOptions: mockLensOptions, onCoatingsChange: noop, onSunOptionsChange: noop, onNext: noop, onBack: noop,
  },
};

export const SunWithOptions: Story = {
  args: {
    ...Optical.args, isSunglasses: true, lensType: 'nonPrescriptionSun',
    sunOptions: { tintColour: 'gray', polarized: false, mirrorCoating: null },
  },
};
