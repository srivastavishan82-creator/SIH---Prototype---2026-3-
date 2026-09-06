import { useState, useEffect } from 'react';
import { Table, Tag, Input, Button, Space, message, Card, Row, Col, Empty, Spin, Popconfirm } from 'antd';
import { DeleteOutlined, DownloadOutlined, LockOutlined, EnvironmentOutlined, AreaChartOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader, StatCard, SectionTitle, StatusTag } from '../components/Page';
import { getDocument, getDocumentSource, downloadVerifiedDocument, verifyField, deleteDocument, getCurrentUser, getGisParcel } from '../api';

function DocumentDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [activeKey, setActiveKey] = useState(null);
  const [zoom, setZoom] = useState(100);
  const [loading, setLoading] = useState(Boolean(id));
  const [notFound, setNotFound] = useState(false);
  const [docMeta, setDocMeta] = useState({ title: 'No document selected', subtitle: '' });
  const [data, setData] = useState([]);
  const [sourceUrl, setSourceUrl] = useState(null);
  const [sourceType, setSourceType] = useState(null);
  const [docFilename, setDocFilename] = useState('');
  const [isInspector, setIsInspector] = useState(false);
  const [parcelGeom, setParcelGeom] = useState(null);
  const [parcelArea, setParcelArea] = useState(null);
  const REVIEWER_ROLES = new Set(['admin','verifier','govt_official']);

  function MiniParcelMap({ geometry }) {
    if (!geometry || geometry.type !== 'Polygon') return <Empty description="No cadastral polygon — digitized attributes only" image={Empty.PRESENTED_IMAGE_SIMPLE} />;
    const ring = geometry.coordinates[0] || [];
    if (ring.length < 3) return null;
    const lons = ring.map(p=>p[0]); const lats = ring.map(p=>p[1]);
    const minLon = Math.min(...lons), maxLon = Math.max(...lons), minLat = Math.min(...lats), maxLat = Math.max(...lats);
    const pad=0.0004; const w=(maxLon-minLon)||0.001, h=(maxLat-minLat)||0.001;
    const vbMinLon=minLon-pad, vbMinLat=minLat-pad, vbW=w+pad*2, vbH=h+pad*2;
    // simple mercator-ish proj: x=lon, y=-lat for SVG
    const pts = ring.map(([lon,lat])=> `${((lon-vbMinLon)/vbW*100).toFixed(2)},${((1-(lat-vbMinLat)/vbH)*100).toFixed(2)}`).join(' ');
    return (
      <svg viewBox="0 0 100 100" style={{width:'100%', height:160, background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12}}>
        <polygon points={pts} fill="rgba(11,87,208,0.18)" stroke="#0B57D0" strokeWidth="0.8" strokeLinejoin="round" />
        {ring.slice(0,1).map(([lon,lat],i)=> <circle key={i} cx={((lon-vbMinLon)/vbW*100).toFixed(2)} cy={((1-(lat-vbMinLat)/vbH)*100).toFixed(2)} r="1.2" fill="#0B57D0" />)}
      </svg>
    );
  }

  useEffect(() => {
    getCurrentUser().then(u=> setIsInspector(REVIEWER_ROLES.has(u?.role))).catch(()=> setIsInspector(false));
  }, []);
  useEffect(() => {
    if (!id) {
      setLoading(false);
      setData([]);
      setDocMeta({ title: 'No document selected', subtitle: '' });
      return;
    }
    setLoading(true);
    setNotFound(false);
    let objectUrl;
    getDocument(id)
      .then((doc) => {
        setDocFilename(doc.filename);
        setDocMeta({
          title: `${doc.filename} (Doc #${doc.id})`,
          subtitle: `${doc.file_type?.toUpperCase() || 'DOCUMENT'} • Language: ${doc.language || '—'} • Status: ${doc.status} • ${doc.fields?.filter(f=>f.is_verified).length || 0}/${doc.fields?.length || 0} verified`
        });
        const mapped = (doc.fields || []).map((f, idx) => ({
          key: String(f.id || idx),
          fieldId: f.id,
          rawName: f.field_name,
          field: f.field_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          value: f.field_value || '',
          confidence: Math.round((f.confidence_score || 0) * 100),
          verified: Boolean(f.is_verified)
        }));
        setData(mapped);
        if (mapped.length > 0) setActiveKey(mapped[0].key);
        setSourceType(doc.file_type);
        const survey = (doc.fields || []).find(f=> ['survey_number','khasra_number'].includes(f.field_name))?.field_value;
        if (survey) {
          getGisParcel(survey).then(r=> { setParcelGeom(r.parcel?.geometry||null); setParcelArea(r.parcel?.properties?.area || mapped.find(m=>m.rawName==='plot_area')?.value || null); }).catch(()=> { setParcelGeom(null); setParcelArea(mapped.find(m=>m.rawName==='plot_area')?.value || null); });
        } else {
          setParcelArea(mapped.find(m=>m.rawName==='plot_area')?.value || null);
          setParcelGeom(null);
        }
        return getDocumentSource(id);
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setSourceUrl(objectUrl);
      })
      .catch((e) => {
        if (e?.response?.status === 404) setNotFound(true);
        else message.error(e?.response?.data?.detail || 'Failed to load document');
      })
      .finally(() => setLoading(false));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  const handleDownload = async () => {
    if (!id) return;
    try {
      const blob = await downloadVerifiedDocument(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = docFilename || `document-${id}.pdf`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      message.success('Download started');
    } catch(e){ message.error(e?.response?.data?.detail || 'Download failed — document may not be verified yet'); }
  };
  const updateValue = async (key, newValue) => {
    if (!isInspector) { message.warning('Only Field Inspector can verify/correct'); return; }
    const item = data.find(i => i.key === key);
    if (item?.fieldId) {
      try {
        await verifyField(item.fieldId, { verified_value: newValue });
      } catch (e) {
        message.error(e?.response?.data?.detail || 'Update failed');
        return;
      }
    }
    setData(data.map(i => i.key === key ? { ...i, value: newValue, verified: true, confidence: 98 } : i));
    message.success('Field updated and verified');
  };

  const markVerified = async (key) => {
    if (!isInspector) { message.warning('Only Field Inspector can verify'); return; }
    const item = data.find(i => i.key === key);
    if (item?.fieldId) {
      try {
        await verifyField(item.fieldId, { verified_value: item.value });
      } catch (e) {
        message.error(e?.response?.data?.detail || 'Verify failed');
        return;
      }
    }
    setData(data.map(i => i.key === key ? { ...i, verified: true, confidence: 98 } : i));
    message.success('Field verified & committed to audit trail');
  };

  const handleDeleteDoc = async () => {
    if (!id) return;
    try {
      await deleteDocument(id);
      message.success(`Document #${id} deleted`);
      navigate('/dashboard');
    } catch (e) {
      message.error(e?.response?.data?.detail || 'Delete failed');
    }
  };

  const verifiedCount = (data || []).filter(d=>d.verified).length;
  const overall = (data && data.length > 0) ? Math.round(data.reduce((a,c)=>a+c.confidence,0)/data.length) : 0;
  const active = (data && data.length > 0) ? (data.find(d=>d.key===activeKey) || data[0]) : null;
  const columns = [
    { title: 'Field', dataIndex: 'field', key: 'field', width:150, render:(t,rec)=><span style={{fontWeight: rec.key===activeKey?800:600, color:'#0F172A', fontSize:13}}>{t}</span> },
    { title: 'Value', dataIndex: 'value', key: 'value', render:(val,rec)=>(
        <Input value={val} disabled={!isInspector} onChange={(e)=>setData(data.map(i=> i.key===rec.key? {...i, value:e.target.value}:i))} onPressEnter={(e)=>updateValue(rec.key, e.target.value)} style={{borderRadius:8, fontFamily:'JetBrains Mono,monospace', background: rec.key===activeKey? '#EFF6FF':'#FFFFFF', color: '#0F172A', borderColor: rec.key===activeKey? '#0F172A': '#E2E8F0'}} />
      )},
    { title: 'Confidence', dataIndex: 'confidence', key: 'confidence', width: 90, align: 'center', render: (val) => { const isLow = val < 80; return <Tag style={{ margin: 0, borderRadius: 999, background: isLow ? '#FEF2F2' : '#ECFDF5', color: isLow ? '#DC2626' : '#047857', border: `1px solid ${isLow ? '#FECACA' : '#A7F3D0'}`, fontWeight: 800, fontFamily: 'JetBrains Mono,monospace' }}>{val}%</Tag>; } },
    { title: '', key: 'action', width: 90, align: 'center', render: (_, rec) => <Button type={rec.verified ? 'default' : 'primary'} size="small" onClick={() => markVerified(rec.key)} disabled={rec.verified || !isInspector} title={!isInspector? 'Only Field Inspector can approve' : ''} style={{ borderRadius: 8, fontWeight: 700, fontSize: 11 }}>{rec.verified ? 'Done' : 'Approve'}</Button> },
  ];

  if (!id) {
    return (
      <div style={{display:'flex', flexDirection:'column', gap:16, alignItems:'center', padding:'60px 20px'}}>
        <Empty description="No document selected — upload a record or pick one from the Verification Queue" />
        <Space>
          <Button type="primary" onClick={()=>navigate('/upload')}>Upload Document</Button>
          <Button onClick={()=>navigate('/verification')}>Open Verification Queue</Button>
        </Space>
      </div>
    );
  }

  if (loading) {
    return <div style={{display:'flex', justifyContent:'center', padding:'60px 0'}}><Spin tip="Loading document…" /></div>;
  }

  if (notFound) {
    return (
      <div style={{display:'flex', flexDirection:'column', gap:16, alignItems:'center', padding:'60px 20px'}}>
        <Empty description={`Document #${id} not found`} />
        <Button onClick={()=>navigate('/upload')}>Upload a Document</Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up verified-section" style={{display:'flex', flexDirection:'column', gap:16}}>
      <PageHeader
        eyebrow="Verified record"
        title={docMeta.title}
        description={docMeta.subtitle}
        actions={
          <>
            <Button icon={<DownloadOutlined />} onClick={handleDownload} style={{ borderRadius: 10, fontWeight: 700 }}>Download</Button>
            <Button onClick={() => navigate('/verification')} style={{ borderRadius: 10, fontWeight: 700 }}>← Queue</Button>
            <Popconfirm title="Delete this document?" description="Removes the file, extracted fields and audit trail permanently." okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }} onConfirm={handleDeleteDoc}>
              <Button danger icon={<DeleteOutlined />} disabled={!isInspector} title={!isInspector? 'Only Field Inspector can delete' : ''} style={{ borderRadius: 10, fontWeight: 700 }}>Delete</Button>
            </Popconfirm>
          </>
        }
      />
      {!isInspector && <div style={{background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 14px', color:'#92400E', fontSize:12.5, fontWeight:600, display:'flex', gap:8, alignItems:'center'}}><LockOutlined /> View-only — verification & correction are restricted to Field Inspector (admin/verifier/govt_official). Download is available to all verified documents.</div>}

      <Row gutter={[12, 12]}>
        <Col xs={12} lg={8}>
          <StatCard label="Overall confidence" value={data.length ? `${overall}%` : '—'} sub={data.length ? (overall >= 85 ? 'High trust' : 'Needs review') : 'No fields'} tone={overall >= 85 ? 'green' : 'amber'} />
        </Col>
        <Col xs={12} lg={8}>
          <StatCard label="Fields verified" value={`${verifiedCount} of ${data.length}`} sub={`${data.length - verifiedCount} pending`} tone={verifiedCount === data.length && data.length > 0 ? 'green' : 'slate'} />
        </Col>
        <Col xs={24} lg={8}>
          <Card bordered={false} style={{borderRadius:16, background: parcelArea? '#E8EFFD':'#F8FAFC', border: `1px solid ${parcelArea? '#B9CFF5':'#E2E8F0'}`, height:'100%'}} bodyStyle={{padding:'14px 16px'}}>
            <div style={{display:'flex', alignItems:'center', gap:8, fontSize:11, fontWeight:800, letterSpacing:'.06em', color:'#0842A0'}}><AreaChartOutlined /> LAND AREA</div>
            <div style={{fontSize:22, fontWeight:900, color:'#0F172A', marginTop:6, fontVariantNumeric:'tabular-nums'}}>{parcelArea || '—'}</div>
            <div style={{fontSize:11, color:'#64748B', marginTop:2}}>{parcelGeom? 'PostGIS polygon • EPSG:4326':'Extracted plot_area (digitized)'}</div>
          </Card>
        </Col>
      </Row>

      {/* Land Area visual — polygon map */}
      <Card bordered={false} className="saffron-card" style={{borderRadius:16, background:'#ffffff', border:'1px solid #E2E8F0'}} bodyStyle={{padding:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8}}>
          <SectionTitle extra={<Tag style={{background: parcelGeom? '#E6F4EA':'#F1F5F9', color: parcelGeom? '#137333':'#64748B', border:`1px solid ${parcelGeom? '#B7DFC0':'#E2E8F0'}`, borderRadius:999, fontWeight:700}}>{parcelGeom? 'Cadastral Boundary':'Attributes only'}</Tag>}>Land Area — Visual</SectionTitle>
          <Space size={6}><Tag icon={<EnvironmentOutlined />} style={{borderRadius:999, background:'#F1F6FF', border:'1px solid #D6E4FB', color:'#0842A0', fontWeight:700}}>EPSG:4326</Tag><Button size="small" icon={<DownloadOutlined />} onClick={handleDownload} style={{borderRadius:8}}>Download verified</Button></Space>
        </div>
        <Row gutter={[12,12]} style={{marginTop:14}}>
          <Col xs={24} lg={14}><MiniParcelMap geometry={parcelGeom} /></Col>
          <Col xs={24} lg={10}>
            <div style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12, padding:14, height:'100%'}}>
              <div style={{fontWeight:800, color:'#0F172A', fontSize:13, display:'flex', gap:6, alignItems:'center'}}><AreaChartOutlined /> Area details</div>
              <div style={{marginTop:10, display:'flex', flexDirection:'column', gap:8, fontSize:12.5}}>
                <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'#64748B'}}>Extracted value</span><b style={{color:'#0F172A', fontFamily:'JetBrains Mono,monospace'}}>{parcelArea || '—'}</b></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'#64748B'}}>Source</span><span style={{fontWeight:700, color:'#0F172A'}}>{parcelGeom? 'PostGIS cadastral_parcels':'OCR plot_area'}</span></div>
                <div style={{display:'flex', justifyContent:'space-between'}}><span style={{color:'#64748B'}}>Verified</span><span style={{fontWeight:700, color: verifiedCount? '#137333':'#B06000'}}>{verifiedCount}/{data.length}</span></div>
                <div style={{marginTop:6, fontSize:11, color:'#64748B', background:'#fff', border:'1px solid #EEF1F6', borderRadius:8, padding:'8px 10px'}}>
                  {parcelGeom? 'Blue polygon = true PostGIS boundary (ST_AsGeoJSON). Area calc uses ST_Area(geom::geography) on backend.' : 'No polygon stored yet — add a GeoJSON Polygon to cadastral_parcels to see the blue boundary. Area shown is OCR value.'}
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      {data.length === 0 ? (
        <Card bordered={false} style={{borderRadius:16, background:'#ffffff', border:'1px solid #E2E8F0'}}>
          <Empty description="This document has no extracted fields" />
        </Card>
      ) : (
      <Row gutter={[12,12]} style={{display: 'flex', alignItems: 'stretch'}}>
        {/* Left Column (Viewer) */}
        <Col xs={24} lg={12}>
          <Card bordered={false} className="saffron-card" style={{borderRadius:16, background:'#ffffff', border: '1px solid #E2E8F0', height: '100%', display: 'flex', flexDirection: 'column'}} bodyStyle={{padding:16, display: 'flex', flexDirection: 'column', flex: 1}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap'}}>
              <SectionTitle>Source document</SectionTitle>
              <Space size={6}>
                <Button size="small" onClick={() => setZoom(z => Math.max(80, z - 10))} style={{ borderRadius: 8 }} aria-label="Zoom out">−</Button>
                <span style={{ fontSize: 12, fontWeight: 700, minWidth: 44, textAlign: 'center', color: '#475569', fontVariantNumeric: 'tabular-nums' }}>{zoom}%</span>
                <Button size="small" onClick={() => setZoom(z => Math.min(140, z + 10))} style={{ borderRadius: 8 }} aria-label="Zoom in">+</Button>
              </Space>
            </div>
             <div style={{marginTop:16, background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:12, padding:12, flex: 1, minHeight: 520, overflow: 'auto', textAlign: 'center'}}>
               {sourceUrl && sourceType === 'pdf' ? <iframe title="Source land record" src={sourceUrl} style={{ width: `${zoom}%`, minHeight: 500, border: 0, borderRadius: 8, background: '#fff' }} /> : null}
               {sourceUrl && sourceType !== 'pdf' ? <img src={sourceUrl} alt="Uploaded land record" style={{ width: `${zoom}%`, height: 'auto', borderRadius: 8, boxShadow: '0 4px 18px rgba(15,31,56,.12)' }} /> : null}
               {!sourceUrl ? <Empty description="Source preview unavailable" /> : null}
             </div>
          </Card>
        </Col>

        {/* Right Column (Inspector) */}
        <Col xs={24} lg={12}>
          <Card bordered={false} className="saffron-card" style={{borderRadius:16, background: '#ffffff', border: '1px solid #E2E8F0', height: '100%'}} bodyStyle={{padding:16}}>
            {active ? (
            <>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap'}}>
              <SectionTitle>Inspector</SectionTitle>
              <StatusTag status={active.verified ? 'Verified' : 'Needs review'} />
            </div>
            <div style={{marginTop: 6, fontSize:12, color:'#64748B'}}>Editing <span style={{fontWeight: 700, color: '#0F172A'}}>{active.field}</span></div>

            <Table dataSource={data} columns={columns} pagination={false} size="small" style={{marginTop:16, background: '#ffffff'}} rowClassName={r=> r.key===activeKey?'active-row-highlight':''} onRow={r=>({onClick:()=>setActiveKey(r.key)})} scroll={{y: 300}} />

            <div style={{marginTop:16, display:'flex', gap:12}}>
               <Button type="primary" onClick={() => active && markVerified(active.key)} disabled={!isInspector} title={!isInspector? 'Only Field Inspector can approve' : ''} style={{flex:1, borderRadius:10, fontWeight:700}} size="large">{isInspector? 'Approve field' : 'Inspector only'}</Button>
               <Button icon={<DownloadOutlined />} onClick={handleDownload} style={{borderRadius:10, fontWeight:700}}>Download doc</Button>
            </div>
            <div style={{marginTop:10, textAlign:'center', fontSize:11, color:'#64748B'}}>{isInspector? 'Press Enter to save · every edit is audit-logged' : 'Download available to all users for verified documents'}</div>
            </>
            ) : (
              <Empty description="Select a field to inspect" />
            )}
          </Card>
        </Col>
      </Row>
      )}
    </div>
  );
}
export default DocumentDetails;
