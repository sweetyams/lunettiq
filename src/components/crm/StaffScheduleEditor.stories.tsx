import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StaffScheduleEditor } from './StaffScheduleEditor';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof StaffScheduleEditor> = {
  component: StaffScheduleEditor,
  beforeEach: () => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.includes('/api/crm/staff/') && input.includes('/schedule')) {
        return Promise.resolve(new Response(JSON.stringify({
          schedule: [
            { dayOfWeek: 1, startTime: '09:00', endTime: '17:00' },
            { dayOfWeek: 3, startTime: '10:00', endTime: '18:00' },
          ],
        }), { headers: { 'Content-Type': 'application/json' } }));
      }
      return orig(input, init);
    };
    return () => { window.fetch = orig; };
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { staffId: 'staff_1', staffName: 'Marie Dupont', onClose: noop } };
