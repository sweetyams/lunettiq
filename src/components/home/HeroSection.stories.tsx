import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import HeroSection from './HeroSection';
import { mockHero } from '@/components/__mocks__/storyData';

const meta: Meta<typeof HeroSection> = { component: HeroSection };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { heroes: [mockHero] } };
export const NoActive: Story = { args: { heroes: [{ ...mockHero, active: false }] } };
