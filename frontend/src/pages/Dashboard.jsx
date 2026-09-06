import { useState, useEffect } from 'react';
import { Card, Row, Col, Table, Button, Space, Steps, Empty, Spin, Popconfirm, message } from 'antd';
import { CloudUploadOutlined, DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAnalytics, listDocuments, getConfidenceDistribution, getDistrictProgress, getPendingVerifications, deleteDocument, clearAllDocuments, downloadVerifiedDocument } from '../api';
import { PageHeader, StatCard, StatusTag, ConfidenceTag, SectionTitle, pct } from '../components/Page';

function Dashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, processed: 0, pending: 0, accuracy: 0 });
  const [recentDocs, setRecentDocs] = useState([]);
  const [confDist, setConfDist] = useState({ high: 0, medium: 0, low: 0 });
  const [districtCount, setDistrictCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);

  const refreshDocs = () => {
    listDocuments(0, 10, searchQuery)
      .then((res) => {
        if (res?.documents) {
          const mapped = res.documents.map((d) => ({
            key: String(d.id),
            id: d.id,
            name: d.filename,
            type: d.file_type === 'pdf' ? 'Land Register PDF' : 'Cadastral Map / Image',
            district: d.language === 'hi' ? 'Hindi' : (d.language || '—'),
            status: d.status === 'completed' ? (d.needs_verification > 0 ? 'Pending Review' : 'Completed') : (d.status === 'failed' ? 'Failed' : 'Processing'),
            confidence: d.avg_confidence != null ? Math.round(d.avg_confidence * 100) : null,
            date: d.created_at ? new Date(d.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—',
          }));
          setRecentDocs(mapped);
        } else {
          setRecentDocs([]);
        }
      })
      .catch(() => {});
  };

  const refreshStats = () => {
    getAnalytics()
      .then((res) => {
        if (res?.documents && res?.fields) {
          const total = res.documents.total || 0;
          const verified = res.fields.verified || 0;
          const pending = res.fields.low_confidence || 0;
          const acc = res.accuracy?.average_confidence ? Number((res.accuracy.average_confidence * 100).toFixed(1)) : 0;
          setStats({ total, processed: verified, pending, accuracy: acc });
        } else {
          setStats({ total: 0, processed: 0, pending: 0, accuracy: 0 });
        }
      })
      .catch(() => {});
    getConfidenceDistribution()
      .then((res) => {
        if (res) setConfDist({ high: res.high || 0, medium: res.medium || 0, low: res.low || 0 });
      })
      .catch(() => {});
    getPendingVerifications(1)
      .then((res) => setQueueCount(res?.total || 0))
      .catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    refreshStats();
    refreshDocs();
    getDistrictProgress()
      .then((res) => {
        if (res?.district_progress) setDistrictCount(res.district_progress.length);
      })
      .catch(() => {});
    setLoading(false);
  }, [searchQuery]);

  const handleDelete = async (id) => {
    try {
      await deleteDocument(id);
      message.success(`Document #${id} deleted`);
      refreshDocs();
      refreshStats();
    } catch (e) {
      message.error(e?.response?.data?.detail || 'Delete failed');
    }
  };

  const handleDownload = async (rec) => {
    try {
      const blob = await downloadVerifiedDocument(rec.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = rec.name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      message.success(`Downloading ${rec.name}`);
    } catch(e){ message.error(e?.response?.data?.detail || 'Download failed — not yet verified'); }
  };
  const handleClearAll = async () => {
    try {
      const res = await clearAllDocuments();
      message.success(res?.message || 'All uploaded data cleared');
      refreshDocs();
      refreshStats();
    } catch (e) {
      message.error(e?.response?.data?.detail || 'Clear-all failed');
    }
  };

  const columns = [
    {
      title: 'Document',
      dataIndex: 'name',
      key: 'name',
      render: (text, rec) => (
        <div style={{ lineHeight: 1.35 }}>
          <div style={{ fontWeight: 700, color: '#0F1F38', fontSize: 13.5 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>{rec.district} · {rec.type}</div>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status) => <StatusTag status={status === 'Completed' ? 'Verified' : status} />
    },
    {
      title: 'Confidence',
      dataIndex: 'confidence',
      key: 'confidence',
      width: 130,
      render: (val) => <ConfidenceTag value={val} />
    },
    { title: 'Date', dataIndex: 'date', key: 'date', width: 130, render: (d) => <span style={{ color: '#475569', fontSize: 12.5 }}>{d}</span> },
    { title: '', key: 'action', width: 220, align: 'right', render: (_, r) => (
      <Space size={6}>
        <Button size="small" onClick={() => navigate(`/documents/${r.id}`)} style={{ borderRadius: 8, fontWeight: 700 }}>View</Button>
        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(r)} disabled={r.status !== 'Completed' && r.status !== 'Verified'} title={r.status === 'Completed' || r.status === 'Verified' ? 'Download verified document' : 'Available after verification'} style={{ borderRadius: 8, fontWeight:700 }}>Download</Button>
        <Popconfirm title={`Delete "${r.name}"?`} description="This removes the file, fields and audit trail." okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }}>Delete</Button>
        </Popconfirm>
      </Space>
    ) },
  ];

  const kpis = [
    { label: 'Total ingested', value: stats.total, sub: `${districtCount} districts`, tone: 'slate' },
    { label: 'Verified fields', value: stats.processed, sub: 'Human verified', tone: 'green' },
    { label: 'Pending review', value: stats.pending, sub: `${queueCount} in queue`, tone: 'amber' },
    { label: 'Model accuracy', value: stats.accuracy ? `${stats.accuracy}%` : '—', sub: 'Avg. confidence', tone: 'blue' },
  ];

  const spectrum = [
    { name: 'High', range: '> 90% confidence', value: confDist.high, fill: '#0B57D0', tone: 'blue' },
    { name: 'Medium', range: '70–90% confidence', value: confDist.medium, fill: '#64748B', tone: 'slate' },
    { name: 'Low', range: '< 70% confidence', value: confDist.low, fill: '#C76A0A', tone: 'amber' },
  ];

  const totalFields = confDist.high + confDist.medium + confDist.low;

  return (
    <div className="animate-fade-in-up overview-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow="Overview · Live"
        title="Digitization overview"
        description={searchQuery ? `Showing documents matching “${searchQuery}”.` : 'Monitor intake, OCR extraction and human verification in one place.'}
        actions={
          <>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => navigate('/upload')}>New intake</Button>
            <Button onClick={() => navigate('/verification')}>Review queue ({queueCount})</Button>
          </>
        }
      />

      <Spin spinning={loading}>
        <Row gutter={[12, 12]}>
          {kpis.map((k) => (
            <Col xs={24} sm={12} lg={6} key={k.label}>
              <StatCard label={k.label} value={k.value} sub={k.sub} tone={k.tone} />
            </Col>
          ))}
        </Row>
      </Spin>

      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}>
          <Card bordered={false} className="saffron-card" title={<SectionTitle>Pipeline</SectionTitle>} bodyStyle={{ padding: '20px 22px' }} style={{ height: '100%' }}>
            <Steps
              direction="vertical"
              current={stats.total > 0 ? 1 : 0}
              items={[
                {
                  title: <span style={{ fontWeight: 700, fontSize: 14, color: '#0F1F38' }}>Ingest &amp; scan</span>,
                  description: <span style={{ color: '#64748B', fontSize: 13 }}>{stats.total} records ingested and stored.</span>,
                },
                {
                  title: <span style={{ fontWeight: 700, fontSize: 14, color: '#0F1F38' }}>OCR extraction</span>,
                  description: <span style={{ color: '#64748B', fontSize: 13 }}>{stats.processed} fields verified · {stats.pending} awaiting review.</span>,
                },
                {
                  title: <span style={{ fontWeight: 700, fontSize: 14, color: '#0F1F38' }}>Human audit gate</span>,
                  description: <span style={{ color: '#64748B', fontSize: 13 }}>{stats.pending > 0 ? `${stats.pending} fields below 80% confidence await review.` : 'Nothing awaiting review.'}</span>,
                },
              ]}
            />
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card
            bordered={false}
            className="saffron-card"
            title={<SectionTitle extra={<span style={{ fontSize: 12, color: '#64748B', fontWeight: 600 }}>Avg. {pct(stats.accuracy)}</span>}>Confidence spectrum</SectionTitle>}
            bodyStyle={{ padding: '20px 22px' }}
            style={{ height: '100%' }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {spectrum.map((d) => {
                const share = totalFields > 0 ? Math.round((d.value / totalFields) * 100) : 0;
                return (
                  <div key={d.name}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#0F1F38' }}>{d.name} <span style={{ fontWeight: 500, color: '#64748B' }}>· {d.range}</span></span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0F1F38', fontVariantNumeric: 'tabular-nums' }}>{d.value} fields · {share}%</span>
                    </div>
                    <div style={{ height: 8, background: '#EDF0F5', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{ width: `${share}%`, height: '100%', background: d.fill, borderRadius: 999 }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 16, background: '#F8FAFC', border: '1px solid #E1E6EE', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#475569' }}>
              Fields below 80% confidence are routed to the review queue automatically.
            </div>
          </Card>
        </Col>
      </Row>

      <Card
        bordered={false}
        className="saffron-card"
        title={<SectionTitle extra={recentDocs.length > 0 && !searchQuery ? (
          <Popconfirm title="Delete all uploaded documents?" description="This permanently removes every file, field and audit entry." okText="Delete all" cancelText="Cancel" okButtonProps={{ danger: true }} onConfirm={handleClearAll}>
            <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }}>Clear all</Button>
          </Popconfirm>
        ) : null}>Recent records</SectionTitle>}
        bodyStyle={{ padding: 16 }}
      >
        <Table
          dataSource={recentDocs}
          columns={columns}
          pagination={false}
          size="middle"
          locale={{ emptyText: <Empty description="No documents yet — upload your first record to get started" /> }}
        />
      </Card>
    </div>
  );
}
export default Dashboard;
