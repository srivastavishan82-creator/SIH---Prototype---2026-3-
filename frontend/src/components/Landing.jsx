import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from 'framer-motion';
import {
  CloudUploadOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  UserSwitchOutlined,
  DeploymentUnitOutlined,
  FileTextOutlined,
  AppstoreOutlined,
  DatabaseOutlined,
  DashboardOutlined,
  TeamOutlined,
  ApiOutlined,
  ArrowRightOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ThunderboltOutlined,
  GlobalOutlined,
  AimOutlined,
  RocketOutlined,
  SlidersOutlined,
  BarChartOutlined,
  AuditOutlined
} from '@ant-design/icons';
import { Reveal, Stagger, Item, Counter, GrowBar, DrawLine, EASE } from './motion.jsx';

const LANGS = [
  ['हिन्दी', 'Hindi'], ['বাংলা', 'Bengali'], ['मराठी', 'Marathi'], ['தமிழ்', 'Tamil'],
  ['తెలుగు', 'Telugu'], ['ಕನ್ನಡ', 'Kannada'], ['മലയാളം', 'Malayalam'], ['<ctrl42>ગુજરાતી', 'Gujarati'],
  ['ਪੰਜਾਬੀ', 'Punjabi'], ['ଓଡ଼ିଆ', 'Odia'], ['English', 'English'],
];

const FEATURES = [
  { icon: <FileTextOutlined />, title: 'Indic-first OCR', desc: 'PaddleOCR models decode faded ink, torn edges, and handwritten regional scripts across ancient revenue registers.' },
  { icon: <AppstoreOutlined />, title: 'Layout Intelligence', desc: 'Deep layout segmentation reconstructs complex land forms, khasra tables, and key-value pairs with exact spatial alignment.' },
  { icon: <DatabaseOutlined />, title: 'Structured Extraction', desc: 'Owner names, survey numbers, plot areas, and mutation history normalized into structured, queryable JSON schemas.' },
  { icon: <DashboardOutlined />, title: 'Confidence Scoring', desc: 'Every single field carries a transparent AI confidence score so reviewers instantly know which records need human review.' },
  { icon: <TeamOutlined />, title: 'Human-in-the-loop', desc: 'Low-confidence extractions route to authorized revenue reviewers with a persistent audit trail of all edits.' },
  { icon: <ApiOutlined />, title: 'Integration-ready APIs', desc: 'Authenticated APIs prepare verified records for LRMS gateways and expose parcel attributes to GIS clients.' },
];

const STEPS = [
  { icon: <CloudUploadOutlined />, step: '01', t: 'Intake & Ingest', d: 'Upload PDF, PNG, and JPEG land records with configurable OCR language support up to 10MB.' },
  { icon: <RobotOutlined />, step: '02', t: 'Neural Extraction', d: 'PaddleOCR + Indic NLP models extract handwriting, survey plot numbers and boundary coordinates.' },
  { icon: <SafetyCertificateOutlined />, step: '03', t: 'Rule Validation', d: 'Automated validation engines catch format mismatches, duplicate khasras and area discrepancies.' },
  { icon: <UserSwitchOutlined />, step: '04', t: 'Human Audit Gate', d: 'Uncertain extractions route to revenue officers with 1-click accept or side-by-side editing.' },
  { icon: <DeploymentUnitOutlined />, step: '05', t: 'Export & Integration', d: 'Stage verified records for LRMS export and expose digitized parcel attributes through authenticated APIs.' },
];

const SAMPLE_DOCS = [
  {
    id: 'up_khatauni',
    title: 'UP Khatauni Register (Hindi)',
    file: 'khasra_register_2026.pdf',
    fields: [
      { label: 'Landowner Name', value: 'राजेश कुमार शर्मा', conf: 96 },
      { label: 'Survey / Khasra No.', value: '45/2B · Khasra 123', conf: 98 },
      { label: 'Plot Area (Hectares)', value: '2.4500 Hectares', conf: 92 },
      { label: 'Village & Tehsil', value: 'रामपुर · सदर (Agra)', conf: 94 },
    ]
  },
  {
    id: 'mh_712',
    title: 'Maharashtra 7/12 (Marathi)',
    file: 'satbara_extract_pune.pdf',
    fields: [
      { label: 'Khatedar Name', value: 'सुनील बाळकृष्ण जोशी', conf: 97 },
      { label: 'Gat / Survey Number', value: 'गट क्र. 88/1अ', conf: 95 },
      { label: 'Pot Kharaba Area', value: '1.2000 Hectares', conf: 91 },
      { label: 'Village & Taluka', value: 'हवेली · पुणे (Pune)', conf: 96 },
    ]
  },
  {
    id: 'tn_patta',
    title: 'Tamil Nadu Patta (Tamil)',
    file: 'patta_chitta_chennai.pdf',
    fields: [
      { label: 'Pattadhar Name', value: 'முருகன் கந்தசாமி', conf: 94 },
      { label: 'Patta Number', value: 'பட்டா எண் 542', conf: 98 },
      { label: 'Survey & Subdiv', value: 'புல எண் 104/3', conf: 93 },
      { label: 'District & Taluk', value: 'தாம்பரம் · செங்கல்பட்டு', conf: 95 },
    ]
  }
];

const DISTRICT_BARS = [
  { name: 'Agra', h: 88, count: 120, state: 'UP West' },
  { name: 'Lucknow', h: 72, count: 98, state: 'UP Central' },
  { name: 'Varanasi', h: 80, count: 76, state: 'UP East' },
  { name: 'Kanpur', h: 58, count: 65, state: 'UP Central' },
  { name: 'Prayagraj', h: 66, count: 54, state: 'UP East' },
  { name: 'Meerut', h: 50, count: 42, state: 'UP West' },
];

const PALETTE = {
  id: 'stitch-gov',
  name: 'Stitch Gov Blue',
  gradient: 'linear-gradient(135deg, #0B57D0 0%, #0842A0 100%)',
  primary: '#0B57D0',
  primaryStrong: '#0842A0',
  primaryRgb: '11,87,208',
  accent: '#ffffff',
  accentRgb: '255,255,255',
  accentSoft: '#ffffff',
  tagBg: '#0A1F44',
  tagBorder: 'rgba(255,255,255,0.22)',
  tagColor: '#D3E3FD',
  chartActive: '#0B57D0',
  shadow: '0 8px 24px rgba(11,87,208,0.15)',
};

function OcrDemo({ P = PALETTE }) {
  const [docIndex, setDocIndex] = useState(0);
  const activeDoc = SAMPLE_DOCS[docIndex];
  const CYCLE = activeDoc.fields.length + 3;
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setStep((s) => (s + 1) % CYCLE), 650);
    return () => clearInterval(timer);
  }, [docIndex, CYCLE]);

  const visible = Math.max(0, Math.min(step, activeDoc.fields.length));
  const done = step >= activeDoc.fields.length;

  return (
    <div className="ocr-card" style={{ boxShadow: `0 25px 60px rgba(0,0,0,0.6), 0 0 35px rgba(${P.primaryRgb},0.18)` }}>
      {/* Header with Switcher Tabs */}
      <div className="ocr-head" style={{ padding: '12px 18px', background: 'rgba(15,23,42,0.95)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="ocr-dots"><span /><span /><span /></div>
          <div style={{ display: 'flex', gap: 6 }}>
            {SAMPLE_DOCS.map((doc, idx) => (
              <button
                key={doc.id}
                onClick={() => { setDocIndex(idx); setStep(0); }}
                style={{
                  background: docIndex === idx ? `rgba(${P.primaryRgb},0.25)` : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${docIndex === idx ? P.primary : 'rgba(255,255,255,0.1)'}`,
                  color: docIndex === idx ? P.primaryStrong : '#94A3B8',
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {doc.title.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
        <div className={`ocr-status${done ? ' done-badge' : ''}`} style={{ fontSize: 11.5 }}>
          {!done && <SyncOutlined spin style={{ color: P.primaryStrong }} />}
          {done && <span style={{ color: P.accent, fontWeight: 900 }}>✓ Verified</span>}
          {step === 0 ? 'Scanning paper…' : !done ? 'Extracting Indic text…' : '100% Extracted'}
        </div>
      </div>

      {/* Interactive Scan Body */}
      <div className="scan-body" style={{ minHeight: 250, padding: 20 }}>
        {!done && <div className="scan-laser" />}
        <div className="doc-lines" style={{ marginBottom: 16 }}>
          <i /><i /><i /><i />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activeDoc.fields.slice(0, visible).map((f) => (
            <motion.div
              key={f.label}
              className="field-row"
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.35, ease: EASE }}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '10px 14px',
                borderRadius: 10
              }}
            >
              <span className="field-label" style={{ color: '#94A3B8', fontSize: 12 }}>{f.label}</span>
              <span className="field-value" style={{ color: '#ffffff', fontWeight: 800, fontSize: 14 }}>{f.value}</span>
              <span className="field-conf" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="conf-bar" style={{ width: 60, height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 99 }}>
                  <motion.b
                    initial={{ width: 0 }}
                    animate={{ width: `${f.conf}%` }}
                    transition={{ duration: 0.5, ease: EASE }}
                    style={{ background: P.gradient }}
                  />
                </span>
                <span className="conf-num" style={{ color: P.accent, fontWeight: 800, fontSize: 12, fontFamily: 'monospace' }}>
                  {f.conf}%
                </span>
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Hero({ onLaunch, P = PALETTE }) {
  const stageRef = useRef(null);
  const rotX = useSpring(0, { stiffness: 110, damping: 16 });
  const rotY = useSpring(0, { stiffness: 110, damping: 16 });
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 700], [0, 100]);
  const heroFade = useTransform(scrollY, [0, 550], [1, 0]);

  return (
    <section className="hero" style={{ position: 'relative', overflow: 'hidden', transform: 'translate3d(0,0,0)', willChange: 'transform' }}>
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.35,
          pointerEvents: 'none',
          zIndex: 0,
          transform: 'translate3d(0,0,0)',
          willChange: 'opacity',
          backfaceVisibility: 'hidden'
        }}
      >
        <source src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4" type="video/mp4" />
      </video>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(9,13,22,0.7) 0%, #090d16 95%)', pointerEvents: 'none', zIndex: 1 }} />
      <div className="orb orb-violet" style={{ background: P.primary, opacity: 0.12, zIndex: 1 }} />
      <div className="orb orb-cyan" style={{ background: P.accent, opacity: 0.08, zIndex: 1 }} />
      <div className="orb orb-mint" style={{ background: P.primaryStrong, opacity: 0.08, zIndex: 1 }} />
      <div className="grid-bg" style={{ opacity: 0.4, zIndex: 1 }} />

      <motion.div style={{ y: heroY, opacity: heroFade, zIndex: 2, position: 'relative', willChange: 'transform, opacity' }} className="hero-core">
        <Reveal y={18}>
          <span className="chip" style={{ background: `rgba(${P.primaryRgb},0.15)`, borderColor: `rgba(${P.primaryRgb},0.35)`, color: P.primaryStrong }}>
            <span className="dot" style={{ background: P.primary, boxShadow: `0 0 10px ${P.primary}` }} /> 
            Smart India Hackathon 2026 • Land Record Digitization OS
          </span>
        </Reveal>

        <motion.h1 
          className="hero-title" 
          initial={{ opacity: 0, y: 30 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.85, delay: 0.1, ease: EASE }}
          style={{ fontSize: 'clamp(48px, 8vw, 86px)', lineHeight: 0.95, textTransform: 'uppercase', letterSpacing: '-0.04em' }}
        >
          <div style={{ display: 'block' }}>Scan.</div>
          <div style={{ display: 'block' }}>Digitize.</div>
          <div style={{ display: 'block' }}><span className="grad-text" style={{ fontStyle: 'italic' }}>Verify.</span></div>
        </motion.h1>

        <motion.p 
          className="hero-sub" 
          initial={{ opacity: 0, y: 22 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.85, delay: 0.25, ease: EASE }}
        >
          Bhoomi AI transforms centuries of handwritten registers, torn cadastral maps, and legacy PDFs into verified digital records with Indic OCR, confidence scoring, and human-in-the-loop audit verification.
        </motion.p>

        <motion.div 
          className="hero-ctas" 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ duration: 0.85, delay: 0.38, ease: EASE }}
        >
          <button className="btn-primary-light" onClick={onLaunch} style={{ height: 48, fontSize: 15, paddingInline: 28 }}>
            Launch Console <ArrowRightOutlined />
          </button>
          <a className="btn-ghost-light" href="#analytics" style={{ height: 48, fontSize: 15, paddingInline: 24 }}>
            <SlidersOutlined /> Interactive Showcase
          </a>
        </motion.div>

        {/* 3D Interactive OCR Demonstration */}
        <motion.div
          className="hero-stage"
          ref={stageRef}
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.0, delay: 0.5, ease: EASE }}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            rotY.set(((e.clientX - r.left) / r.width - 0.5) * 8);
            rotX.set(-((e.clientY - r.top) / r.height - 0.5) * 8);
          }}
          onMouseLeave={() => { rotX.set(0); rotY.set(0); }}
          style={{ perspective: 1400 }}
        >
          <motion.div style={{ rotateX: rotX, rotateY: rotY, transformStyle: 'preserve-3d' }}>
            <OcrDemo P={P} />
          </motion.div>

          <div className="float-chip fc-1" style={{ border: `1px solid rgba(${P.accentRgb},0.3)`, background: 'rgba(15,23,42,0.92)' }}>
            <span className="fc-icon" style={{ background: `rgba(${P.accentRgb},0.2)`, color: P.accent, fontWeight: 900 }}>✓</span>
            Field accuracy up to <b style={{ color: P.accent }}>&nbsp;98.4%</b>
          </div>
          <div className="float-chip fc-2" style={{ border: `1px solid rgba(${P.primaryRgb},0.3)`, background: 'rgba(15,23,42,0.92)' }}>
            <span className="fc-icon" style={{ background: `rgba(${P.primaryRgb},0.2)`, color: P.primaryStrong }}>⚡</span>
            Processed in <b style={{ color: P.primaryStrong }}>&nbsp;under 30 sec</b>
          </div>
        </motion.div>

        {/* Hero Quick Statistics */}
        <Stagger className="hero-stats" gap={0.1}>
          {[
            { num: <Counter to={2} />, label: 'Configured OCR languages' },
            { num: <Counter to={98.4} decimals={1} suffix="%" />, label: 'Peak OCR field accuracy' },
            { num: <Counter to={30} prefix="<" suffix="s" />, label: 'Average extraction time' },
            { num: <Counter to={100} suffix="%" />, label: 'Audit trail coverage' },
          ].map((s) => (
            <Item key={s.label}>
              <div className="hstat" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="hstat-num grad-text">{s.num}</div>
                <div className="hstat-label">{s.label}</div>
              </div>
            </Item>
          ))}
        </Stagger>
      </motion.div>
    </section>
  );
}

function ShowcaseSection({ onLaunch, P = PALETTE }) {
  const [activeTab, setActiveTab] = useState('throughput');
  const [selectedDistrict, setSelectedDistrict] = useState(DISTRICT_BARS[0]);

  return (
    <section className="section showcase" id="analytics" style={{ position: 'relative' }}>
      <div className="section-inner">
        <Reveal>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div>
              <div className="sec-tag" style={{ background: P.tagBg, borderColor: P.tagBorder, color: P.tagColor }}>
                Interactive Command Center
              </div>
              <h2 className="sec-title" style={{ marginTop: 12 }}>
                Real-time telemetry your collectors can <span className="serif-accent" style={{ background: P.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>control.</span>
              </h2>
              <p className="sec-desc">
                Switch between different analytical modes. High-contrast data visualizers for the professional executive.
              </p>
            </div>
          </div>
        </Reveal>

        {/* Interactive Mode Selector Tabs */}
        <div className="showcase-tabs" style={{ display: 'flex', gap: 10, marginTop: 20, marginBottom: 20, overflowX: 'auto', WebkitOverflowScrolling: 'touch', maxWidth: '100%', paddingBottom: 6, scrollbarWidth: 'none' }}>
          {[
            { id: 'throughput', label: 'District Throughput Radar', icon: <BarChartOutlined /> },
            { id: 'ocr_inspector', label: 'Neural Bounding Box Inspector', icon: <AimOutlined /> },
            { id: 'audit_gate', label: 'Human-in-the-Loop Gate', icon: <AuditOutlined /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                background: activeTab === tab.id ? '#0B57D0' : 'rgba(255,255,255,0.05)',
                color: '#ffffff',
                border: `1px solid ${activeTab === tab.id ? '#0B57D0' : 'rgba(255,255,255,0.15)'}`,
                padding: '10px 16px',
                borderRadius: 10,
                fontWeight: 800,
                fontSize: 12.5,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                flexShrink: 0,
                whiteSpace: 'nowrap',
                transition: 'all 0.25s cubic-bezier(.2,.8,.2,1)',
                boxShadow: activeTab === tab.id ? '0 4px 16px rgba(11,87,208,0.2)' : 'none'
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Showcase Interactive Card Panel */}
        <Reveal delay={0.1}>
          <div
            className="showcase-panel"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
              gap: 20,
              alignItems: 'start',
              border: '1px solid rgba(255,255,255,0.14)',
              boxShadow: '0 20px 44px rgba(3,12,32,0.45)',
              transition: 'all 0.3s',
              background: '#0A1F44',
              width: '100%',
              maxWidth: '100%',
              boxSizing: 'border-box',
              padding: 20,
              borderRadius: 20,
              overflow: 'hidden'
            }}
          >
            {activeTab === 'throughput' && (
              <>
                <div className="showcase-copy" style={{ minWidth: 0, width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#0B57D0', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, flexWrap: 'wrap' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: '#0B57D0', boxShadow: '0 0 8px #0B57D0', flexShrink: 0 }} /> 
                    Live Pilot Telemetry • Gov Blue
                  </div>
                  <h3 style={{ color: '#ffffff', fontSize: 'clamp(18px, 4.5vw, 22px)', lineHeight: 1.25, margin: 0, wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                    District-wise velocity, accuracy, and SLA queues.
                  </h3>
                  <p style={{ color: '#ffffff', opacity: 0.9, fontSize: 13, lineHeight: 1.5, marginTop: 8, wordBreak: 'break-word' }}>
                    Administrators track ingestion throughput across every tehsil while verifiers clear low-confidence flags with zero backlog.
                  </p>

                  <div className="kpi-list" style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14, width: '100%', maxWidth: '100%' }}>
                    {[
                      ['#0B57D0', `Selected District: ${selectedDistrict.name} (${selectedDistrict.count} records digested)`],
                      ['#0B57D0', '94.8% mean extraction confidence across UP zone'],
                      ['#0B57D0', '46 fields queued for expert human verification'],
                    ].map(([c, txt]) => (
                      <div className="kpi-row" key={txt} style={{ borderColor: 'rgba(11,87,208,0.2)', background: 'rgba(255,255,255,0.04)', color: '#ffffff', padding: '10px 12px', borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box' }}>
                        <span className="kpi-dot" style={{ background: c, boxShadow: `0 0 10px ${c}`, width: 8, height: 8, borderRadius: 999, flexShrink: 0, marginTop: 4 }} />
                        <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.4, wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{txt}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 18, width: '100%' }}>
                    <button onClick={onLaunch} style={{ height: 42, paddingInline: 20, width: '100%', maxWidth: 320, fontSize: 13, borderRadius: 10, fontWeight: 800, color: '#FFFFFF', background: '#0B57D0', border: '1px solid #0B57D0', boxShadow: '0 6px 20px rgba(11,87,208,0.25)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxSizing: 'border-box' }}>
                      Launch Analytics Dashboard →
                    </button>
                  </div>
                </div>

                <div className="chart-mock" style={{ background: 'rgba(255,255,255,0.06)', padding: '16px 14px', borderRadius: 16, border: '1px solid rgba(255,255,255,0.14)', width: '100%', maxWidth: '100%', boxSizing: 'border-box', minWidth: 0, overflow: 'hidden' }}>
                  <div className="chart-mock-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ color: '#ffffff', fontWeight: 800, fontSize: 13 }}>District Digitization Velocity</span>
                    <span style={{ color: '#FFFFFF', fontWeight: 800, background: '#0B57D0', padding: '2px 8px', borderRadius: 99, border: '1px solid #0B57D0', fontSize: 11 }}>+18.2% surge</span>
                  </div>
                  
                  {/* Interactive District Bar Graph */}
                  <div className="bars" style={{ height: 150, marginTop: 14, display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6, alignItems: 'end', width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
                    {DISTRICT_BARS.map((b) => (
                      <div 
                        className="bar-col" 
                        key={b.name} 
                        onClick={() => setSelectedDistrict(b)}
                        style={{ cursor: 'pointer', opacity: selectedDistrict.name === b.name ? 1 : 0.65, transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%', width: '100%', minWidth: 0, overflow: 'hidden' }}
                      >
                        <span style={{ fontSize: 10, color: selectedDistrict.name === b.name ? '#0B57D0' : '#ffffff', fontWeight: 800, marginBottom: 4, lineHeight: 1 }}>
                          {b.count}
                        </span>
                        <div 
                          style={{ 
                            width: '100%', 
                            height: `${b.h}%`, 
                            background: selectedDistrict.name === b.name ? '#0B57D0' : 'rgba(255,255,255,0.18)',
                            borderRadius: 4,
                            transition: 'all 0.3s ease'
                          }} 
                        />
                        <span className="bar-label" style={{ color: selectedDistrict.name === b.name ? '#0B57D0' : '#ffffff', fontWeight: 750, marginTop: 6, fontSize: 9.5, textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                          {b.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'ocr_inspector' && (
              <>
                <div className="showcase-copy">
                  <div style={{ color: '#0B57D0', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Neural Bounding Box AI
                  </div>
                  <h3 style={{ color: '#ffffff' }}>Multi-layered spatial layout reconstruction.</h3>
                  <p style={{ color: '#ffffff', opacity: 0.9 }}>
                    Deep learning segmentation engines map tabular boundaries, khasra columns, and landowner rows directly on scanned raster images.
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 10, border: '1px solid #0B57D0' }}>
                      <div style={{ color: '#0B57D0', fontWeight: 800, fontSize: 16 }}>0.04s</div>
                      <div style={{ color: '#ffffff', fontSize: 11.5 }}>Layout Inference</div>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', padding: 12, borderRadius: 10, border: '1px solid #0B57D0' }}>
                      <div style={{ color: '#0B57D0', fontWeight: 800, fontSize: 16 }}>99.2%</div>
                      <div style={{ color: '#ffffff', fontSize: 11.5 }}>Table IoU Precision</div>
                    </div>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', padding: 20, borderRadius: 20, border: '1px solid rgba(255,255,255,0.14)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ffffff', fontSize: 12 }}>
                    <span>Spatial Bounding Box Overlay</span>
                    <span style={{ color: '#8FB4F5', fontWeight: 700 }}>4 Zones Detected</span>
                  </div>
                  <div style={{ background: 'rgba(3,10,28,0.6)', border: '1px solid rgba(255,255,255,0.16)', padding: 16, borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: 6 }}>
                      <span style={{ color: '#0B57D0', fontSize: 11.5, fontWeight: 700 }}>BBox [120, 45, 380, 85]</span>
                      <span style={{ color: '#ffffff', fontSize: 11.5 }}>Conf 98%</span>
                    </div>
                    <div style={{ color: '#ffffff', fontWeight: 800, fontSize: 15 }}>खातेदार: राजेश कुमार शर्मा</div>
                    <div style={{ color: '#ffffff', opacity: 0.85, fontSize: 12 }}>खसरा सं. 45/2B • क्षेत्रफल: 2.45 हे.</div>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'audit_gate' && (
              <>
                <div className="showcase-copy">
                  <div style={{ color: '#0B57D0', fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                    Human Verification Chamber
                  </div>
                  <h3 style={{ color: '#ffffff' }}>Instant side-by-side audit resolution.</h3>
                  <p style={{ color: '#ffffff', opacity: 0.9 }}>
                    When handwriting confidence dips below 80%, fields are highlighted in yellow and routed to district verifiers with one-click approval.
                  </p>
                  <div style={{ marginTop: 20 }}>
                    <button onClick={onLaunch} style={{ height: 42, paddingInline: 22, fontSize: 13.5, borderRadius: 12, fontWeight: 800, color: '#FFFFFF', background: '#0B57D0', border: '1px solid #0B57D0', boxShadow: '0 8px 24px rgba(11,87,208,0.25)', cursor: 'pointer' }}>
                      Test Verification Station →
                    </button>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.06)', padding: 20, borderRadius: 20, border: '1px solid rgba(255,255,255,0.14)', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: 12, color: '#ffffff', fontWeight: 700 }}>Live Review Simulation</div>
                  <div style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.16)', padding: 14, borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#0B57D0', fontWeight: 750 }}>FLAGGED: Khasra Plot No.</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', marginTop: 2 }}>123/4A (Confidence 78%)</div>
                    </div>
                    <span style={{ background: '#0B57D0', color: '#FFFFFF', padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 800 }}>
                      One-Click Verify
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Landing({ onLaunch }) {
  const [scrolled, setScrolled] = useState(false);
  const P = PALETTE;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="landing">
      {/* Sleek Floating Navbar */}
      <nav className={`land-nav${scrolled ? ' scrolled' : ''}`}>
        <a className="brand-lockup" href="#top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
          <span className="brand-mark" style={{ background: P.primary }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M7 4h8a3 3 0 0 1 3 3v13a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4z" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
              <path d="M10 9.5h5M10 13h5M10 16.5h3" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          <span>
            <span className="brand-name">Bhoomi AI</span>
            <div className="brand-sub">Land Record OS</div>
          </span>
        </a>

        <div className="nav-links">
          <a className="nav-link" href="#platform">Platform</a>
          <a className="nav-link" href="#pipeline">Pipeline</a>
          <a className="nav-link" href="#analytics">Interactive Showcase</a>
          <a className="nav-link" href="#integrations">Integrations</a>
        </div>

        <button className="nav-cta" onClick={onLaunch} style={{ background: P.gradient, borderColor: P.primary }}>
          Open Console <ArrowRightOutlined />
        </button>
      </nav>

      {/* Hero Section */}
      <Hero onLaunch={onLaunch} P={P} />

      {/* Indic Multilingual Marquee */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {[...LANGS, ...LANGS].map(([native, eng], i) => (
            <span className="marquee-item" key={`${eng}-${i}`}>
              {native} <em>{eng}</em>
            </span>
          ))}
        </div>
      </div>

      {/* Platform Features Grid */}
      <section className="section" id="platform">
        <div className="section-inner">
          <Reveal>
            <div className="sec-tag" style={{ background: P.tagBg, borderColor: P.tagBorder, color: P.tagColor }}>The Platform</div>
            <h2 className="sec-title">
              Everything a revenue department needs, <span className="serif-accent" style={{ background: P.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>nothing it doesn't.</span>
            </h2>
            <p className="sec-desc">
              From dusty registers at the tehsil office to verified records in the state database — one pipeline handles intake, understanding, validation, and GIS verification end-to-end.
            </p>
          </Reveal>

          <Stagger className="feat-grid" gap={0.08}>
            {FEATURES.map((f, i) => (
              <Item key={f.title}>
                <div className="feat-card" style={{ '--feat-bg': `rgba(${P.primaryRgb},0.12)`, '--feat-fg': i % 2 ? P.accent : P.primary }}>
                  <div className="feat-icon">{f.icon}</div>
                  <div className="feat-title">{f.title}</div>
                  <p className="feat-desc" style={{ margin: 0 }}>{f.desc}</p>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
      </section>

      {/* 5-Step Process Pipeline */}
      <section className="section" id="pipeline" style={{ paddingTop: 40 }}>
        <div className="section-inner">
          <Reveal>
            <div className="sec-tag" style={{ background: P.tagBg, borderColor: P.tagBorder, color: P.tagColor }}>How it works</div>
            <h2 className="sec-title">
              From faded paper to <span className="serif-accent" style={{ background: P.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>verified data</span> in five steps.
            </h2>
          </Reveal>
          <Stagger className="pipeline" gap={0.12}>
            {STEPS.map((s, i) => (
              <Item key={s.t}>
                <div className="pipe-step">
                  <div className="pipe-rail">
                    <div className="pipe-node" style={{ color: i % 2 ? P.accent : P.primary }}>{s.icon}</div>
                    <DrawLine delay={0.3 + i * 0.1} />
                  </div>
                  <div className="pipe-k">Step {s.step}</div>
                  <div className="pipe-t">{s.t}</div>
                  <p className="pipe-d" style={{ margin: 0 }}>{s.d}</p>
                </div>
              </Item>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Interactive Showcase Section */}
      <ShowcaseSection onLaunch={onLaunch} P={P} />

      {/* Connected Integrations Strip */}
      <section className="section" id="integrations" style={{ paddingBottom: 60 }}>
        <div className="section-inner">
          <Reveal>
            <div className="sec-tag" style={{ background: P.tagBg, borderColor: P.tagBorder, color: P.tagColor }}>Government Integrations</div>
            <h2 className="sec-title" style={{ fontSize: 'clamp(28px, 3.6vw, 44px)' }}>
              Plugs straight into the systems you already run.
            </h2>
          </Reveal>
          <Stagger className="logo-strip" gap={0.07}>
            {['DILRMP', 'LRMS', 'PostGIS Spatial Layer', 'Bhulekh UP', 'Bhu-Naksha GIS', 'REST Webhooks'].map((n) => (
              <Item key={n}>
                <span className="sys-pill" style={{ borderColor: `rgba(${P.primaryRgb},0.2)` }}>
                  <span className="sys-dot" style={{ background: P.primary }} /> <b>{n}</b> · Connected
                </span>
              </Item>
            ))}
          </Stagger>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="cta-final">
        <div className="cta-ring" />
        <div className="cta-ring r2" />
        <div className="cta-ring r3" />
        <Reveal>
          <h2>
            The paperwork era ends <span className="serif-accent" style={{ background: P.gradient, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>here.</span>
          </h2>
          <p>Open the console and watch a handwritten register become a verified digital record.</p>
          <div style={{ marginTop: 36 }}>
            <button className="btn-primary-light" onClick={onLaunch} style={{ height: 48, paddingInline: 32, fontSize: 16, background: P.gradient, border: `1px solid ${P.primary}`, boxShadow: P.shadow }}>
              Launch Console <ArrowRightOutlined />
            </button>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="land-footer">
        <span>Bhoomi AI — built for Smart India Hackathon 2026</span>
        <span>Indic OCR • NLP • Human-in-the-loop • GIS Spatial Data</span>
        <a href="https://www.sih.gov.in" target="_blank" rel="noreferrer">sih.gov.in ↗</a>
      </footer>
    </div>
  );
}
