import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { TimeSlotPicker } from './TimeSlotPicker';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof TimeSlotPicker> = {
  component: TimeSlotPicker,
  beforeEach: () => {
    const orig = window.fetch;
    window.fetch = (input, init) => {
      if (typeof input === 'string' && input.includes('/api/crm/appointments/slots')) {
        return Promise.resolve(new Response(JSON.stringify({
          slots: [
            { start: '2026-04-21T09:00:00', end: '2026-04-21T09:30:00' },
            { start: '2026-04-21T10:00:00', end: '2026-04-21T10:30:00' },
            { start: '2026-04-21T14:00:00', end: '2026-04-21T14:30:00' },
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

export const Default: Story = {
  args: { date: '2026-04-21', staffId: 'staff_1', locationId: 'loc_plateau', value: null, onSelect: noop },
};
