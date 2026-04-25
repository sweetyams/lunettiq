import { redirect } from 'next/navigation';

export default function SystemStatusRedirect() {
  redirect('/crm/system/status');
}
