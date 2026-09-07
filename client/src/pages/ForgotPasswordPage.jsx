import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import AuthShell from '../components/AuthShell.jsx';

export default function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  async function onFinish(v) {
    setBusy(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: v.email });
      message.success(data.message || 'If the account exists, reset instructions were created.');
    } catch (e) {
      message.error(e.response?.data?.message || 'Request failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell>
      <Card className="auth-card ql-auth-card w-full max-w-md">
        <Typography.Title level={3}>Forgot password</Typography.Title>
        <p className="text-[color:var(--muted-text)]">Enter your account email. In development the reset token is printed in the API log.</p>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy}>
            Send reset
          </Button>
        </Form>
        <p className="mt-3 text-sm">
          Have a token? <Link to="/reset-password">Reset password</Link>
        </p>
        <Link to="/login">Back to sign in</Link>
      </Card>
    </AuthShell>
  );
}
