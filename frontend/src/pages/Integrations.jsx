import { useState, useEffect } from 'react';
import { Card, Button, message, Tabs, Table, Typography, Space, Popconfirm, List, Avatar, Tag, Modal, Input, Spin, Empty } from 'antd';
import { GlobalOutlined, KeyOutlined, DeleteOutlined, SyncOutlined, CheckCircleOutlined, CopyOutlined, PlusOutlined, SearchOutlined, EnvironmentOutlined } from '@ant-design/icons';
import { PageHeader, SectionTitle } from '../components/Page';
import { listApiKeys, createApiKey, revokeApiKey, getGisParcel, getGisParcels, getIntegrationsHealth } from '../api';
const { Title, Text } = Typography;

function Integrations() {
  const [health, setHealth] = useState(null);
  const [parcels, setParcels] = useState([]);
  const [parcelQuery, setParcelQuery] = useState('');
  const [parcelResult, setParcelResult] = useState(null);
  const [parcelLoading, setParcelLoading] = useState(false);
  const [layerOpen, setLayerOpen] = useState(false);
  const [apiKeys, setApiKeys] = useState([]);
  const [newKey, setNewKey] = useState(null);

  const fetchKeys = () => {
    listApiKeys().then((res) => {
      if (Array.isArray(res)) {
        const mapped = res.map(k => ({
          id: String(k.id),
          name: k.name,
          key: `${k.prefix || 'lrds_'}••••••••••••••••`,
          created: k.created_at ? k.created_at.split('T')[0] : '—',
          lastUsed: k.last_used_at ? k.last_used_at.split('T')[0] : 'Never',
          scope: 'read • write'
        }));
        setApiKeys(mapped);
      }
    }).catch(() => { setApiKeys([]); });
  };

  const fetchIntegrations = async () => {
    try {
      const h = await getIntegrationsHealth().catch(() => null);
      if (h) setHealth(h);
      const p = await getGisParcels(50).catch(() => null);
      if (p?.parcels) setParcels(p.parcels);
    } catch (e) {
      console.warn('integrations fetch failed', e?.message);
    }
  };

  useEffect(() => {
    fetchKeys();
    fetchIntegrations();
  }, []);

  const parcelColumns = [
    { title: 'Survey / Khasra', dataIndex: 'survey_no', key: 'survey_no', render: (v, r) => <span style={{ fontWeight: 800, color: '#0F172A', fontFamily: 'JetBrains Mono,monospace' }}>{v || '—'}{r.khasra_no && r.khasra_no !== v ? ` / ${r.khasra_no}` : ''}</span> },
    { title: 'Village', dataIndex: 'village', key: 'village', render: (v) => v || '—' },
    { title: 'District', dataIndex: 'district', key: 'district', render: (v) => v || '—' },
    { title: 'Owner', dataIndex: 'owner', key: 'owner', ellipsis: true, render: (v) => v || '—' },
    { title: 'Doc', dataIndex: 'document_id', key: 'document_id', width: 70, render: (v) => `#${v}` },
  ];

  const searchParcel = async () => {
    const q = parcelQuery.trim();
    if (!q) { message.warning('Enter a survey / khasra number first'); return; }
    setParcelLoading(true);
    setParcelResult(null);
    try {
      const res = await getGisParcel(q);
      setParcelResult(res);
    } catch (e) {
      if (e?.response?.status === 404) message.warning(e?.response?.data?.detail || 'No record found');
      else message.error(e?.response?.data?.detail || 'Parcel lookup failed — is the backend running?');
    } finally {
      setParcelLoading(false);
    }
  };

  const deleteKey = async (id) => {
    try {
      await revokeApiKey(id);
      message.success('API key revoked successfully');
    } catch (e) {
      message.error(e?.response?.data?.detail || 'Revoke failed');
    } finally {
      fetchKeys();
    }
  };

  const generateKey = async () => {
    try {
      const keyName = `Govt-LRMS-Gateway-${Date.now().toString().slice(-4)}`;
      const res = await createApiKey(keyName);
      if (res?.api_key) {
        setNewKey({ name: keyName, value: res.api_key });
        fetchKeys();
        return;
      }
      message.error('Key creation returned no key');
    } catch (e) {
      message.error(e?.response?.data?.detail || 'Key generation failed — are you logged in?');
    }
  };

  const postgisOn = Boolean(health?.postgis_connected);
  const dbOnline = health?.database === 'online';

  const items = [
    {
      key: 'systems',
      label: 'PostGIS Cadastral Layer',
      icon: <GlobalOutlined />,
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          {/* POSTGIS CADASTRAL LAYER — active */}
          <Card bordered={false} className="saffron-card" bodyStyle={{ padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                <div style={{ width: 50, height: 50, borderRadius: 14, background: postgisOn ? '#ECFDF5' : '#FFFBEB', border: `1px solid ${postgisOn ? '#A7F3D0' : '#FDE68A'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: postgisOn ? '#10B981' : '#D97706', fontSize: 22 }}>
                  {postgisOn ? <CheckCircleOutlined /> : <EnvironmentOutlined />}
                </div>
                <div>
                  <div style={{ fontWeight: 850, color: '#0F172A', fontSize: 16 }}>PostGIS — Cadastral Boundary Layer</div>
                  <div style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>
                    Spatial vector store for GeoJSON parcel exports • EPSG:4326 • {health?.parcels_indexed ?? 0} parcels indexed.
                  </div>
                </div>
              </div>
              <Space wrap>
                <Tag style={{ borderRadius: 999, background: postgisOn ? '#ECFDF5' : '#FFFBEB', color: postgisOn ? '#047857' : '#D97706', border: `1px solid ${postgisOn ? '#A7F3D0' : '#FDE68A'}`, fontWeight: 800, padding: '4px 12px' }}>
                  {postgisOn ? `PostGIS ${health.postgis_version || ''}`.trim() : (dbOnline ? 'Record-lookup mode (PostGIS extension off)' : 'Backend offline')}
                </Tag>
                <Button onClick={() => setLayerOpen(true)} style={{ borderRadius: 10, background: '#fff', border: '1px solid #CBD5E1', fontWeight: 700, color: '#0F172A' }}>
                  Configure Layer
                </Button>
              </Space>
            </div>

            <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Input
                placeholder="Search survey / khasra no. e.g. 123/4"
                prefix={<SearchOutlined style={{ color: '#94A3B8' }} />}
                value={parcelQuery}
                onChange={(e) => setParcelQuery(e.target.value)}
                onPressEnter={searchParcel}
                style={{ maxWidth: 320, borderRadius: 8 }}
                allowClear
              />
              <Button type="primary" onClick={searchParcel} loading={parcelLoading} style={{ borderRadius: 8, fontWeight: 700 }}>Lookup parcel</Button>
              <Button onClick={fetchIntegrations} icon={<SyncOutlined />} style={{ borderRadius: 8 }}>Refresh</Button>
            </div>

            {parcelLoading && <div style={{ marginTop: 12 }}><Spin tip="Querying cadastral layer…" /></div>}
            {parcelResult?.parcel && (
              <div style={{ marginTop: 12, background: '#F0FDF4', border: '1px solid #A7F3D0', borderRadius: 10, padding: 12, fontFamily: 'JetBrains Mono,monospace', fontSize: 12, color: '#0F172A' }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>parcel: {parcelResult.survey_no} • source: {parcelResult.source}</div>
                <div>village: {parcelResult.parcel.properties.village || '—'} • district: {parcelResult.parcel.properties.district || '—'} • owner: {parcelResult.parcel.properties.owner || '—'} • area: {parcelResult.parcel.properties.area || '—'}</div>
                <div style={{ marginTop: 4, color: '#64748B' }}>geometry: {parcelResult.parcel.geometry ? JSON.stringify(parcelResult.parcel.geometry).slice(0, 120) : 'null (boundary geometry not digitized yet — record attributes only)'}</div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              {parcels.length === 0 ? (
                <Empty description="No parcels indexed yet — upload a record with survey/khasra number to populate this layer" />
              ) : (
                <Table dataSource={parcels.slice(0, 8).map(p => ({ key: String(p.document_id), ...p }))} columns={parcelColumns} pagination={false} size="small" />
              )}
            </div>
          </Card>
        </div>
      )
    },
    {
      key: 'apikeys',
      label: 'API Keys & Developer Portal',
      icon: <KeyOutlined />,
      children: (
        <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <Text style={{ color: '#64748B', fontSize: 13.5 }}>
              Manage API secret keys for GIS systems, mobile inspectors, and partner state portals.
            </Text>
            <Button type="primary" icon={<PlusOutlined />} onClick={generateKey} style={{ borderRadius: 10, fontWeight: 800 }}>
              Generate New API Key
            </Button>
          </div>

          <List
            bordered
            dataSource={apiKeys}
            locale={{ emptyText: 'No API keys yet — generate one to connect external systems' }}
            style={{ borderRadius: 14, borderColor: '#E2E8F0', background: '#fff', overflow: 'hidden' }}
            renderItem={item => (
              <List.Item actions={[
                 <span key="masked" style={{ color: '#94A3B8', fontSize: 12 }}>Secret hidden</span>,
                <Popconfirm key="del" title="Revoke this API key? Access will be immediately cut off." onConfirm={() => deleteKey(item.id)}>
                  <Button type="text" danger icon={<DeleteOutlined />} style={{ borderRadius: 8 }} />
                </Popconfirm>
              ]}>
                <List.Item.Meta
                  avatar={<Avatar style={{ background: 'linear-gradient(135deg,#0A1F44,#14315E)', color: '#fff' }} icon={<KeyOutlined />} />}
                  title={<span style={{ fontWeight: 800, color: '#0F172A' }}>{item.name} <Tag style={{ marginLeft: 8, borderRadius: 999, background: '#EEF2FF', border: '1px solid #C7D2FE', color: '#4F46E5', fontWeight: 750 }}>{item.scope}</Tag></span>}
                  description={
                    <Space direction="vertical" size={4} style={{ marginTop: 4 }}>
                      <span style={{ fontFamily: 'JetBrains Mono,monospace', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '4px 10px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, color: '#0F172A' }}>
                        {item.key}
                      </span>
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>Created: {item.created} • Last used: {item.lastUsed}</span>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        </div>
      )
    }
  ];

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HEADER BANNER */}
      <PageHeader
        eyebrow="System · Integrations"
        title="Integrations & API"
        description="PostGIS spatial store and scoped API keys for GIS systems."
        actions={
          <Tag style={{ borderRadius: 999, background: dbOnline ? '#E6F4EA' : '#F1F5F9', color: dbOnline ? '#0F5C28' : '#475569', border: `1px solid ${dbOnline ? '#B7DFC0' : '#E2E8F0'}`, fontWeight: 700, padding: '5px 12px' }}>
            {dbOnline ? 'Backend live' : 'Backend offline'}
          </Tag>
        }
      />

      <Card bordered={false} className="saffron-card animate-scale-in" bodyStyle={{ padding: 20 }}>
        <Tabs defaultActiveKey="systems" items={items} size="large" />
      </Card>

      <Modal title="Cadastral Layer — connection" open={layerOpen} onCancel={() => setLayerOpen(false)} footer={null}>
        <Space direction="vertical" size={8} style={{ width: '100%', fontSize: 13 }}>
          <div><Text strong>Backend server: </Text><Text code>http://127.0.0.1:8000</Text></div>
          <div><Text strong>Database: </Text>{health?.database || 'unknown'}</div>
          <div><Text strong>PostGIS: </Text>{health?.postgis_version || 'not installed — running in record-lookup mode (attributes only, no geometry)'}</div>
          <div><Text strong>CRS: </Text>EPSG:4326 (WGS84 GeoJSON)</div>
          <div><Text strong>Parcels indexed: </Text>{health?.parcels_indexed ?? parcels.length}</div>
          <div><Text strong>GIS endpoints: </Text></div>
          <div style={{ fontFamily: 'JetBrains Mono,monospace', fontSize: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: 8 }}>
            GET /api/v1/integrations/health<br />
            GET /api/v1/integrations/gis/parcels?limit=50<br />
            GET /api/v1/integrations/gis/parcel?survey_no=123/4
          </div>
          <div style={{ color: '#64748B', fontSize: 12 }}>
            To enable true boundary geometry, run the PostGIS service from docker-compose.yml
            (<Text code>postgis/postgis:15-3.3</Text>) and store polygon GeoJSON per parcel.
            Until then this layer serves digitized record attributes backed by your uploads.
          </div>
        </Space>
      </Modal>
      <Modal
        title="API key created"
        open={Boolean(newKey)}
        onCancel={() => setNewKey(null)}
        footer={<Button type="primary" onClick={() => setNewKey(null)}>I have stored it</Button>}
      >
        <Text type="secondary">This secret is shown once. Store it in a secure password manager or deployment secret.</Text>
        <Input.TextArea value={newKey?.value || ''} readOnly autoSize style={{ marginTop: 14, fontFamily: 'JetBrains Mono,monospace' }} />
        <Button icon={<CopyOutlined />} onClick={async () => { await navigator.clipboard.writeText(newKey?.value || ''); message.success('Secret copied'); }} style={{ marginTop: 10 }}>Copy secret</Button>
      </Modal>
    </div>
  );
}

export default Integrations;
