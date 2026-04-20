import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MembershipControls } from './MembershipControls';

const meta: Meta<typeof MembershipControls> = { component: MembershipControls };
export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = { args: { status: 'active', tier: 'cult' } };
export const Paused: Story = { args: { status: 'paused', tier: 'cult' } };
