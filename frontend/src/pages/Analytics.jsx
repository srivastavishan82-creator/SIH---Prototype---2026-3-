import { useState, useEffect, useMemo } from 'react';
import { Card, Row, Col, Tag, Button, Divider, Empty, Spin, Space, Timeline, Avatar, message } from 'antd';
import {
  DownloadOutlined,
  RiseOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  BarChartOutlined,
  PieChartOutlined,
  ThunderboltOutlined,
  CrownOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloudUploadOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LabelList,
} from 'recharts';
import { getAnalytics, getDistrictProgress, getConfidenceDistribution, getUploadsTrend, getUserActivity, getCurrentUser } from '../api';
import { PageHeader, StatCard, SectionTitle, StatusTag } from '../components/Page';

const INSPECTOR_EMAIL = 'srivastavishan82@gmail.com';

const BLUE = '#0B57D0';
const SLATE = '#64748B';
const AMBER = '#C76A0A';
const GREEN = '#137333';
const INK = '#0F1F38';

// Styled tooltip shared by all charts.
function ChartTip({ active, payload, label, suffix = '' }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0A1F44', color: '#fff', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: '0 8px 20px rgba(3,12,32,.35)', border: '1px solid rgba(255,255,255,.14)' }}>
      <div style={{ fontWeight: 800, marginBottom: 2 }}>{payload[0]?.name || label}</div>
      <div style={{ color: '#B9C8E2' }}>{payload[0]?.value}{suffix}</div>
    </div>
  );
}

function downloadCsv(filename, rows) {

  if (!rows?.length) {
    message.warning('Nothing to export yet');
    return;
  }
  const head = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [head.join(','), ...rows.map((r) => head.map((h) => esc(r[h])).join(','))].join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  message.success(`${filename} downloaded`);
}

// ---------- Team helpers (Stitch expressive) ----------
function timeAgo(v) {
  if (!v) return '—';
  const s = Math.floor((Date.now() - new Date(v).getTime()) / 1000);
  if (Number.isNaN(s)) return '—';
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function initialsOf(name, email) {
  const src = (name || email || '?').trim();
  if (!src || src === '?') return '?';
  if (src.includes('@') && !src.includes(' ')) return src.slice(0, 2).toUpperCase();
  return src.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#0B57D0,#0842A0)',
  'linear-gradient(135deg,#137333,#0B4D22)',
  'linear-gradient(135deg,#C76A0A,#8A4A06)',
  'linear-gradient(135deg,#5B5BD6,#3730A3)',
  'linear-gradient(135deg,#0E7490,#155E75)',
];

function actionTone(action = '') {
  const a = action.toLowerCase();
  if (a.includes('verif') || a.includes('approv')) return { dot: '#137333', icon: <CheckCircleOutlined /> };
  if (a.includes('upload') || a.includes('ingest')) return { dot: '#0B57D0', icon: <CloudUploadOutlined /> };
  if (a.includes('login')) return { dot: '#64748B', icon: <LoginOutlined /> };
  if (a.includes('delet') || a.includes('revok')) return { dot: '#B3261E', icon: <DownloadOutlined /> };
  if (a.includes('register') || a.includes('sync')) return { dot: '#C76A0A', icon: <ThunderboltOutlined /> };
  return { dot: '#0B57D0', icon: <FileTextOutlined /> };
}

function Analytics() {
  const [districtData, setDistrictData] = useState([]);
  const [accuracy, setAccuracy] = useState({ high: 0, medium: 0, low: 0 });
  const [trendData, setTrendData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInspector, setIsInspector] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);
  const [teamTrail, setTeamTrail] = useState([]);
  const [kpis, setKpis] = useState([
    { title: 'Total pages', value: 0, sub: 'Documents', tone: 'slate' },
    { title: 'Verified', value: 0, sub: 'Fields verified', tone: 'green' },
    { title: 'Pending review', value: 0, sub: 'Fields below 80%', tone: 'amber' },
    { title: 'Accuracy', value: '—', sub: 'Avg. confidence', tone: 'blue' },
  ]);

  const totals = useMemo(() => ({
    processed: districtData.reduce((a, c) => a + (c.processed || 0), 0),
    pending: districtData.reduce((a, c) => a + (c.pending || 0), 0),
  }), [districtData]);

  const peakDay = trendData.length
    ? trendData.reduce((a, c) => (c.volume > a.volume ? c : a), trendData[0])
    : null;

  const weekVolume = useMemo(
    () => trendData.slice(-7).reduce((a, c) => a + (c.volume || 0), 0),
    [trendData]
  );

  const donutData = useMemo(() => [
    { name: 'High · above 90%', value: accuracy.high || 0, fill: BLUE },
    { name: 'Medium · 70–90%', value: accuracy.medium || 0, fill: SLATE },
    { name: 'Low · below 70%', value: accuracy.low || 0, fill: AMBER },
  ], [accuracy]);

  const donutTotal = donutData.reduce((a, c) => a + c.value, 0);

  const districtBars = useMemo(
    () => [...districtData].sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 6)
      .map((d) => ({ name: d.name, verified: d.processed, pending: d.pending })),
    [districtData]
  );

  useEffect(() => {
    setLoading(true);
    getAnalytics().then((res) => {
      if (res?.documents && res?.fields) {
        const total = res.documents.total || 0;
        const verified = res.fields.verified || 0;
        const pending = res.fields.low_confidence || 0;
        const acc = res.accuracy?.average_confidence ? (res.accuracy.average_confidence * 100).toFixed(1) : null;
        setKpis([
          { title: 'Total pages', value: total, sub: 'Documents', tone: 'slate' },
          { title: 'Verified', value: verified, sub: 'Fields verified', tone: 'green' },
          { title: 'Pending review', value: pending, sub: 'Fields below 80%', tone: 'amber' },
          { title: 'Accuracy', value: acc ? `${acc}%` : '—', sub: 'Avg. confidence', tone: 'blue' },
        ]);
      }
    }).catch(() => {}).finally(() => setLoading(false));

    getDistrictProgress().then((res) => {
      if (res?.district_progress) {
        setDistrictData(res.district_progress.map((d) => ({
          name: d.district || 'Unknown',
          processed: d.verified || 0,
          pending: d.pending || 0,
          total: d.count,
        })));
      }
    }).catch(() => {});

    getConfidenceDistribution().then((res) => {
      if (res?.high != null) setAccuracy({ high: res.high || 0, medium: res.medium || 0, low: res.low || 0 });
    }).catch(() => {});

    getUploadsTrend().then((res) => {
      if (res?.trend) setTrendData(res.trend);
    }).catch(() => {});

    if (localStorage.getItem('lrds_token')) {
      getCurrentUser()
        .then((u) => {
          if ((u?.email || '').toLowerCase() === INSPECTOR_EMAIL) {
            setIsInspector(true);
            return getUserActivity(50).then((res) => {
              if (res?.users) setTeamUsers(res.users);
              if (res?.trail) setTeamTrail(res.trail);
            }).catch(() => {});
          }
          setIsInspector(false);
        })
        .catch(() => setIsInspector(false));
    }
  }, []);

  // Leaderboard, ranked by verified contribution.
  const leaderboard = useMemo(() => {
    const rows = [...teamUsers].sort((a, b) => (b.fields_verified || 0) - (a.fields_verified || 0));
    const max = Math.max(1, ...rows.map((u) => u.fields_verified || 0));
    return rows.map((u, i) => ({ ...u, rank: i + 1, share: Math.round(((u.fields_verified || 0) / max) * 100) }));
  }, [teamUsers]);

  const topPerformer = leaderboard[0] && (leaderboard[0].fields_verified || 0) > 0 ? leaderboard[0] : null;

  const teamTotals = useMemo(() => ({
    members: teamUsers.length,
    uploads: teamUsers.reduce((a, u) => a + (u.documents_uploaded || 0), 0),
    verified: teamUsers.reduce((a, u) => a + (u.fields_verified || 0), 0),
    today: teamTrail.filter((t) => {
      if (!t.created_at) return false;
      const d = new Date(t.created_at);
      const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }).length,
  }), [teamUsers, teamTrail]);

  const reports = [
    {
      icon: <BarChartOutlined />,
      tint: { bg: '#E8EFFD', border: '#B9CFF5', color: '#0842A0' },
      title: 'District ledger',
      desc: `${districtData.length} districts · verified vs pending per district.`,
      file: 'bhoomi-district-ledger.csv',
      rows: districtData.map((d) => ({ district: d.name, total: d.total, verified: d.processed, pending: d.pending, verified_pct: d.total ? Math.round((d.processed / d.total) * 100) : 0 })),
    },
    {
      icon: <FileTextOutlined />,
      tint: { bg: '#E6F4EA', border: '#B7DFC0', color: '#0F5C28' },
      title: 'Intake trend',
      desc: `${weekVolume} docs in the last ${Math.min(trendData.length, 7)} days · daily volumes.`,
      file: 'bhoomi-intake-trend.csv',
      rows: trendData.map((t) => ({ date: t.date, day: t.label, documents: t.volume })),
    },
    {
      icon: <SafetyCertificateOutlined />,
      tint: { bg: '#FEF3E6', border: '#F0D3AC', color: '#7A3F00' },
      title: 'Audit trail',
      desc: `${teamTrail.length} logged events · inspector oversight.`,
      file: 'bhoomi-audit-trail.csv',
      rows: teamTrail.map((t) => ({ when: t.created_at, user: t.user_email, action: t.action, detail: t.detail || t.new_value || `${t.entity_type} #${t.entity_id}` })),
      locked: !isInspector,
    },
  ];

  return (
    <div className="animate-fade-in-up analytics-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow={`Reports · ${districtData.length} districts`}
        title="Analytics & reports"
        description="Throughput, accuracy and district performance — export anything below as CSV."
        actions={peakDay ? (
          <Tag style={{ margin: 0, borderRadius: 999, background: '#F1F5F9', color: INK, border: '1px solid #E1E6EE', fontWeight: 700, padding: '5px 12px' }}>
            <RiseOutlined style={{ color: BLUE }} /> Peak: {peakDay.label} · {peakDay.volume} docs
          </Tag>
        ) : null}
      />

      {/* ---------- Hero insight band ---------- */}
      <Card bordered={false} className="analytics-hero" bodyStyle={{ padding: 0 }}>
        <Row>
          <Col xs={24} lg={9} style={{ padding: '24px 24px 20px' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#8FB4F5' }}>
              Performance at a glance
            </div>
            <div style={{ fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em', color: '#fff', marginTop: 8, lineHeight: 1.05 }}>
              {weekVolume} <span style={{ fontSize: 16, fontWeight: 600, color: '#B9C8E2' }}>docs this week</span>
            </div>
            <div style={{ display: 'flex', gap: 22, marginTop: 18, flexWrap: 'wrap' }}>
              {[
                { k: 'Verified', v: totals.processed, c: '#34D399' },
                { k: 'Pending', v: totals.pending, c: '#F5B544' },
                { k: 'High confidence', v: donutTotal ? `${Math.round(((accuracy.high || 0) / donutTotal) * 100)}%` : '—', c: '#8FB4F5' },
              ].map((s) => (
                <div key={s.k}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 11.5, color: '#B9C8E2', fontWeight: 600 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 999, background: s.c, display: 'inline-block' }} />{s.k}
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                </div>
              ))}
            </div>
          </Col>
          <Col xs={24} lg={15} style={{ padding: '16px 16px 8px', minHeight: 230 }}>
            {trendData.length === 0 ? (
              <div style={{ height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Empty description={<span style={{ color: '#B9C8E2' }}>No intake activity yet</span>} />
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={trendData.slice(-14)} margin={{ top: 8, right: 12, bottom: 0, left: -14 }}>
                  <defs>
                    <linearGradient id="heroVol" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#5B9CFF" stopOpacity={0.85} />
                      <stop offset="100%" stopColor="#5B9CFF" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,.1)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#8EA3C7', fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fill: '#8EA3C7', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                  <Tooltip content={<ChartTip suffix=" docs" />} cursor={{ stroke: 'rgba(255,255,255,.3)' }} />
                  <Area type="monotone" dataKey="volume" name="Documents" stroke="#8FB4F5" strokeWidth={2.5} fill="url(#heroVol)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </Col>
        </Row>
      </Card>

      {/* ---------- KPI row ---------- */}
      <Spin spinning={loading}>
        <Row gutter={[12, 12]}>
          {kpis.map((k) => (
            <Col xs={12} lg={6} key={k.title} style={{ display: 'flex' }}>
              <div style={{ flex: 1, display: 'flex' }}>
                <StatCard label={k.title} value={k.value} sub={k.sub} tone={k.tone} />
              </div>
            </Col>
          ))}
        </Row>
      </Spin>

      {/* ---------- Charts row ---------- */}
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={14} style={{ display: 'flex' }}>
          <Card
            bordered={false}
            className="saffron-card"
            title={<SectionTitle extra={<span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}><ThunderboltOutlined style={{ color: BLUE }} /> Verified vs pending</span>}>District comparison</SectionTitle>}
            bodyStyle={{ padding: '8px 12px 12px' }}
            style={{ flex: 1 }}
          >
            {districtBars.length === 0 ? (
              <Empty description="Upload documents to compare districts" />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={districtBars} layout="vertical" margin={{ top: 8, right: 44, bottom: 0, left: 8 }} barCategoryGap="26%">
                  <CartesianGrid stroke="#EDF0F5" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={92} tick={{ fill: '#334155', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{ fill: '#F3F6FC' }} />
                  <Bar dataKey="verified" name="Verified" stackId="d" fill={BLUE} radius={[0, 0, 0, 0]} barSize={16} />
                  <Bar dataKey="pending" name="Pending" stackId="d" fill="#E4C084" radius={[0, 8, 8, 0]} barSize={16}>
                    <LabelList dataKey="pending" position="right" formatter={(v) => (v > 0 ? v : '')} style={{ fill: '#7A3F00', fontSize: 11, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={10} style={{ display: 'flex' }}>
          <Card
            bordered={false}
            className="saffron-card"
            title={<SectionTitle extra={<PieChartOutlined style={{ color: BLUE }} />}>Confidence mix</SectionTitle>}
            bodyStyle={{ padding: '8px 12px 16px' }}
            style={{ flex: 1 }}
          >
            {donutTotal === 0 ? (
              <Empty description="No extraction data yet" />
            ) : (
              <>
                <div style={{ position: 'relative', width: '100%', height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip content={<ChartTip suffix=" fields" />} />
                      <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={88} paddingAngle={3} strokeWidth={0} startAngle={90} endAngle={-270}>
                        {donutData.map((d) => <Cell key={d.name} fill={d.fill} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{donutTotal}</div>
                    <div style={{ fontSize: 11.5, color: '#64748B', fontWeight: 600 }}>fields scored</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                  {donutData.map((d) => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 3, background: d.fill, flexShrink: 0 }} />
                      <span style={{ color: '#334155', fontWeight: 600 }}>{d.name}</span>
                      <span style={{ marginLeft: 'auto', fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>
                        {d.value} · {donutTotal ? Math.round((d.value / donutTotal) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 12, background: '#F8FAFC', border: '1px solid #E1E6EE', borderRadius: 10, padding: '9px 12px', fontSize: 12, color: '#475569' }}>
                  Fields below 80% confidence are routed to the review queue automatically.
                </div>
              </>
            )}
          </Card>
        </Col>
      </Row>

      {/* ---------- District ledger ---------- */}
      <Card
        bordered={false}
        className="saffron-card"
        title={<SectionTitle extra={<Button size="small" icon={<DownloadOutlined />} onClick={() => downloadCsv('bhoomi-district-ledger.csv', reports[0].rows)} style={{ borderRadius: 8, fontWeight: 700 }}>Export CSV</Button>}>District ledger</SectionTitle>}
        bodyStyle={{ padding: 16 }}
      >
        {districtData.length === 0 ? (
          <Empty description="No district records yet — upload documents to populate this ledger" />
        ) : (
          <Row gutter={[12, 12]}>
            {[...districtData].sort((a, b) => (b.total || 0) - (a.total || 0)).map((d, i) => {
              const p = d.total > 0 ? Math.round((d.processed / d.total) * 100) : 0;
              return (
                <Col xs={24} md={12} key={d.name}>
                  <div style={{ border: '1px solid #E1E6EE', borderRadius: 12, padding: '13px 15px', background: i === 0 ? '#F6F9FF' : '#fff' }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: 700, color: INK, fontSize: 13.5 }}>
                        <span style={{ color: '#94A3B8', fontWeight: 800, marginRight: 8, fontVariantNumeric: 'tabular-nums' }}>{String(i + 1).padStart(2, '0')}</span>
                        {d.name}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' }}>{d.processed} of {d.total} · {p}%</span>
                    </div>
                    <div style={{ height: 7, background: '#EDF0F5', borderRadius: 999, overflow: 'hidden', marginTop: 9 }}>
                      <div style={{ width: `${p}%`, height: '100%', background: p >= 85 ? BLUE : '#94A3B8', borderRadius: 999 }} />
                    </div>
                    {d.pending > 0 && <div style={{ fontSize: 11.5, color: '#7A3F00', fontWeight: 600, marginTop: 6 }}>{d.pending} pending review</div>}
                  </div>
                </Col>
              );
            })}
          </Row>
        )}
      </Card>

      {/* ---------- Reports center ---------- */}
      <Card
        bordered={false}
        className="saffron-card"
        title={<SectionTitle extra={<span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>One-click CSV downloads</span>}>Reports</SectionTitle>}
        bodyStyle={{ padding: 16 }}
      >
        <Row gutter={[12, 12]}>
          {reports.map((r) => (
            <Col xs={24} md={8} key={r.title}>
              <div className="report-card">
                <div className="report-icon" style={r.tint ? { background: r.tint.bg, borderColor: r.tint.border, color: r.tint.color } : undefined}>{r.icon}</div>
                <div style={{ fontWeight: 800, color: INK, fontSize: 14.5, marginTop: 12, fontFamily: "'Plus Jakarta Sans','Inter',sans-serif" }}>{r.title}</div>
                <div style={{ fontSize: 12.5, color: '#64748B', marginTop: 5, lineHeight: 1.55, minHeight: 38 }}>{r.desc}</div>
                <Button
                  block
                  icon={<DownloadOutlined />}
                  disabled={r.locked || !r.rows.length}
                  title={r.locked ? 'Sign in as inspector to export the audit trail' : undefined}
                  onClick={() => downloadCsv(r.file, r.rows)}
                  style={{ marginTop: 12, borderRadius: 10, fontWeight: 700 }}
                >
                  {r.locked ? 'Inspector only' : 'Download CSV'}
                </Button>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* ---------- Team oversight · inspector only ---------- */}
      {isInspector && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section-kicker">
            <TeamOutlined /> Team oversight · inspector only
            <span className="section-kicker-meta">
              {teamTotals.members} members · {teamTotals.uploads} uploads · {teamTotals.verified} verified · {teamTotals.today} events today
            </span>
          </div>

          {/* Top performer spotlight */}
          {topPerformer && (
            <Card bordered={false} className="spotlight-card" bodyStyle={{ padding: '16px 20px' }}>
              <div className="spotlight-glow" />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', position: 'relative' }}>
                <Avatar size={54} style={{ background: AVATAR_GRADIENTS[0], fontWeight: 800, fontSize: 17, flexShrink: 0, border: '2px solid rgba(255,255,255,.5)' }}>
                  {initialsOf(topPerformer.full_name, topPerformer.email)}
                </Avatar>
                <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <CrownOutlined style={{ color: '#F5B544' }} />
                    <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#F5C86B' }}>Top performer</span>
                  </div>
                  <div style={{ fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", fontSize: 19, fontWeight: 800, color: '#fff', marginTop: 3, letterSpacing: '-0.02em' }}>
                    {topPerformer.full_name || topPerformer.email}
                  </div>
                  <div style={{ fontSize: 12, color: '#B9C8E2', marginTop: 2 }}>{topPerformer.email} · {topPerformer.role}</div>
                </div>
                <div style={{ display: 'flex', gap: 26, flexWrap: 'wrap' }}>
                  {[
                    { k: 'Verified', v: topPerformer.fields_verified || 0 },
                    { k: 'Uploads', v: topPerformer.documents_uploaded || 0 },
                    { k: 'Logins', v: topPerformer.logins || 0 },
                  ].map((s) => (
                    <div key={s.k} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{s.v}</div>
                      <div style={{ fontSize: 11, color: '#8EA3C7', fontWeight: 600 }}>{s.k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          <Row gutter={[12, 12]}>
            {/* Leaderboard */}
            <Col xs={24} lg={13} style={{ display: 'flex' }}>
              <Card
                bordered={false}
                className="saffron-card"
                title={<SectionTitle extra={<span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>{leaderboard.length} members</span>}>Team leaderboard</SectionTitle>}
                bodyStyle={{ padding: 12 }}
                style={{ flex: 1 }}
              >
                {leaderboard.length === 0 ? (
                  <Empty description="No team members yet" />
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {leaderboard.map((u, i) => (
                      <div key={u.id || u.email} className={`team-row${u.rank === 1 && (u.fields_verified || 0) > 0 ? ' first' : ''}`}>
                        <span className="team-rank">{String(u.rank).padStart(2, '0')}</span>
                        <Avatar size={38} style={{ background: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length], fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                          {initialsOf(u.full_name, u.email)}
                        </Avatar>
                        <div style={{ minWidth: 0, flex: '1 1 150px' }}>
                          <div style={{ fontWeight: 700, color: INK, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.full_name || u.email}
                          </div>
                          <div style={{ fontSize: 11.5, color: '#64748B', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {u.email} · {u.role}
                          </div>
                          <div className="team-bar">
                            <div className="team-bar-fill" style={{ width: `${u.share}%` }} />
                          </div>
                        </div>
                        <div className="team-mini">
                          <div><b>{u.documents_uploaded || 0}</b><span>uploads</span></div>
                          <div><b>{u.fields_verified || 0}</b><span>verified</span></div>
                          <div><b>{u.logins || 0}</b><span>logins</span></div>
                        </div>
                        <span className="team-active" title={u.last_active ? new Date(u.last_active).toLocaleString('en-IN') : 'Never active'}>
                          <ClockCircleOutlined /> {timeAgo(u.last_active)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>

            {/* Live activity timeline */}
            <Col xs={24} lg={11} style={{ display: 'flex' }}>
              <Card
                bordered={false}
                className="saffron-card"
                title={<SectionTitle extra={<Button size="small" icon={<DownloadOutlined />} onClick={() => downloadCsv('bhoomi-audit-trail.csv', reports[2].rows)} style={{ borderRadius: 8, fontWeight: 700 }}>Export</Button>}>Live activity</SectionTitle>}
                bodyStyle={{ padding: '16px 16px 12px' }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
              >
                {teamTrail.length === 0 ? (
                  <Empty description="No activity yet — logins, uploads and verifications will appear here" />
                ) : (
                  <div className="activity-scroll">
                    <Timeline
                      items={teamTrail.slice(0, 12).map((t, i) => {
                        const tone = actionTone(t.action);
                        return {
                          key: i,
                          dot: (
                            <span className="activity-dot" style={{ background: tone.dot }}>
                              <span style={{ color: '#fff', fontSize: 9, display: 'flex' }}>{tone.icon}</span>
                            </span>
                          ),
                          children: (
                            <div style={{ paddingBottom: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <StatusTag status={t.action} />
                                <span style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{timeAgo(t.created_at)}</span>
                              </div>
                              <div style={{ fontSize: 12.5, color: '#334155', marginTop: 4, lineHeight: 1.5 }}>
                                {t.detail || t.new_value || `${t.entity_type} #${t.entity_id}`}
                              </div>
                              <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 1 }}>{t.user_email}</div>
                            </div>
                          ),
                        };
                      })}
                    />
                  </div>
                )}
              </Card>
            </Col>
          </Row>
        </div>
      )}

      <Divider style={{ borderColor: '#E1E6EE', margin: '4px 0 0' }} />
      <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
        Figures refresh from live backend data · exports reflect exactly what you see above
      </div>
    </div>
  );
}
export default Analytics;
