import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FitProfileEditor } from './FitProfileEditor';

const meta: Meta<typeof FitProfileEditor> = { component: FitProfileEditor };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    customerId: 'cust_123',
    profile: { face_shape: 'Oval', frame_width_mm: '138', bridge_width_mm: '20', temple_length_mm: '145', rx_on_file: 'Yes' },
  },
};

export const Empty: Story = {
  args: {
    customerId: 'cust_123',
    profile: { face_shape: '', frame_width_mm: '', bridge_width_mm: '', temple_length_mm: '', rx_on_file: '' },
  },
};
