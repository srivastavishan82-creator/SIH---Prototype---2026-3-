import { useState, useEffect } from 'react';
import { Layout, Menu, ConfigProvider, Avatar, Dropdown, Button, Input, Badge, Breadcrumb, Tooltip, Tag, Drawer, Result, Spin } from 'antd';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import {
  FileTextOutlined,
  BarChartOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SearchOutlined,
  BellOutlined,
  CloudUploadOutlined,
  DashboardOutlined,
  AuditOutlined,
  SettingOutlined,
  HomeOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import Dashboard from './pages/Dashboard';
import UploadDocument from './pages/UploadDocument';
import VerificationQueue from './pages/VerificationQueue';
import DocumentDetails from './pages/DocumentDetails';
import Analytics from './pages/Analytics';
import Integrations from './pages/Integrations';
import Profile from './pages/Profile';
import Landing from './components/Landing';
import Login from './pages/Login';
import { govBlueTheme, stitchTokens } from './theme';
import { health as apiHealth, getPendingVerifications, getAnalytics, getCurrentUser, listDocuments } from './api';

const { Header, Sider, Content } = Layout;

const REVIEWER_ROLES = new Set(['admin', 'verifier', 'govt_official']);

function AccessDenied({ onLoginAsInspector, onBack }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 16px' }}>
      <Result
        status="403"
        title="Restricted to Field Inspector"
        subTitle="Verification Queue and Verified Records can only be accessed by the field inspector account."
        extra={[
          <Button key="login" type="primary" onClick={onLoginAsInspector} style={{ borderRadius: 12, fontWeight: 700 }}>Log in as Inspector</Button>,
          <Button key="back" onClick={onBack} style={{ borderRadius: 12 }}>Back to Overview</Button>,
        ]}
      />
    </div>
  );
}

const routeMeta = {
  landing: { label: 'Product Landing', icon: <HomeOutlined /> },
  dashboard: { label: 'Overview', icon: <DashboardOutlined /> },
  upload: { label: 'Document Intake', icon: <CloudUploadOutlined /> },
  verification: { label: 'Verification Queue', icon: <AuditOutlined /> },
  documents: { label: 'Verified Records', icon: <FileTextOutlined /> },
  analytics: { label: 'Analytics & Reports', icon: <BarChartOutlined /> },
  integrations: { label: 'System Settings', icon: <SettingOutlined /> },
  profile: { label: 'My Profile', icon: <UserOutlined /> },
};

function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(localStorage.getItem('lrds_token')));
  const [backendOnline, setBackendOnline] = useState(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [avgAccuracy, setAvgAccuracy] = useState(null);
  const [headerUser, setHeaderUser] = useState(null);
  const [searching, setSearching] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const rawPath = location.pathname.replace(/^\//, '');
  const currentPath = !rawPath || rawPath === 'landing' ? 'landing' : rawPath;
  const activeNavKey = currentPath.split('/')[0] || 'dashboard';
  const meta = routeMeta[activeNavKey] || routeMeta.dashboard;

  useEffect(() => {
    // Check backend first, then load live header/footer data only when it is
    // reachable — avoids a burst of failed requests (console noise) when down.
    apiHealth()
      .then(() => {
        setBackendOnline(true);
        getPendingVerifications(1)
          .then((res) => setPendingCount(res?.total || 0))
          .catch(() => setPendingCount(0));
        getAnalytics()
          .then((res) => {
            const acc = res?.accuracy?.average_confidence;
            setAvgAccuracy(acc != null ? Number((acc * 100).toFixed(1)) : null);
          })
          .catch(() => setAvgAccuracy(null));
      })
      .catch(() => {
        setBackendOnline(false);
        setPendingCount(0);
        setAvgAccuracy(null);
      });
    if (localStorage.getItem('lrds_token')) {
      getCurrentUser().then(setHeaderUser).catch(() => {
        try {
          const demo = JSON.parse(localStorage.getItem('lrds_demo_user') || 'null');
          if (demo) setHeaderUser(demo);
          else setHeaderUser(null);
        } catch { setHeaderUser(null); }
      });
    } else {
      setHeaderUser(null);
    }
  }, [currentPath, isAuthenticated]);

  const isInspector = REVIEWER_ROLES.has(headerUser?.role);

  const RequireAuth = ({ children }) => {
    if (!localStorage.getItem('lrds_token')) return <Navigate to="/login" replace />;
    return children;
  };

  const menuItems = [
    { type: 'group', label: <span className="section-label" style={{ paddingLeft: 12 }}>Product</span> },
    { key: 'landing', icon: <HomeOutlined />, label: 'Landing Showcase' },
    { type: 'group', label: <span className="section-label" style={{ paddingLeft: 12 }}>Operations</span> },
    { key: 'dashboard', icon: <DashboardOutlined />, label: 'Overview' },
    { key: 'upload', icon: <CloudUploadOutlined />, label: 'Document Intake' },
    { key: 'verification', icon: <AuditOutlined />, label: 'Verification Queue' },
    { key: 'documents', icon: <FileTextOutlined />, label: 'Verified Records' },
    { type: 'group', label: <span className="section-label" style={{ paddingLeft: 12 }}>Intelligence</span> },
    { key: 'analytics', icon: <BarChartOutlined />, label: 'Analytics & Reports' },
    { type: 'group', label: <span className="section-label" style={{ paddingLeft: 12 }}>System</span> },
    { key: 'integrations', icon: <SettingOutlined />, label: 'Integrations' },
  ];

  const handleUserMenuClick = ({ key }) => {
    if (key === 'profile') setProfileOpen(true);
    if (key === 'prefs') setProfileOpen(true);
    if (key === 'landing') navigate('/landing');
  };

  const handleSearch = async (value) => {
    const query = value.trim();
    if (!query) return;
    setSearching(true);
    try {
      const result = await listDocuments(0, 10, query);
      if (result.documents?.length === 1 && isInspector) navigate(`/documents/${result.documents[0].id}`);
      else navigate(`/dashboard?search=${encodeURIComponent(query)}`);
    } finally {
      setSearching(false);
    }
  };

  const userMenu = {
    items: [
      { key: 'landing', label: 'View Showcase Landing', icon: <HomeOutlined /> },
      { key: 'profile', label: 'View Profile', icon: <UserOutlined /> },
      { key: 'prefs', label: 'Preferences', icon: <SettingOutlined /> },
      { type: 'divider' },
      { key: 'signout', label: 'Sign Out', danger: true, onClick: () => { localStorage.removeItem('lrds_token'); localStorage.removeItem('lrds_demo_user'); setHeaderUser(null); setIsAuthenticated(false); navigate('/login'); } },
    ],
    onClick: handleUserMenuClick,
  };

  const breadcrumbItems = [
    { title: <span className="breadcrumb-muted" style={{ cursor: 'pointer' }} onClick={() => navigate('/landing')}>Bhoomi AI</span> },
    { title: <span className="breadcrumb-active">{meta.label}</span> },
  ];

  if (currentPath === 'landing') {
    return (
      <ConfigProvider theme={govBlueTheme}>
        <Landing onLaunch={() => navigate('/login')} />
      </ConfigProvider>
    );
  }

  if (currentPath === 'login') {
    return (
      <ConfigProvider theme={govBlueTheme}>
        <Login onLogin={() => { setIsAuthenticated(true); navigate('/dashboard'); }} />
      </ConfigProvider>
    );
  }

  return (
    <ConfigProvider theme={govBlueTheme}>
      {/* Govt identity strip — instant professional trust */}
      <div className="gov-strip">
        <span>🇮🇳 &nbsp;भारत सरकार · Government of India — Digital India Land Records</span>
        <span className="gov-live" style={{ textTransform: 'none', letterSpacing: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: backendOnline === false ? '#FF6B6B' : '#34D399', display: 'inline-block' }} />
          {backendOnline === false ? 'Backend Offline' : backendOnline ? 'System Live · SIH 2026' : 'Connecting…'}
        </span>
      </div>

      <Layout style={{ minHeight: 'calc(100vh - 30px)', background: stitchTokens.pageBg }}>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          trigger={null}
          width={264}
          collapsedWidth={72}
          breakpoint="lg"
          onBreakpoint={(b) => setCollapsed(b)}
          style={{ overflow: 'auto', height: 'calc(100vh - 30px)', position: 'sticky', top: 30, left: 0, zIndex: 20, borderRight: `1px solid ${stitchTokens.border}`, background: '#FFFFFF' }}
        >
          <div style={{ height: 66, display: 'flex', alignItems: 'center', padding: collapsed ? '0 14px' : '0 16px', justifyContent: collapsed ? 'center' : 'flex-start', borderBottom: `1px solid ${stitchTokens.borderMuted}`, gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 11, background: 'linear-gradient(135deg,#0B57D0,#0842A0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 15, fontWeight: 900, flexShrink: 0, boxShadow: '0 6px 16px rgba(11,87,208,.3)' }}>◈</div>
            {!collapsed && (
              <div style={{ lineHeight: 1.15, cursor: 'pointer' }} onClick={() => navigate('/landing')}>
                <div style={{ fontWeight: 800, fontSize: 15, letterSpacing: '-0.03em', color: stitchTokens.ink, fontFamily: stitchTokens.fontDisplay }}>Bhoomi AI</div>
                <div style={{ fontSize: 10, color: '#8A94A8', fontWeight: 800, letterSpacing: '.09em', textTransform: 'uppercase' }}>Land Record OS</div>
              </div>
            )}
          </div>

          {!collapsed && (
            <div style={{ margin: '14px 14px 4px', padding: '10px 12px', borderRadius: 14, background: '#F1F6FF', border: '1px solid #D6E4FB', display: 'flex', gap: 10, alignItems: 'center' }}>
              <SafetyCertificateOutlined style={{ color: stitchTokens.primary, fontSize: 20 }} />
              <div style={{ lineHeight: 1.3 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: stitchTokens.ink }}>Revenue Dept. Console</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>{avgAccuracy != null ? `AI confidence ${avgAccuracy}%` : 'Secure · Audited'}</div>
              </div>
            </div>
          )}

          <Menu
            mode="inline"
            selectedKeys={[activeNavKey]}
            items={menuItems}
            onClick={({ key }) => navigate(`/${key}`)}
            style={{ borderRight: 0, background: 'transparent', paddingBottom: 16, marginTop: 6 }}
          />
        </Sider>

        <Layout style={{ background: 'transparent', minWidth: 0 }}>
          <Header className="glass-header" style={{ padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 30, zIndex: 10, height: 64, gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
              <Button
                type="text"
                icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                onClick={() => setCollapsed(!collapsed)}
                style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, border: `1px solid ${stitchTokens.border}`, background: '#fff', color: stitchTokens.ink }}
              />
              <div className="mobile-brand-title" style={{ display: 'none', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: 'linear-gradient(135deg,#0B57D0,#0842A0)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900 }}>◈</span>
                <span style={{ fontWeight: 800, fontSize: 14, color: stitchTokens.ink, fontFamily: stitchTokens.fontDisplay }}>Bhoomi AI</span>
              </div>
              <div className="header-breadcrumb-wrap" style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 16, color: stitchTokens.primary }}>{meta.icon}</span>
                <Breadcrumb items={breadcrumbItems} style={{ margin: 0 }} />
                <Tag className="header-version-tag" style={{ marginLeft: 6, background: '#E8EFFD', color: '#0842A0', border: '1px solid #B9CFF5', borderRadius: 999, fontWeight: 800, fontSize: 11 }}>v2.0 · Gov</Tag>
              </div>
            </div>

            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <Input.Search className="header-search" prefix={<SearchOutlined style={{ color: '#94A3B8' }} />} placeholder="Search document name" onSearch={handleSearch} loading={searching} style={{ width: 260, background: '#F4F6FA', borderRadius: 12, height: 38 }} allowClear />
              <div className="header-help-btn">
                <Tooltip title="View Landing Showcase"><Button type="text" onClick={() => navigate('/landing')} icon={<HomeOutlined style={{ fontSize: 16, color: stitchTokens.primary }} />} style={{ width: 36, height: 36, border: `1px solid ${stitchTokens.border}`, background: '#fff', borderRadius: 10 }} /></Tooltip>
              </div>
              <Badge count={pendingCount} size="small" offset={[-2, 2]} color={stitchTokens.primary} showZero={false}>
                <Button type="text" icon={<BellOutlined style={{ fontSize: 16, color: stitchTokens.ink }} />} onClick={() => navigate('/verification')} style={{ width: 36, height: 36, background: '#fff', border: `1px solid ${stitchTokens.border}`, borderRadius: 10 }} />
              </Badge>
              <Dropdown menu={userMenu} placement="bottomRight" arrow>
                <div onClick={() => setProfileOpen(true)} className="header-profile-pill" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10, padding: '3px 10px 3px 3px', borderRadius: 999, background: '#fff', border: `1px solid ${stitchTokens.border}` }}>
                  <Avatar size={30} style={{ background: 'linear-gradient(135deg,#0B57D0,#0842A0)', fontWeight: 800, fontSize: 12, flexShrink: 0, color: '#fff' }}>{headerUser ? (headerUser.full_name || headerUser.email || '?').split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : '—'}</Avatar>
                  <div className="header-profile-text" style={{ lineHeight: 1.2, paddingRight: 2 }}>
                    <div style={{ fontWeight: 750, fontSize: 13, color: stitchTokens.ink }}>{headerUser ? `${headerUser.full_name || headerUser.email} · ${headerUser.role || ''}` : 'Not signed in'}</div>
                    <div style={{ fontSize: 11, color: '#64748B' }}>{headerUser?.email || 'sign in to continue'}</div>
                  </div>
                </div>
              </Dropdown>
            </div>
          </Header>

          <Content className="app-content" style={{ margin: 0, padding: '22px 26px', maxWidth: 1400, width: '100%', marginInline: 'auto', minHeight: 280 }}>
            <Routes>
              <Route path="/" element={<Navigate to="/landing" replace />} />
              <Route path="/landing" element={<Landing onLaunch={() => navigate('/login')} />} />
              <Route path="/login" element={<Login onLogin={() => { setIsAuthenticated(true); navigate('/dashboard'); }} />} />
              <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
              <Route path="/upload" element={<RequireAuth><UploadDocument /></RequireAuth>} />
              <Route path="/verification" element={<RequireAuth><VerificationQueue /></RequireAuth>} />
              <Route path="/documents" element={<RequireAuth><DocumentDetails /></RequireAuth>} />
              <Route path="/documents/:id" element={<RequireAuth><DocumentDetails /></RequireAuth>} />
              <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
              <Route path="/integrations" element={<RequireAuth><Integrations /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>

            <div style={{ marginTop: 26, padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, color: '#475569', fontSize: 12.5, background: '#fff', borderRadius: 16, border: `1px solid ${stitchTokens.border}`, boxShadow: stitchTokens.shadowSm }}>
              <span style={{ fontWeight: 600 }}>© 2026 Bhoomi AI — Land Record Digitization System · SIH 2026</span>
              <span style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: backendOnline === false ? '#B3261E' : '#137333', display: 'inline-block' }} />
                  {backendOnline === false ? 'Backend Offline' : backendOnline ? 'Backend Online' : 'Checking backend…'}
                </span>
                <span>•</span>
                <span>{avgAccuracy != null ? `Avg confidence ${avgAccuracy}%` : 'No extractions yet'}</span>
              </span>
            </div>
          </Content>
        </Layout>
      </Layout>

      <Drawer
        title={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontWeight: 800, color: stitchTokens.ink, fontFamily: stitchTokens.fontDisplay }}>My Profile · Revenue Administrator</span>
            <Button type="primary" onClick={() => { setProfileOpen(false); navigate('/profile'); }} style={{ borderRadius: 10, fontWeight: 700 }}>Full Profile →</Button>
          </div>
        }
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        width={640}
        destroyOnClose={false}
        styles={{ body: { padding: 16, background: stitchTokens.pageBg }, header: { borderBottom: `1px solid ${stitchTokens.border}`, background: '#fff' } }}
      >
        <Profile compact />
      </Drawer>

      <Drawer
        placement="left"
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        width={280}
        styles={{ body: { padding: 0, background: '#fff' }, header: { background: '#fff' } }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#0B57D0,#0842A0)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900 }}>◈</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14, color: stitchTokens.ink }}>Bhoomi AI Nav</div>
              <div style={{ fontSize: 10.5, color: '#64748B', fontWeight: 700 }}>SIH 2026 · Revenue Dept</div>
            </div>
          </div>
        }
      >
        <Menu
          mode="inline"
          selectedKeys={[activeNavKey]}
          items={menuItems}
          onClick={({ key }) => { navigate(`/${key}`); setMobileNavOpen(false); }}
          style={{ borderRight: 0, background: 'transparent', marginTop: 12 }}
        />
      </Drawer>

      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        <button className={currentPath === 'dashboard' ? 'active' : ''} onClick={() => navigate('/dashboard')} aria-label="Overview">
          <DashboardOutlined /><span>Overview</span>
        </button>
        <button className={currentPath === 'upload' ? 'active' : ''} onClick={() => navigate('/upload')} aria-label="Intake">
          <CloudUploadOutlined /><span>Intake</span>
        </button>
        <div className="fab-wrap" onClick={() => navigate('/upload')} aria-label="Quick Intake">
          <div className="mobile-fab"><CloudUploadOutlined /></div>
        </div>
        <button className={currentPath === 'verification' ? 'active' : ''} onClick={() => navigate(isInspector ? '/verification' : '/dashboard')} aria-label={isInspector ? 'Verify' : 'Records'}>
          <AuditOutlined /><span>{isInspector ? 'Verify' : 'Records'}</span>
        </button>
        <button className={currentPath === 'analytics' ? 'active' : ''} onClick={() => navigate('/analytics')} aria-label="Reports">
          <BarChartOutlined /><span>Reports</span>
        </button>
      </nav>
    </ConfigProvider>
  );
}

export default App;
