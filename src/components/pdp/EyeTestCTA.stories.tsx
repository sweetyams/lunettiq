import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import EyeTestCTABlock from './EyeTestCTA';
import { mockEyeTestCTA } from '@/components/__mocks__/storyData';

const meta: Meta<typeof EyeTestCTABlock> = { component: EyeTestCTABlock };
export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = { args: { cta: mockEyeTestCTA } };
export const NoImage: Story = { args: { cta: { ...mockEyeTestCTA, image: undefined } } };
