import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { PreferencesEditor } from './PreferencesEditor';

const meta: Meta<typeof PreferencesEditor> = { component: PreferencesEditor };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    customerId: 'cust_123',
    stated: { shapes: ['Round', 'Cat-eye'], materials: ['Acetate'], colours: ['Black', 'Tortoise'], avoid: ['Aviator'], notes: 'Prefers lightweight frames' },
    derived: { derivedShapes: ['Round'], derivedMaterials: ['Acetate'], derivedColours: ['Black'] },
  },
};

export const Empty: Story = {
  args: { customerId: 'cust_123', stated: { shapes: [], materials: [], colours: [], avoid: [], notes: '' }, derived: null },
};
