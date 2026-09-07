import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import AuthShell from '../components/AuthShell.jsx';

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  async function onFinish(v) {
    setBusy(true);
    try {
      await api.post('/auth/reset-password', { token: v.token, password: v.password });
      message.success('Password updated. Please sign in.');
      nav('/login');
    } catch (e) {
      message.error(e.response?.data?.message || 'Reset failed');
    } finally {
      setBusy(false);
    }
  }
  return (
    <AuthShell>
      <Card className="auth-card ql-auth-card w-full max-w-md">
        <Typography.Title level={3}>Reset password</Typography.Title>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="token" label="Reset token" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="New password" rules={[{ required: true, min: 8 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm password"
            dependencies={['password']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy}>
            Update password
          </Button>
        </Form>
        <Link to="/login">Back to sign in</Link>
      </Card>
    </AuthShell>
  );
}
