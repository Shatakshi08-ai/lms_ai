import { Button, Card, Form, Input, Typography, message } from 'antd';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import PreferencesForm from '../components/PreferencesForm.jsx';

export default function ProfilePage() {
  const { user, setUser } = useAuth();
  return (
    <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
      <Card>
        <Typography.Title level={3}>Profile</Typography.Title>
        <p className="text-[#724542]">{user.readerId} · {user.role}</p>
        <Form
          layout="vertical"
          initialValues={user}
          onFinish={async (v) => {
            const { data } = await api.patch('/auth/me', v);
            setUser(data.user);
            message.success('Saved');
          }}
        >
          <Form.Item name="name" label="Name"><Input /></Form.Item>
          <Form.Item name="phone" label="Phone"><Input /></Form.Item>
          <Form.Item name="department" label="Department"><Input /></Form.Item>
          <Form.Item name="avatar" label="Avatar URL"><Input placeholder="https://…" /></Form.Item>
          <Form.Item name="currentPassword" label="Current password"><Input.Password /></Form.Item>
          <Form.Item name="password" label="New password"><Input.Password /></Form.Item>
          <Button type="primary" htmlType="submit">Update</Button>
        </Form>
      </Card>
      <Card title="Reading preferences">
        <PreferencesForm
          initialValues={user.preferences}
          submitLabel="Update preferences"
          onFinish={async (prefs) => {
            const { data } = await api.patch('/auth/me', { preferences: prefs, preferencesOnboarded: true });
            setUser(data.user);
            message.success('Preferences updated');
          }}
        />
      </Card>
    </div>
  );
}
