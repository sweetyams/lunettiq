import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import KnownAboutYou from './KnownAboutYou';

const meta: Meta<typeof KnownAboutYou> = { component: KnownAboutYou };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    ctx: {
      tier: 'cult', creditBalance: 50, creditExpiry: null, referralCount: 2,
      rx: { daysUntilExpiry: 120, expiresApprox: '2026-08-15' },
      fit: { frameWidthMm: 136 },
      recommendations: [],
      stated: { shapes: ['Round', 'Cat-eye'], materials: ['Acetate'], colours: ['Black', 'Tortoise'], avoid: [], notes: 'Prefers lightweight frames' },
      derived: { shapes: ['Round'], materials: ['Acetate'], colours: ['Black'] },
      namedOptician: 'Marie', lastOrderDate: '2024-06-01', lensRefresh: true,
    },
  },
};
