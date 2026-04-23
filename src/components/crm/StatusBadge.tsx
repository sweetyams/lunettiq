const STYLES: Record<string, { bg: string; color: string }> = {
  active: { bg: '#95FFB9', color: '#065f46' },
  draft: { bg: '#CFEDFF', color: '#1e40af' },
  archived: { bg: '#f3f4f6', color: '#6b7280' },
};

export function StatusBadge({ status, size = 'sm', style }: { status: string | null | undefined; size?: 'sm' | 'md'; style?: React.CSSProperties }) {
  if (!status) return null;
  const s = STYLES[status] ?? STYLES.archived;
  const fontSize = size === 'md' ? 11 : 9;
  const padding = size === 'md' ? '2px 8px' : '1px 5px';
  return (
    <span style={{ fontSize, padding, borderRadius: 8, background: s.bg, color: s.color, fontWeight: 600, ...style }}>
      {status}
    </span>
  );
}
