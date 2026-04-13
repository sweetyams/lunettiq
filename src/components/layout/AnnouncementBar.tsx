import { getAnnouncementBars } from '@/lib/shopify/queries/metaobjects';
import AnnouncementBarClient from './AnnouncementBarClient';

export default async function AnnouncementBar() {
  let bars;
  try {
    bars = await getAnnouncementBars();
  } catch {
    return null;
  }

  const activeBar = bars.find((bar) => bar.active && bar.message);
  if (!activeBar) return null;

  return (
    <AnnouncementBarClient
      message={activeBar.message}
      linkText={activeBar.linkText}
      linkUrl={activeBar.linkUrl}
    />
  );
}
