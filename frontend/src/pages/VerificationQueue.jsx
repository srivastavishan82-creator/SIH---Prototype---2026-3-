import { useState, useEffect } from 'react';
import { Table, Tag, Button, Typography, Card, Input, Space, Segmented, Form, Row, Col, message, Empty, Popconfirm } from 'antd';
import { CheckCircleOutlined, SearchOutlined, EyeOutlined, EditOutlined, FileTextOutlined, AppstoreOutlined, TableOutlined, DeleteOutlined } from '@ant-design/icons';
import { getPendingVerifications, verifyField, deleteDocument, getCurrentUser } from '../api';
import { PageHeader, SectionTitle, ConfidenceTag } from '../components/Page';
import { useNavigate } from 'react-router-dom';
const { Text } = Typography;

const REVIEWER_ROLES = new Set(['admin', 'verifier', 'govt_official']);

function VerificationQueue() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [view, setView] = useState(window.innerWidth < 768 ? 'cards' : 'table');
  const [editOpen, setEditOpen] = useState(false);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isInspector, setIsInspector] = useState(false);

  const fetchPending = async () => {
    setLoading(true);
    try {
      const res = await getPendingVerifications(50);
      if (res?.pending && res.pending.length) {
        const mapped = res.pending.map(p => ({
          key: String(p.field_id),
          field_id: p.field_id,
          document: p.document_name || `Doc #${p.document_id}`,
          type: p.document_type || 'Land Record',
          field: (p.field_name || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          value: p.field_value,
          confidence: Math.round((p.confidence||0)*100),
          status: (p.confidence||0) < 0.6 ? 'Low Confidence' : 'Needs Review',
          district: p.document_type || 'Land Record',
          document_id: p.document_id,
        }));
        setData(mapped);
        if (mapped.length) setActive(mapped[0]);
      } else {
        setData([]);
        setActive(null);
      }
    } catch (e) {
      setData([]);
    }
    setLoading(false);
  };
  useEffect(()=>{ fetchPending(); getCurrentUser().then(u=> setIsInspector(REVIEWER_ROLES.has(u?.role))).catch(()=> setIsInspector(false)); }, []);
  const verify = async (rec) => {
    if (!isInspector) { message.warning('Only Field Inspector (admin/verifier/govt_official) can verify'); return; }
    if (rec.field_id) {
      try { await verifyField(rec.field_id, { verified_value: rec.value }); message.success('Verified and audit-logged'); } catch(e){ message.error('Verify failed: '+(e.response?.data?.detail||e.message)) }
      fetchPending();
    } else {
      setData(data.map(i => i.key === rec.key ? { ...i, status: 'Verified', confidence: 99 } : i));
    }
  };
  const updateActiveValue = (value) => {
    setActive((current) => current ? { ...current, value } : current);
    setData((current) => current.map((item) => item.key === active?.key ? { ...item, value } : item));
  };
  const handleDeleteDoc = async (rec) => {
    if (!rec?.document_id) return;
    try {
      await deleteDocument(rec.document_id);
      message.success(`Document #${rec.document_id} deleted`);
      if (active?.document_id === rec.document_id) setActive(null);
      fetchPending();
    } catch (e) {
      message.error(e?.response?.data?.detail || 'Delete failed');
    }
  };
  const filtered = data.filter(d => {
    if (filter !== 'All' && d.status !== filter) return false;
    if (query && !`${d.document} ${d.field} ${d.value} ${d.type} ${d.district}`.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const columns = [
    { title: 'Document', dataIndex: 'document', key: 'document', width: 190, ellipsis:true, render: (text, rec) => (
        <Space size={10} style={{display:'flex', alignItems:'center', minWidth:0}}>
          <div style={{width:30, height:30, borderRadius:8, background:'#0B57D0', color:'#FFFFFF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><FileTextOutlined style={{fontSize:14}}/></div>
          <div style={{lineHeight:1.25, minWidth:0, flex: 1}}><Text strong style={{color:'#0F172A', fontSize:12.5, display:'block', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{text}</Text><div style={{fontSize:11, color:'#64748B', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{rec.type} • {rec.district}</div></div>
        </Space>
      )},
    { title: 'Flagged Field', dataIndex: 'field', key: 'field', width: 120, ellipsis:true, render:(t)=><Text style={{fontWeight:700, color:'#0F172A', fontSize:12.5}}>{t}</Text>},
    { title: 'Extracted Value', dataIndex: 'value', key: 'value', width: 150, ellipsis:true, render:(text)=><span style={{fontFamily:'JetBrains Mono,monospace', background:'#F8FAFC', border:'1px solid #E2E8F0', padding:'3px 7px', borderRadius:6, fontSize:11, fontWeight:700, color:'#0F172A', display:'inline-block', maxWidth:'100%', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{text}</span>},
    { title: 'Confidence', dataIndex: 'confidence', key: 'confidence', width:90, align:'center', render:(val)=>{
        const c = val<60? '#DC2626' : val<80? '#D97706':'#059669';
        return (<div style={{display:'flex', alignItems:'center', justifyContent:'center'}}><Tag style={{margin:0, borderRadius:999, background: val<60?'#FEF2F2':val<80?'#FFFBEB':'#ECFDF5', border:`1px solid ${val<60?'#FECACA':val<80?'#FDE68A':'#A7F3D0'}`, color:c, fontWeight:800, fontSize:11, fontFamily:'JetBrains Mono,monospace'}}>{val}%</Tag></div>);
      }},
    { title: 'Status', dataIndex: 'status', key: 'status', width:110, align:'center', render:(s)=>{
        if(s==='Verified') return <Tag style={{margin:0, background:'#ECFDF5', color:'#047857', border:'1px solid #A7F3D0', borderRadius:999, fontWeight:700, fontSize:11}}>● Verified</Tag>;
        if(s==='Low Confidence') return <Tag style={{margin:0, background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA', borderRadius:999, fontWeight:700, fontSize:11}}>● Low</Tag>;
        return <Tag style={{margin:0, background:'#FFFBEB', color:'#D97706', border:'1px solid #FDE68A', borderRadius:999, fontWeight:700, fontSize:11}}>● Review</Tag>;
      }},
    { title: '', key: 'action', width:150, align:'center', render:(_,rec)=>(
        <Space size={6} style={{display:'flex', justifyContent:'center'}} onClick={(e)=>e.stopPropagation()}>
          <Button type={rec.status==='Verified'?'default':'primary'} size="small" icon={rec.status==='Verified'?<CheckCircleOutlined/>:<EditOutlined/>} onClick={()=>verify(rec)} disabled={rec.status==='Verified' || !isInspector} title={isInspector? 'Verify field' : 'Only Field Inspector can verify'} style={{borderRadius:6, fontWeight:700, fontSize:11, height:24, padding:'0 8px'}}>{rec.status==='Verified'?'Done':'Verify'}</Button>
          <Button size="small" icon={<EyeOutlined style={{fontSize:12}}/>} onClick={()=>{setActive(rec); setEditOpen(true);}} style={{borderRadius:6, width:24, height:24, padding:0, display:'flex', alignItems:'center', justifyContent:'center'}} />
          <Popconfirm title={`Delete document #${rec.document_id}?`} description="Removes the uploaded file and all its fields." okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }} onConfirm={()=>handleDeleteDoc(rec)}>
            <Button size="small" danger icon={<DeleteOutlined style={{fontSize:12}}/>} disabled={!isInspector} title={isInspector? 'Delete' : 'Only Field Inspector can delete'} style={{borderRadius:6, width:24, height:24, padding:0, display:'flex', alignItems:'center', justifyContent:'center'}} />
          </Popconfirm>
        </Space>
      )},
  ];

  return (
    <div className="animate-fade-in-up verification-section" style={{display:'flex', flexDirection:'column', gap:16}}>
      {/* Header */}
      <PageHeader
        eyebrow="Human-in-the-loop · Below 80% confidence"
        title="Verification queue"
        description={isInspector ? "Approve or correct flagged fields. Every edit is written to the audit trail." : "All users can view the queue. Only Field Inspector (admin/verifier/govt_official) can approve."}
        actions={
          <Tag style={{ margin: 0, borderRadius: 999, background: '#F1F5F9', color: '#0F172A', border: '1px solid #E2E8F0', fontWeight: 700, padding: '5px 12px' }}>{filtered.length} items</Tag>
        }
      />
      {!isInspector && <div style={{background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'10px 14px', color:'#92400E', fontSize:12.5, fontWeight:600}}>View-only mode — verification is restricted to Field Inspector role. Login as verifier/admin to approve.</div>}

      {/* Main Content Split — expanded after KPI removal */}
      <Row gutter={[12,12]} style={{display: 'flex', alignItems: 'stretch', height: 520}}>
        {/* LEFT: Queue Explorer */}
        <Col xs={24} lg={12} style={{display:'flex', flexDirection:'column', height:'100%'}}>
          <Card bordered={false} className="saffron-card" bodyStyle={{padding:16, overflow:'hidden', display:'flex', flexDirection:'column', gap:0}} style={{borderRadius:16, background: '#ffffff', border: '1px solid #E2E8F0', height: '100%'}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14, paddingBottom:12, borderBottom:'1px solid #F1F5F9', flex:'0 0 auto'}}>
              <SectionTitle>Queue</SectionTitle>
              <span style={{fontSize:11, fontWeight:600, color:'#94A3B8', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:999, padding:'2px 8px'}}>{filtered.length} total</span>
            </div>

            <div style={{display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', padding:'10px 12px', background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:10, marginBottom:14}}>
              <Segmented size="small" options={['All','Low Confidence','Needs Review','Verified']} value={filter} onChange={setFilter} style={{height:28, display:'flex', alignItems:'center'}} />
              <Input placeholder="Search queue…" prefix={<SearchOutlined style={{color:'#94A3B8', fontSize:12}} />} value={query} onChange={(e)=>setQuery(e.target.value)} allowClear style={{width:150, borderRadius:8, height:28, fontSize:12, background:'#FFFFFF', marginLeft:'auto'}} size="small" />
              <Segmented size="small" value={view} onChange={setView} options={[{label:'', value:'table', icon:<TableOutlined style={{fontSize:12}}/>},{label:'', value:'cards', icon:<AppstoreOutlined style={{fontSize:12}}/>}]} style={{height:28}} />
            </div>

            <div style={{flex: 1, minHeight: 0, overflow: 'auto', border:'1px solid #E2E8F0', borderRadius:10, background:'#FFFFFF', scrollbarWidth:'thin', scrollbarColor:'#94A3B8 #F1F5F9', display:'flex', flexDirection:'column', scrollbarGutter:'stable'}} className="queue-scroll">
              <style>{`.queue-scroll::-webkit-scrollbar{width:10px;height:10px} .queue-scroll::-webkit-scrollbar-track{background:#F1F5F9;border-radius:999px;margin:4px 0} .queue-scroll::-webkit-scrollbar-thumb{background:#94A3B8;border-radius:999px;border:2px solid #F1F5F9;min-height:40px} .queue-scroll::-webkit-scrollbar-thumb:hover{background:#64748B} .queue-scroll::-webkit-scrollbar-corner{background:#F1F5F9} .queue-scroll .ant-table{flex:0 0 auto;display:flex;flex-direction:column} .queue-scroll .ant-table-container{flex:0 0 auto;display:flex;flex-direction:column} .queue-scroll .ant-table-body{overflow:auto !important;scrollbar-width:thin;scrollbar-gutter:stable;scrollbar-color:#94A3B8 #F1F5F9;max-height:308px} .queue-scroll .ant-table-body::-webkit-scrollbar{width:10px;height:10px} .queue-scroll .ant-table-body::-webkit-scrollbar-track{background:#F1F5F9;border-radius:999px} .queue-scroll .ant-table-body::-webkit-scrollbar-thumb{background:#94A3B8;border-radius:999px;border:2px solid #F1F5F9;min-height:40px} .queue-scroll .ant-table-body::-webkit-scrollbar-thumb:hover{background:#64748B} .queue-scroll .ant-table-body::-webkit-scrollbar-corner{background:#F1F5F9} .queue-scroll .ant-table-body table{margin-bottom:0} .queue-scroll .ant-table-body tr:last-child td{border-bottom:none !important} .queue-scroll .cards-grid{padding-bottom:4px}`}</style>
              {filtered.length === 0 ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <Empty description="No pending verifications — all uploaded fields are verified or none flagged" />
                </div>
              ) : view === 'table' ? (
                <Table dataSource={filtered} columns={columns} pagination={false} scroll={{x:720, y:308}} style={{ background: 'transparent' }} onRow={r=>({onClick:()=>{setActive(r); setEditOpen(true);}})} rowClassName="clickable-row" size="small" tableLayout="fixed" />
              ) : (
                <div style={{display:'grid', gridTemplateColumns:'1fr', gap:10, padding:'10px 10px 10px 10px', alignContent:'start', scrollbarWidth:'thin'}} className="cards-grid">
                  {filtered.map(rec=>{
                    const c = rec.confidence<60? '#DC2626' : rec.confidence<80? '#D97706':'#059669';
                    const isActive = active?.key === rec.key;
                    return (
                      <Card key={rec.key} bordered={false} className="saffron-card mobile-black-card" onClick={()=>{setActive(rec); setEditOpen(true);}} bodyStyle={{padding:12}} style={{borderRadius:10, borderLeft:`3px solid ${c}`, background: isActive ? '#EFF6FF' : '#ffffff', border: isActive ? '1px solid #BFDBFE' : '1px solid #E2E8F0', cursor: 'pointer'}}>
                        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, minWidth:0}}>
                          <div style={{display:'flex', gap:10, alignItems:'center', minWidth:0, flex:1}}>
                            <div style={{width:32, height:32, borderRadius:8, background:'#0B57D0', color:'#FFFFFF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0}}><FileTextOutlined style={{fontSize:13}}/></div>
                            <div style={{minWidth:0, flex:1}}><div style={{fontWeight:800, color:'#0F172A', fontSize:12.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{rec.document}</div><div style={{fontSize:11, color:'#64748B', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{rec.type} • {rec.district}</div></div>
                          </div>
                          <Tag style={{margin:0, borderRadius:999, fontWeight:700, fontSize:11, flexShrink:0, background: rec.status==='Verified'? '#ECFDF5': '#F8FAFC', color:c, border: rec.status==='Verified'?'1px solid #A7F3D0':'1px solid #E2E8F0'}}>{rec.status}</Tag>
                        </div>
                      </Card>
                    );
                  })}
                  <div style={{height:4, flexShrink:0}} />
                </div>
              )}
            </div>
          </Card>
        </Col>

        {/* RIGHT: Field Inspector */}
        <Col xs={24} lg={12} style={{display:'flex', flexDirection:'column', height:'100%'}}>
          <Card bordered={false} className="saffron-card" bodyStyle={{padding:16, overflow:'hidden'}} style={{borderRadius:16, background: '#ffffff', border: '1px solid #E2E8F0', height: '100%'}}>
            <SectionTitle>Inspector</SectionTitle>

            {active ? (
              <div style={{display:'flex', flexDirection:'column', gap:16, flex:1, overflow:'auto', paddingRight: 4, marginTop: 12}}>
                <div style={{background:'#F8FAFC', border:'1px solid #E2E8F0', borderRadius:10, padding:16}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 12}}>
                    <div style={{fontSize:12, color:'#64748B'}}>{active.district} · {active.type}</div>
                    <ConfidenceTag value={active.confidence} />
                  </div>
                  <div style={{fontWeight:800, color:'#0F172A', fontSize: 15}}>{active.field}</div>
                  <div className="mobile-black-card" style={{fontFamily:'JetBrains Mono,monospace', fontSize: 14, background:'#ffffff', border:'1px solid #E2E8F0', padding:'10px 14px', borderRadius:8, fontWeight:700, color:'#0F172A', marginTop: 8}}>{active.value}</div>
                </div>

                <Form layout="vertical">
                  <Form.Item label={<Text style={{color: '#475569', fontWeight: 700}}>Corrected Value</Text>}>
                    <Input value={active.value} onChange={(event) => updateActiveValue(event.target.value)} key={active.key} size="large" disabled={!isInspector} style={{fontFamily:'JetBrains Mono,monospace', borderRadius:8}} />
                  </Form.Item>
                </Form>

                <div style={{marginTop:'auto', display:'flex', gap:8, paddingTop: 16, flexWrap:'wrap'}}>
                  <Button type={active.status==='Verified'?'default':'primary'} icon={<CheckCircleOutlined/>} onClick={()=>verify(active)} disabled={active.status==='Verified' || !isInspector} title={isInspector? '' : 'Only Field Inspector can verify'} style={{flex:1, borderRadius:10, fontWeight:700, minWidth:160}}>{active.status==='Verified'?'Approved': isInspector? 'Approve value' : 'Inspector only'}</Button>
                  <Button onClick={()=>navigate(`/documents/${active.document_id}`)} style={{borderRadius:10, fontWeight:700}}>Open record</Button>
                  <Popconfirm title={`Delete document #${active.document_id}?`} description="Removes the uploaded file and all its fields." okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true }} onConfirm={()=>handleDeleteDoc(active)}>
                    <Button danger icon={<DeleteOutlined />} disabled={!isInspector} style={{borderRadius:10}}>Delete</Button>
                  </Popconfirm>
                </div>
              </div>
            ) : (
              <div style={{display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight: 260, padding:'40px 0', color:'#94A3B8', flex:1}}>
                <EyeOutlined style={{fontSize: 48, marginBottom: 16, opacity: 0.3}} />
                <div style={{fontWeight:700}}>Select a document from the queue to inspect</div>
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
export default VerificationQueue;
