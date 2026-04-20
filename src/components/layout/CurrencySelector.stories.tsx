import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import CurrencySelector from './CurrencySelector';

const meta: Meta<typeof CurrencySelector> = { component: CurrencySelector };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
