import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import PrimaryNav from './PrimaryNav';

const meta: Meta<typeof PrimaryNav> = { component: PrimaryNav };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
