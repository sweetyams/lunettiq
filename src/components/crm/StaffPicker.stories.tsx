import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StaffPicker } from './StaffPicker';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof StaffPicker> = { component: StaffPicker };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    staff: [
      { id: 'staff_1', firstName: 'Marie', lastName: 'Dupont', imageUrl: null },
      { id: 'staff_2', firstName: 'Jean', lastName: 'Lavoie', imageUrl: null },
    ],
    value: 'staff_1',
    onChange: noop,
  },
};
