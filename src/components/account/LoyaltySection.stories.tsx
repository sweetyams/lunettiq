import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import LoyaltySection from './LoyaltySection';

const meta: Meta<typeof LoyaltySection> = { component: LoyaltySection };
export default meta;
type Story = StoryObj<typeof meta>;

export const CultMember: Story = {
  args: {
    loyalty: { tier: 'cult', status: 'active', creditBalance: 125, memberSince: '2024-01-15', nextRenewal: '2026-05-15', pointsBalance: 2400, referralCount: 3 },
  },
};

export const Essential: Story = {
  args: {
    loyalty: { tier: 'essential', status: 'active', creditBalance: 0, memberSince: '2025-06-01', nextRenewal: '2026-06-01', pointsBalance: 800, referralCount: 0 },
  },
};
