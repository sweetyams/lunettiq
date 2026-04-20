import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CrmShell } from './CrmShell';

const meta: Meta<typeof CrmShell> = { component: CrmShell };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { children: <div className="p-8">CRM Content Area</div> },
};
