import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import RunningPriceTotal from './RunningPriceTotal';
import { mockLensOptions } from '@/components/__mocks__/storyData';

const meta: Meta<typeof RunningPriceTotal> = { component: RunningPriceTotal };
export default meta;
type Story = StoryObj<typeof meta>;

export const FrameOnly: Story = {
  args: {
    frameBasePrice: 295,
    lensOptions: mockLensOptions,
    config: { lensType: null, lensIndex: null, coatings: [], sunOptions: null, prescription: null, prescriptionMethod: null },
  },
};

export const WithUpgrades: Story = {
  args: {
    ...FrameOnly.args,
    config: { lensType: 'singleVision', lensIndex: '1.61', coatings: ['antiReflective'], sunOptions: null, prescription: null, prescriptionMethod: null },
  },
};
