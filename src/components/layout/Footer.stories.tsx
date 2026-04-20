import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Footer from './Footer';

const meta: Meta<typeof Footer> = { component: Footer };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
