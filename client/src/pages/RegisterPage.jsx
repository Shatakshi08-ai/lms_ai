import { useState } from 'react';
import { Button, Card, Checkbox, Form, Input, Select, Typography, message } from 'antd';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isPatron } from '../utils/roles.js';
import AuthShell from '../components/AuthShell.jsx';
import QuestLearnLogo from '../components/QuestLearnLogo.jsx';

function authError(e, fallback) {
  if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
    return 'Cannot reach the server. Start MongoDB and the API, then try again.';
  }
  return e.response?.data?.message || fallback;
}

export default function RegisterPage() {
  const { register } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(false);

  async function onFinish(v) {
    setBusy(true);
    try {
      const user = await register({
        name: v.name,
        email: v.email,
        phone: v.phone,
        password: v.password,
        department: v.department,
        role: v.role,
      });
      message.success('Account created. Welcome to QuestLearn.');
      if (isPatron(user) && !user.preferencesOnboarded) nav('/preferences');
      else nav('/app');
    } catch (e) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      message.error(authError(e, 'Registration failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell shake={shake}>
      <Card className="auth-card ql-auth-card w-full max-w-md">
        <div className="mb-3 flex items-center gap-3">
          <QuestLearnLogo className="auth-logo h-12 w-12" />
          <div>
            <Typography.Title level={3} className="!mb-1">
              Create account
            </Typography.Title>
            <Typography.Paragraph type="secondary">Student or member registration</Typography.Paragraph>
          </div>
        </div>
        <Form layout="vertical" onFinish={onFinish} initialValues={{ role: 'STUDENT', terms: false }}>
          <Form.Item name="name" label="Full name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input className="auth-input" autoComplete="name" />
          </Form.Item>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input className="auth-input" autoComplete="email" />
          </Form.Item>
          <Form.Item name="phone" label="Phone">
            <Input className="auth-input" autoComplete="tel" />
          </Form.Item>
          <Form.Item name="department" label="Department / class">
            <Input className="auth-input" />
          </Form.Item>
          <Form.Item name="role" label="I am registering as" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'STUDENT', label: 'Student' },
                { value: 'MEMBER', label: 'Member' },
              ]}
            />
          </Form.Item>
          <Form.Item
            name="password"
            label="Password"
            rules={[
              { required: true, message: 'Password is required' },
              { min: 8, message: 'Use at least 8 characters' },
            ]}
          >
            <Input.Password className="auth-input" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirm"
            label="Confirm password"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Confirm your password' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve();
                  return Promise.reject(new Error('Passwords do not match'));
                },
              }),
            ]}
          >
            <Input.Password className="auth-input" autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="terms"
            valuePropName="checked"
            rules={[
              {
                validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error('Please accept the library terms'))),
              },
            ]}
          >
            <Checkbox>I agree to QuestLearn library rules and acceptable use.</Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={busy} className="auth-submit">
            {busy ? 'Creating account...' : 'Create reader ID'}
          </Button>
        </Form>
        <p className="mt-3 text-sm">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </Card>
    </AuthShell>
  );
}
