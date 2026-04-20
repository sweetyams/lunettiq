import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { RxSelect } from './RxFields';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof RxSelect> = { component: RxSelect, title: 'PDP/Configurator/RxSelect' };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    label: 'Sphere (SPH)', value: 0, onChange: noop,
    options: [{ value: 0, label: '0.00 (Plano)' }, { value: -1, label: '-1.00' }, { value: 1, label: '+1.00' }],
  },
};

export const WithError: Story = {
  args: { ...Default.args, error: 'Value out of range' },
};

export const WithWarning: Story = {
  args: { ...Default.args, warning: 'High prescription — consider 1.67 index' },
};
