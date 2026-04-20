import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StaggerContainer, StaggerItem } from './Stagger';

const meta: Meta<typeof StaggerContainer> = { component: StaggerContainer, title: 'Shared/Stagger' };
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <StaggerContainer className="space-y-4">
      {['Plateau Round', 'Dix30 Aviator', 'Signature Cat-Eye'].map((t) => (
        <StaggerItem key={t}><div className="p-4 border rounded">{t}</div></StaggerItem>
      ))}
    </StaggerContainer>
  ),
};
