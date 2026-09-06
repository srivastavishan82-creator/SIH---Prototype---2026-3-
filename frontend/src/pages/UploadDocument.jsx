import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Button, message, Card, Typography, Select, Form, Space, Tag, Row, Col, Empty, Spin } from 'antd';
import { FileImageOutlined, FilePdfOutlined, GlobalOutlined, ClockCircleOutlined, CloudUploadOutlined, AimOutlined, AuditOutlined } from '@ant-design/icons';
import { uploadDocument, getAnalytics, getIntegrationsHealth } from '../api';
import { PageHeader, StatCard, SectionTitle } from '../components/Page';
const { Dragger } = Upload;
const { Text } = Typography;

function UploadDocument() {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [docType, setDocType] = useState('register');
  const [language, setLanguage] = useState('hi');
  const [result, setResult] = useState(null);
  const [liveStats, setLiveStats] = useState({ total: 0, verified: 0, pending: 0, accuracy: 0 });
  const [engineStatus, setEngineStatus] = useState(null);

  useEffect(() => {
    getAnalytics()
      .then((res) => {
        if (res?.documents) {
          setLiveStats({
            total: res.documents.total || 0,
            verified: res.fields?.verified || 0,
            pending: res.fields?.low_confidence || 0,
            accuracy: res.accuracy?.average_confidence ? Number((res.accuracy.average_confidence * 100).toFixed(1)) : 0,
          });
        }
      })
      .catch(() => {});
    getIntegrationsHealth()
      .then(setEngineStatus)
      .catch(() => setEngineStatus(null));
  }, [result]);

  const handleRealUpload = async (file) => {
    setUploading(true); setProgress(10); setCurrentStep(0); setResult(null);
    try {
      setProgress(28); setCurrentStep(1);
      const res = await uploadDocument(file, language, docType, (e) => {
        if (e.total) setProgress(Math.round((e.loaded / e.total) * 60) + 10);
      });
      setProgress(58); setCurrentStep(2);
      await new Promise(r=>setTimeout(r, 400));
      setProgress(86); setCurrentStep(3);
      await new Promise(r=>setTimeout(r, 300));
      setProgress(100); setCurrentStep(4);
      setResult(res);
      const count = res.extracted_fields?.length || 0;
      const low = res.needs_verification?.length || 0;
      message.success(`Document ingested — ${count} fields extracted${low ? `, ${low} need review` : ''} (${res.ocr_engine})`);
      setTimeout(() => setUploading(false), 1400);
    } catch (err) {
      const msg = err?.response?.data?.detail || err.message || 'Upload failed - is backend running on :8000?';
      message.error(msg);
      setUploading(false); setProgress(0);
    }
  };

  const uploadProps = { name: 'file', multiple: false, accept: '.pdf,.jpg,.jpeg,.png', showUploadList: false, customRequest: ({file}) => handleRealUpload(file), beforeUpload: (file) => { const isLt10M = file.size / 1024 / 1024 < 10; if (!isLt10M) message.error('File must be smaller than 10MB'); return isLt10M || Upload.LIST_IGNORE; } };
  const steps = [{ title: 'Upload', desc:'checksum' }, { title: 'OCR Extract', desc:'engine' }, { title: 'Validate', desc:'rules' }, { title: 'Confidence Gate', desc:'<80% → queue' }];

  const engines = engineStatus?.ocr_engines;
  const engineLabel = engines
    ? [engines.gemini && 'Gemini Vision', engines.paddleocr && 'PaddleOCR', engines.pypdf && 'PDF text'].filter(Boolean).join(' • ') || 'None configured'
    : 'Checking…';

  return (
    <div className="animate-fade-in-up intake-section" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        eyebrow={`Intake · ${engineLabel}`}
        title="Document intake"
        description="Choose the document type and language, then drop a file. Extraction runs live and low-confidence fields go to review."
        actions={
          <Tag style={{ margin: 0, borderRadius: 999, background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#0F172A', fontWeight: 700, padding: '5px 12px' }}>DB: {engineStatus?.database || '…'}</Tag>
        }
      >
        <div style={{ display: 'flex', gap: 18, marginTop: 16, flexWrap: 'wrap' }}>
          {steps.map((s, i) => {
            const done = uploading || result ? currentStep > i : false;
            const activeStep = uploading && currentStep === i;
            return (
              <div key={s.title} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: done ? '#137333' : activeStep ? '#0B57D0' : '#CBD5E1', display: 'inline-block', boxShadow: activeStep ? '0 0 0 4px rgba(11,87,208,.15)' : 'none' }} />
                <span style={{ fontSize: 12.5, fontWeight: 700, color: done || activeStep ? '#0F172A' : '#94A3B8' }}>{s.title}</span>
              </div>
            );
          })}
        </div>
      </PageHeader>

      {/* Live KPIs from backend */}
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}><StatCard label="Documents ingested" value={liveStats.total} sub="Total in system" tone="slate" /></Col>
        <Col xs={12} lg={6}><StatCard label="Fields verified" value={liveStats.verified} sub="Human verified" tone="green" /></Col>
        <Col xs={12} lg={6}><StatCard label="Pending review" value={liveStats.pending} sub="Below 80% confidence" tone="amber" /></Col>
        <Col xs={12} lg={6}><StatCard label="Avg. confidence" value={liveStats.accuracy ? `${liveStats.accuracy}%` : '—'} sub="Extraction mean" tone="blue" /></Col>
      </Row>

      <Row gutter={[12,12]} style={{display: 'flex', alignItems: 'stretch'}}>
        {/* LEFT: Intake */}
        <Col xs={24} lg={12}>
          <Card bordered={false} className="saffron-card" bodyStyle={{ padding: 16 }} style={{borderRadius:16, background: '#ffffff', border: '1px solid #E2E8F0', height: '100%'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:8}}>
              <SectionTitle>Configure &amp; upload</SectionTitle>
              <Tag style={{margin:0, background:'#F1F5F9', border:'1px solid #E2E8F0', color:'#0F172A', borderRadius:999, fontWeight:700}}><GlobalOutlined /> Hindi / English</Tag>
            </div>
            <Form layout="vertical" style={{marginBottom:8}}>
              <div className="intake-form-grid" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12}}>
                <Form.Item label={<Text strong style={{color:'#475569', fontSize:11, letterSpacing:'0.06em'}}>DOCUMENT TYPE</Text>} style={{marginBottom:10}}>
                  <Select value={docType} onChange={setDocType} size="large">
                    <Select.Option value="register">Khatauni Register</Select.Option>
                    <Select.Option value="map">Bhu-Naksha Map</Select.Option>
                    <Select.Option value="registry">Sale Deed PDF</Select.Option>
                    <Select.Option value="mutation">Mutation Record</Select.Option>
                  </Select>
                </Form.Item>
                <Form.Item label={<Text strong style={{color:'#475569', fontSize:11, letterSpacing:'0.06em'}}>SCRIPT</Text>} style={{marginBottom:10}}>
                  <Select value={language} onChange={setLanguage} size="large">
                    <Select.Option value="hi">Hindi — Devanagari</Select.Option>
                    <Select.Option value="en">English — Latin</Select.Option>
                  </Select>
                </Form.Item>
              </div>
            </Form>

            <Dragger {...uploadProps} disabled={uploading} style={{padding:18, background:'#F8FAFC', border:'1.5px dashed #CBD5E1', borderRadius:14}}>
              <p style={{marginBottom:8}}><span style={{width:56, height:56, borderRadius:999, background:'#0B57D0', display:'inline-flex', alignItems:'center', justifyContent:'center', color:'#FFFFFF', fontSize:26, boxShadow:'0 8px 20px rgba(11, 87, 208, 0.22)'}}><CloudUploadOutlined /></span></p>
              <p style={{fontSize:15, fontWeight:800, color:'#0F172A', margin:0}}>Drop your file here or <span style={{color:'#0B57D0', textDecoration:'underline'}}>browse</span></p>
              <p style={{color:'#475569', fontSize:12.5, marginTop:4}}>PDF / JPG / PNG • 10MB max • Text PDFs work out of the box; scans need Gemini API key</p>
              <Space style={{marginTop:10}} wrap>
                <Tag style={{borderRadius:999, background:'#FEF2F2', color:'#DC2626', border:'1px solid #FECACA', fontWeight:700}}><FilePdfOutlined/> PDF</Tag>
                <Tag style={{borderRadius:999, background:'#EEF2FF', border:'1px solid #C7D2FE', color:'#4F46E5', fontWeight:700}}><FileImageOutlined/> Image</Tag>
                <Tag style={{borderRadius:999, background:'#F1F5F9', border:'1px solid #E2E8F0', color:'#475569', fontWeight:700}}><ClockCircleOutlined/> Batch 50</Tag>
              </Space>
            </Dragger>

            <div style={{marginTop:10, background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:10, padding:'8px 12px', fontSize:12, color:'#92400E', display:'flex', gap:8}}><AimOutlined/> Tip: Flat, deskewed scans extract more reliably.</div>
          </Card>
        </Col>

        {/* RIGHT: Live terminal */}
        <Col xs={24} lg={12}>
          <Card bordered={false} className="saffron-card" bodyStyle={{padding:16, display:'flex', flexDirection:'column'}} style={{borderRadius:16, background: '#ffffff', border: '1px solid #E2E8F0', height: '100%'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', flex:'0 0 auto'}}>
              <SectionTitle>Extraction</SectionTitle>
              <Tag style={{margin:0, background: uploading ? '#E8EFFD' : '#F1F5F9', color: uploading ? '#0842A0' : '#64748B', border: uploading ? '1px solid #B9CFF5' : '1px solid #E2E8F0', borderRadius:999, fontWeight:700, fontSize:11}}>{uploading ? 'Running' : 'Idle'}</Tag>
            </div>
            {!uploading && !result ? (
              <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:12, flex:1, minHeight:0}}>
                <div style={{background:'#0A1F44', color:'#c2c2c2', borderRadius:12, padding:14, fontFamily:'JetBrains Mono,monospace', fontSize:11, lineHeight:1.7, border:'1px solid #1E293B'}}>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, paddingBottom:8, borderBottom:'1px solid #1E293B'}}>
                    <span style={{color:'#8FB4F5', fontWeight:700}}>bhoomi-ocr · intake monitor</span>
                  </div>
                  <div>engines <span style={{color:'#8FB4F5'}}>{engineLabel}</span></div>
                  <div>database <span style={{color:'#8FB4F5'}}>{engineStatus?.database || '…'}</span></div>
                  <div style={{marginTop:8, paddingTop:8, borderTop:'1px dashed #1E293B', color:'#94A3B8'}}>Waiting for a file — drop a PDF or image to start</div>
                  <div style={{color:'#6b6b6b', fontSize:10, marginTop:4}}>Fields below 80% confidence go to the review queue</div>
                </div>
                <Empty description="No upload yet — extracted fields will appear here" />
              </div>
            ) : (
              <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:10, flex:1, minHeight:0}}>
                <div style={{fontFamily:'JetBrains Mono, monospace', fontSize:11, color: progress===100 ? '#059669' : '#854D0E', fontWeight:800, display:'flex', alignItems:'center', gap:8, background: progress===100 ? '#ECFDF5' : '#FFFBEB', border:`1px solid ${progress===100 ? '#A7F3D0' : '#FDE68A'}`, borderRadius:8, padding:'6px 10px'}}>
                  <span style={{width:8, height:8, borderRadius:999, background: progress===100 ? '#10B981' : '#0B57D0', display:'inline-block', flexShrink:0}}/>
                  {progress === 100 ? 'Complete · 100%' : `Processing · ${progress}%`} <span style={{marginLeft:'auto', fontWeight:700, fontSize:10}}>{steps[currentStep]?.title || 'Finalizing'}</span>
                </div>
                {uploading && !result && (
                  <div style={{padding:'24px 0', display:'flex', justifyContent:'center'}}><Spin tip="Extracting fields…" /></div>
                )}
                <div style={{background:'#FFFFFF', border:'1px solid #E2E8F0', borderRadius:10, padding:12, flex:1, minHeight:0, overflow:'auto'}}>
                  <div style={{fontSize:11, fontWeight:800, color:'#0F172A', letterSpacing:'0.06em', marginBottom:8, display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <span>Extracted fields {result?.ocr_engine ? `· ${result.ocr_engine}` : ''}</span>
                    <Tag style={{margin:0, fontSize:10, borderRadius:999, background: progress===100 ? '#ECFDF5' : '#F1F5F9', color: progress===100 ? '#047857' : '#64748B', border: progress===100 ? '1px solid #A7F3D0' : '1px solid #E2E8F0'}}>{result ? `${result.extracted_fields.length} fields` : 'extracting'}</Tag>
                  </div>
                  {!result ? (
                    <Empty description="Extracting…" />
                  ) : result.extracted_fields.length === 0 ? (
                    <Empty description="No fields extracted" />
                  ) : result.extracted_fields.map(r=>{
                    const pct = Math.round((r.confidence_score||0)*100);
                    return (
                    <div key={r.field_name} style={{display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 8px', borderRadius:8, background: pct>=80 ? '#F8FAFC' : '#FFF7ED', border:'1px solid #E2E8F0', marginBottom:6}}>
                      <div><span style={{fontSize:11, fontWeight:700, color:'#64748B'}}>{r.field_name}</span><span style={{fontSize:12, fontWeight:800, color:'#0F172A', marginLeft:8, fontFamily:'JetBrains Mono,monospace'}}>{r.field_value}</span></div>
                      <span style={{fontSize:10, fontWeight:800, color: pct>=90 ? '#047857' : pct>=80 ? '#854D0E' : '#DC2626', background: pct>=90 ? '#ECFDF5' : pct>=80 ? '#FFFBEB' : '#FEF2F2', border:`1px solid ${pct>=90 ? '#A7F3D0' : pct>=80 ? '#FDE68A' : '#FECACA'}`, padding:'2px 6px', borderRadius:999}}>{pct}%</span>
                    </div>
                  )})}
                  {result && <div style={{fontSize:10, color:'#94A3B8', textAlign:'center', marginTop:6}}>{`${result.needs_verification.length} need review (<80%) — routed to Verification Queue`}</div>}
                </div>

                {result && (
                  <div style={{marginTop:12, padding:14, borderRadius:12, background:'#F6FAF7', border:'1px solid #B7DFC0', display:'flex', flexDirection:'column', gap:8}}>
                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', gap:8, flexWrap:'wrap'}}>
                      <span style={{fontWeight:800, color:'#0F5C28', fontSize:13}}>Extraction complete</span>
                      <Tag style={{margin:0, fontWeight:700, borderRadius:999, background: result.needs_verification?.length ? '#FEF3E6' : '#E6F4EA', color: result.needs_verification?.length ? '#7A3F00' : '#0F5C28', border: `1px solid ${result.needs_verification?.length ? '#F0D3AC' : '#B7DFC0'}`}}>
                        {result.needs_verification?.length ? `${result.needs_verification.length} flagged for review` : 'All fields verified'}
                      </Tag>
                    </div>
                    <div style={{fontSize:12.5, color:'#334155', lineHeight:1.55}}>
                      {result.needs_verification?.length
                        ? `${result.needs_verification.length} fields are below 80% confidence and waiting in the review queue.`
                        : 'Every field passed high-confidence validation (> 80%).'}
                    </div>
                    <div style={{display:'flex', gap:8, marginTop:4, flexWrap:'wrap'}}>
                      <Button
                        type="primary"
                        icon={<AuditOutlined />}
                        onClick={() => navigate('/verification')}
                        style={{flex:1, minWidth:200, fontWeight:700, borderRadius:10, height:38}}
                      >
                        Open review queue ({result.needs_verification?.length || 0})
                      </Button>
                      <Button
                        onClick={() => navigate(result.document?.id ? `/documents/${result.document.id}` : '/documents')}
                        style={{fontWeight:700, borderRadius:10, height:38}}
                      >
                        Inspect record
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
export default UploadDocument;
