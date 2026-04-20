import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { WeekCalendar } from './WeekCalendar';
import type { CalendarEvent } from './WeekCalendar';
import { noop } from '@/components/__mocks__/storyData';

const meta: Meta<typeof WeekCalendar> = { component: WeekCalendar };
export default meta;
type Story = StoryObj<typeof meta>;

const events: CalendarEvent[] = [
  { id: 'apt_1', title: 'Fitting — Plateau Round', customerName: 'Sophie Tremblay', customerId: 'cust_1', status: 'confirmed', startsAt: '2026-04-20T10:00:00', endsAt: '2026-04-20T10:30:00', staffId: 'staff_1' },
  { id: 'apt_2', title: 'Consultation', customerName: 'Marc Leblanc', customerId: 'cust_2', status: 'pending', startsAt: '2026-04-22T14:00:00', endsAt: '2026-04-22T15:00:00', staffId: 'staff_1' },
];

export const Default: Story = {
  args: { weekStart: '2026-04-20', events, onEventClick: noop, onSlotClick: noop, onWeekChange: noop },
};

export const Empty: Story = {
  args: { weekStart: '2026-04-20', events: [], onEventClick: noop, onSlotClick: noop, onWeekChange: noop },
};
