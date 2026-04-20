import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MembershipCard } from './MembershipCard';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof MembershipCard> = { component: MembershipCard };
export default meta;
type Story = StoryObj<typeof meta>;

export const CultActive: Story = {
  args: {
    tier: 'cult', status: 'active', creditBalance: 125, memberSince: '2024-01-15',
    nextRenewal: '2026-05-15', lastLensRefresh: '2025-11-01', lastRotation: '2025-09-15',
    customerId: 'cust_123', onTierChange: noop,
  },
};

export const VaultPaused: Story = {
  args: { ...CultActive.args, tier: 'vault', status: 'paused' },
};

export const NoMembership: Story = {
  args: { ...CultActive.args, tier: null, status: null, creditBalance: 0 },
};
