import { useState } from 'react';
import { Button, Card, Checkbox, Form, Input, Typography, message } from 'antd';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { isPatron } from '../utils/roles.js';
import AuthShell from '../components/AuthShell.jsx';
import QuestLearnLogo from '../components/QuestLearnLogo.jsx';

const DEMOS = [
  ['superadmin@library.com', 'SUPER ADMIN'],
  ['admin@library.com', 'ADMIN'],
  ['librarian@library.com', 'LIBRARIAN'],
  ['student@library.com', 'STUDENT'],
  ['member@library.com', 'MEMBER'],
];

function authError(e, fallback) {
  if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
    return 'Cannot reach the server. Start MongoDB and the API, then try again.';
  }
  return e.response?.data?.message || fallback;
}

export default function LoginPage() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [form] = Form.useForm();
  const [signingIn, setSigningIn] = useState(false);
  const [shake, setShake] = useState(false);

  function afterAuth(user) {
    if (isPatron(user) && !user.preferencesOnboarded) nav('/preferences');
    else nav(params.get('next') || '/app');
  }

  async function onLogin(v) {
    setSigningIn(true);
    try {
      const user = await login(v.email, v.password, { remember: v.remember !== false });
      message.success('Login successful');
      afterAuth(user);
    } catch (e) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      message.error(authError(e, 'Invalid email or password.'));
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <AuthShell shake={shake}>
      <Card className="auth-card ql-auth-card w-full max-w-md shadow-2xl">
        <div className="mb-3 flex items-center gap-3">
          <QuestLearnLogo className="auth-logo h-12 w-12 text-[color:var(--ql-gold)]" />
          <div>
            <Typography.Title level={3} className="!mb-1">
              Sign in
            </Typography.Title>
            <Typography.Paragraph type="secondary" className="auth-subtitle">
              QuestLearn library account
            </Typography.Paragraph>
          </div>
        </div>
        <Form form={form} layout="vertical" onFinish={onLogin} initialValues={{ remember: true, password: 'Password123!' }}>
          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Enter a valid email' },
            ]}
          >
            <Input className="auth-input" autoComplete="email" placeholder="you@college.edu" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, message: 'Password is required' }]}>
            <Input.Password className="auth-input" autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="remember" valuePropName="checked">
            <Checkbox>Remember me</Checkbox>
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={signingIn} disabled={signingIn} className="auth-submit">
            {signingIn ? 'Signing in...' : 'Login'}
          </Button>
        </Form>
        <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm">
          <Link to="/forgot-password">Forgot password</Link>
          <Link to="/register">Create an account</Link>
        </div>
        <p className="mt-3 text-xs text-[color:var(--muted-text)]">Need help? Sign in, then open Elena from the dashboard.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {DEMOS.map(([email, role]) => (
            <Button
              key={email}
              size="small"
              onClick={() => form.setFieldsValue({ email, password: 'Password123!' })}
            >
              {role}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-[color:var(--muted-text)]">Demo password: Password123!</p>
      </Card>
    </AuthShell>
  );
}
