import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CrmSidebar } from './CrmSidebar';

const meta: Meta<typeof CrmSidebar> = { component: CrmSidebar };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
