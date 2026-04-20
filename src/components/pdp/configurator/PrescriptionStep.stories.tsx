import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PrescriptionStep from './PrescriptionStep';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof PrescriptionStep> = { component: PrescriptionStep };
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleVision: Story = {
  args: { lensType: 'singleVision', prescription: null, prescriptionMethod: null, readersMagnification: null, onSubmit: noop, onMagnificationChange: noop, onBack: noop },
};

export const Progressive: Story = {
  args: { ...SingleVision.args, lensType: 'progressive' },
};

export const Readers: Story = {
  args: { ...SingleVision.args, lensType: 'readers', readersMagnification: 1.5 },
};
