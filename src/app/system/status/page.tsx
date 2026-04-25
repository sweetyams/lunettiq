import { redirect } from 'next/navigation';

export default function SystemStatusRedirect() {
  redirect('/crm/settings/system');
}
