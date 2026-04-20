import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import LensConfigurator from './LensConfigurator';
import { mockLensOptions } from '@/components/__mocks__/storyData';

const meta: Meta<typeof LensConfigurator> = { component: LensConfigurator };
export default meta;
type Story = StoryObj<typeof meta>;

export const Optical: Story = {
  args: { lensOptions: mockLensOptions, isSunglasses: false, frameBasePrice: 295, frameName: 'Plateau Round', frameColour: 'Noir' },
};

export const Sunglasses: Story = {
  args: { ...Optical.args, isSunglasses: true, frameName: 'Dix30 Aviator' },
};
