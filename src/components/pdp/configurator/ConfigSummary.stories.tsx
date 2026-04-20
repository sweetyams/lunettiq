import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ConfigSummary from './ConfigSummary';
import { mockLensOptions, noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof ConfigSummary> = { component: ConfigSummary };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    config: {
      lensType: 'singleVision', lensIndex: '1.61', coatings: ['antiReflective', 'blueLight'],
      sunOptions: null, prescription: null, prescriptionMethod: 'manual',
    },
    lensOptions: mockLensOptions,
    frameBasePrice: 295,
    frameName: 'Plateau Round',
    frameColour: 'Noir',
    readersMagnification: null,
    onEdit: noop,
    onBack: noop,
  },
};
