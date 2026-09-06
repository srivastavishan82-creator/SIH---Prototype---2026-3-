import { Card, Tag } from 'antd';

// ---------------------------------------------------------------------------
// Bhoomi AI Console — shared clean primitives.
// Every inner page uses these so headers, stats and status pills look
// consistent: sentence case, % symbols, soft tones, no shouting.
// ---------------------------------------------------------------------------

export const INK = '#0F1F38';
export const SLATE = '#475569';
export const MUTED = '#64748B';
export const FAINT = '#94A3B8';
export const BORDER = '#E1E6EE';
export const BLUE = '#0B57D0';
export const BLUE_DARK = '#0842A0';

export const pct = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : `${v}%`);

const TONES = {
  blue: { dot: '#0B57D0', bg: '#E8EFFD', border: '#B9CFF5', text: '#0842A0' },
  slate: { dot: '#64748B', bg: '#F1F5F9', border: '#E1E6EE', text: '#334155' },
  amber: { dot: '#C76A0A', bg: '#FEF3E6', border: '#F0D3AC', text: '#7A3F00' },
  green: { dot: '#137333', bg: '#E6F4EA', border: '#B7DFC0', text: '#0F5C28' },
  red: { dot: '#B3261E', bg: '#FCE8E6', border: '#F5C6C2', text: '#8C1D18' },
};

// Consistent page header: eyebrow · title · description · actions.
export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <Card bordered={false} className="page-head" bodyStyle={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          {eyebrow && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 800, letterSpacing: '0.09em', textTransform: 'uppercase', color: MUTED }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: BLUE, display: 'inline-block' }} />
              {eyebrow}
            </div>
          )}
          <div style={{ fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: '-0.03em', color: INK, marginTop: 6, lineHeight: 1.15 }}>
            {title}
          </div>
          {description && (
            <div style={{ color: SLATE, fontSize: 13.5, marginTop: 6, maxWidth: 640, lineHeight: 1.55 }}>
              {description}
            </div>
          )}
        </div>
        {actions && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', flexShrink: 0 }}>
            {actions}
          </div>
        )}
      </div>
      {children}
    </Card>
  );
}

// Single KPI style for the whole console.
export function StatCard({ label, value, sub, tone = 'slate' }) {
  const t = TONES[tone] || TONES.slate;
  return (
    <Card bordered={false} className="stat-card" bodyStyle={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase', color: MUTED }}>
        {label}
      </div>
      <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-0.03em', color: INK, marginTop: 6, lineHeight: 1, fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && (
        <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 7, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 999, padding: '4px 11px', fontSize: 11.5, fontWeight: 700, color: t.text }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: t.dot, display: 'inline-block' }} />
          {sub}
        </div>
      )}
    </Card>
  );
}

// One status language everywhere.
const STATUS_MAP = {
  Verified: 'green',
  Completed: 'green',
  Approved: 'green',
  Done: 'green',
  'Needs Review': 'amber',
  'Pending Review': 'amber',
  Pending: 'amber',
  Review: 'amber',
  Low: 'red',
  'Low Confidence': 'red',
  Failed: 'red',
  Processing: 'blue',
  Active: 'blue',
  Live: 'blue',
};

export function StatusTag({ status }) {
  const tone = STATUS_MAP[status] || 'slate';
  const t = TONES[tone];
  return (
    <Tag style={{ margin: 0, borderRadius: 999, fontWeight: 700, fontSize: 11, background: t.bg, color: t.text, border: `1px solid ${t.border}`, padding: '2px 10px' }}>
      {status}
    </Tag>
  );
}

// Confidence as a clean "87%" pill.
export function ConfidenceTag({ value }) {
  if (value == null) return <span style={{ fontSize: 12, color: FAINT, fontStyle: 'italic' }}>Analyzing</span>;
  const tone = value >= 90 ? 'green' : value >= 80 ? 'blue' : value >= 60 ? 'amber' : 'red';
  const t = TONES[tone];
  return (
    <Tag style={{ margin: 0, borderRadius: 999, fontWeight: 800, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", background: t.bg, color: t.text, border: `1px solid ${t.border}` }}>
      {value}%
    </Tag>
  );
}

// Small section title used inside cards.
export function SectionTitle({ children, extra }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
      <span style={{ fontWeight: 800, color: INK, fontSize: 15, fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", letterSpacing: '-0.01em' }}>
        {children}
      </span>
      {extra}
    </div>
  );
}

export default { PageHeader, StatCard, StatusTag, ConfidenceTag, SectionTitle, pct };
