import { useState, useEffect } from 'react';
import { Card, Tag, Button, Avatar, Row, Col, Input, Space, message, Empty, Spin } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  EditOutlined,
  SaveOutlined,
} from '@ant-design/icons';
import { getCurrentUser, updateCurrentUser, getAnalytics, getRecentActivity, getDistrictProgress } from '../api';
import { StatCard, SectionTitle, StatusTag } from '../components/Page';

function Profile({ compact = false }) {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ name: '', role: '', email: '' });
  const [stats, setStats] = useState([
    { label: 'Fields verified', value: 0, sub: 'Across the system', tone: 'green' },
    { label: 'Pending actions', value: 0, sub: 'In the queue', tone: 'amber' },
    { label: 'Avg. confidence', value: '—', sub: 'Extraction mean', tone: 'blue' },
    { label: 'Districts', value: 0, sub: 'With records', tone: 'slate' },
  ]);
  const [activity, setActivity] = useState([]);

  const [draft, setDraft] = useState(profile);

  useEffect(() => {
    setLoading(true);
    getCurrentUser()
      .then((me) => {
        const p = {
          name: me.full_name || me.email,
          role: me.role || 'user',
          email: me.email,
        };
        setProfile(p);
        setDraft(p);
      })
      .catch(() => {
        setProfile({ name: 'Not signed in', role: '—', email: '—' });
      });

    getAnalytics()
      .then((res) => {
        if (res?.fields) {
          const acc = res.accuracy?.average_confidence ? `${(res.accuracy.average_confidence * 100).toFixed(1)}%` : '—';
          setStats([
            { label: 'Fields verified', value: res.fields.verified || 0, sub: 'Across the system', tone: 'green' },
            { label: 'Pending actions', value: res.fields.low_confidence || 0, sub: 'In the queue', tone: 'amber' },
            { label: 'Avg. confidence', value: acc, sub: 'Extraction mean', tone: 'blue' },
            { label: 'Districts', value: 0, sub: 'With records', tone: 'slate' },
          ]);
          getDistrictProgress()
            .then((d) => {
              const n = d?.district_progress?.length || 0;
              setStats((s) => s.map((x) => (x.label === 'Districts' ? { ...x, value: n } : x)));
            })
            .catch(() => {});
        }
      })
      .catch(() => {});

    getRecentActivity(compact ? 3 : 8)
      .then((res) => setActivity(res?.activity || []))
      .catch(() => setActivity([]))
      .finally(() => setLoading(false));
  }, [compact]);

  const handleSave = async () => {
    const name = draft.name.trim();
    if (name.length < 2) return message.error('Enter your full name');
    try {
      const updated = await updateCurrentUser(name);
      const next = { name: updated.full_name, role: updated.role, email: updated.email };
      setProfile(next);
      setDraft(next);
      setEditing(false);
      message.success('Profile updated');
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Profile update failed');
    }
  };

  const handleCancel = () => {
    setDraft(profile);
    setEditing(false);
  };

  return (
    <div className="animate-fade-in-up" style={{ display: 'flex', flexDirection: 'column', gap: compact ? 14 : 20 }}>
      <Spin spinning={loading}>
      {/* HEADER */}
      <Card bordered={false} className="saffron-card" style={{ borderRadius: 20, padding: 0, border: '1px solid #E2E8F0' }} bodyStyle={{ padding: 0 }}>
        <div className="profile-hero-grid" style={{ padding: compact ? '18px 16px' : '28px 24px', display: 'grid', gridTemplateColumns: compact ? 'auto 1fr' : 'auto 1fr auto', gap: 20, alignItems: 'center' }}>
          <Avatar size={compact ? 64 : 88} icon={<UserOutlined />} style={{ background: 'linear-gradient(135deg,#0B57D0,#0842A0)', color: '#FFFFFF', fontWeight: 900, fontSize: compact ? 22 : 32, border: '3px solid #E2E8F0', flexShrink: 0, boxShadow: '0 6px 16px rgba(11,87,208,.28)' }}>
            {profile.name ? profile.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() : ''}
          </Avatar>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ fontSize: compact ? 20 : 26, fontWeight: 900, color: '#0F172A', letterSpacing: '-0.03em', lineHeight: 1, fontFamily: 'var(--font-display)' }}>
                {profile.name || '—'}
              </div>
              <Tag style={{ margin: 0, background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', fontWeight: 800, borderRadius: 999, fontSize: 11 }}>
                <SafetyCertificateOutlined /> {profile.role || '—'}
              </Tag>
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 999, padding: '4px 12px', color: '#0F172A', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <MailOutlined /> {profile.email || '—'}
              </span>
            </div>
            {editing && (
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Full name" style={{ maxWidth: 220 }} />
              </div>
            )}
          </div>

          {!compact && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-end' }}>
              {!editing ? (
                <Button type="primary" icon={<EditOutlined />} onClick={() => setEditing(true)} style={{ borderRadius: 10, fontWeight: 700, height: 40, paddingInline: 18 }}>
                  Edit profile
                </Button>
              ) : (
                <Space>
                  <Button onClick={handleCancel} style={{ borderRadius: 10, height: 40, fontWeight: 700 }}>
                    Cancel
                  </Button>
                  <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} style={{ borderRadius: 10, height: 40, fontWeight: 700 }}>
                    Save changes
                  </Button>
                </Space>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* STATS STRIP */}
      {!compact && (
        <Row gutter={[12, 12]}>
          {stats.map((s) => (
            <Col xs={12} lg={6} key={s.label}>
              <StatCard label={s.label} value={s.value} sub={s.sub} tone={s.tone} />
            </Col>
          ))}
        </Row>
      )}
      </Spin>

      {/* ACTIVITY AUDIT LOG */}
      <Card
        bordered={false}
        className="saffron-card"
        title={<SectionTitle>Recent activity</SectionTitle>}
        bodyStyle={{ padding: 20 }}
      >
        {activity.length === 0 ? (
          <Empty description="No activity yet — uploads and verifications will appear here" />
        ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {activity.map((act, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E1E6EE', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: '#0B57D0', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: '#0F172A', fontSize: 13 }}>{act.detail || `${act.entity_type} #${act.entity_id}`}</span>
              </div>
              <Space size={12} wrap>
                <StatusTag status={act.action} />
                <span style={{ fontSize: 12, color: '#94A3B8' }}>{act.created_at ? new Date(act.created_at).toLocaleString('en-IN') : ''}</span>
              </Space>
            </div>
          ))}
        </div>
        )}
      </Card>
    </div>
  );
}

export default Profile;
