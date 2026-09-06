import React, { useState } from 'react';
import { Button, Input, Form, Typography, Divider, Card, message } from 'antd';
import { UserOutlined, LockOutlined, ArrowRightOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin } from '../api';

const { Title, Text } = Typography;

export default function Login({ onLogin }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleDemoLogin = (values) => {
    const email = (values.email || 'demo@bhoomi.local').toLowerCase();
    const role = email === 'verifier@lrds.gov.in' ? 'verifier' : 'citizen';
    const fakeToken = `demo.${btoa(email)}.${Date.now()}`;
    localStorage.setItem('lrds_token', fakeToken);
    localStorage.setItem('lrds_demo_user', JSON.stringify({ email, role, full_name: email.split('@')[0] }));
    message.success(`Demo preview as ${email} (${role}) — backend offline, data is mocked`);
    onLogin();
  };
  const handleFinish = async (values) => {
    setLoading(true);
    try {
      const res = await apiLogin(values.email, values.password);
      localStorage.removeItem('lrds_demo_user');
      localStorage.setItem('lrds_token', res.access_token);
      message.success(`Welcome ${res.email} (${res.role})`);
      onLogin();
    } catch (e) {
      const status = e?.response?.status;
      if (e?.backendDown) {
        message.warning(e.message);
        // Auto demo fallback so Pages preview is not blocked
        handleDemoLogin(values);
      } else if (status === 401) message.error('Invalid credentials — check email and password');
      else message.error(e?.response?.data?.detail || e?.message || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-page" style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: '20px 16px',
      boxSizing: 'border-box'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        style={{ zIndex: 1, width: '100%', maxWidth: 430, margin: '0 auto', boxSizing: 'border-box' }}
        className="login-container"
      >
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#0B57D0,#0842A0)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 21, fontWeight: 900, marginBottom: 12, boxShadow: '0 10px 24px rgba(11,87,208,.4)' }}>
            ◈
          </div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', color: '#B9C8E2', textTransform: 'uppercase' }}>🇮🇳 Government of India · Digital India</div>
          <Title level={2} style={{ color: '#ffffff', margin: '6px 0 0', fontWeight: 800, letterSpacing: '-0.03em', fontFamily: "'Plus Jakarta Sans','Inter',sans-serif", fontSize: 'clamp(22px, 5vw, 27px)' }}>
            Bhoomi AI Console
          </Title>
          <Text style={{ color: '#B9C8E2', fontSize: 13.5, display: 'block', marginTop: 4 }}>
            Secure access to land record digitization
          </Text>
        </div>

        <Card
          bordered={false}
          style={{
            background: '#ffffff',
            borderRadius: 20,
            border: '1px solid #E1E6EE',
            boxShadow: '0 24px 60px rgba(3,12,32,.4)',
            width: '100%',
            boxSizing: 'border-box'
          }}
          bodyStyle={{ padding: '26px 22px' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, background: '#F1F6FF', border: '1px solid #D6E4FB', borderRadius: 12, padding: '9px 12px', fontSize: 12, color: '#0842A0', fontWeight: 700 }}>
            <SafetyCertificateOutlined /> Authorized revenue personnel only · Audit-logged
          </div>
          <Form
            layout="vertical"
            onFinish={handleFinish}
            requiredMark={false}
          >
            <Form.Item
              name="email"
              rules={[{ required: true, message: 'Please enter your email' }]}
              style={{ marginBottom: 14 }}
            >
              <Input
                className="login-input-field"
                prefix={<UserOutlined className="login-input-icon" />}
                 placeholder="Work email"
                style={{ height: 46, borderRadius: 12 }}
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
              style={{ marginBottom: 10 }}
            >
              <Input.Password
                className="login-input-field"
                prefix={<LockOutlined className="login-input-icon" />}
                placeholder="Password"
                style={{ height: 46, borderRadius: 12 }}
              />
            </Form.Item>

            <div style={{ textAlign: 'right', marginBottom: 18 }}>
              <button type="button" onClick={() => message.info('Contact your system administrator to reset your account password.')} style={{ color: '#0B57D0', fontSize: 12.5, fontWeight: 700, border: 0, padding: 0, background: 'transparent', cursor: 'pointer' }}>Forgot password?</button>
            </div>

            <Form.Item style={{ margin: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                size="large"
                loading={loading}
                style={{
                  height: 48,
                  borderRadius: 12,
                  fontWeight: 800,
                  fontSize: 14.5,
                }}
              >
                Log In Securely <ArrowRightOutlined />
              </Button>
            </Form.Item>
          </Form>

          <Divider style={{ borderColor: '#E1E6EE', fontSize: 11, margin: '12px 0', color: '#94A3B8' }}>PROTECTED · SIH 2026</Divider>
          <Button block onClick={() => handleDemoLogin({ email: 'demo@bhoomi.local', password: 'demo' })} style={{ borderRadius: 12, height: 44, fontWeight: 700, background: '#F1F6FF', border: '1px solid #D6E4FB', color: '#0842A0' }}>
            Preview without backend (Demo)
          </Button>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#94A3B8', marginTop: 8 }}>
            GitHub Pages is frontend-only — backend runs locally via start_all.bat
          </div>

          <div style={{ textAlign: 'center', fontSize: 12, color: '#64748B', marginTop: 10 }}>
            Every login and verification is recorded in the audit trail.
          </div>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 18 }}>
          <Button type="link" onClick={() => navigate('/landing')} style={{ color: '#D3E3FD', fontWeight: 700, fontSize: 13 }}>
            ← Back to Home
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
