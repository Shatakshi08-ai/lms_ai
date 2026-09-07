import { Card, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import api from '../services/api.js';
import PreferencesForm from '../components/PreferencesForm.jsx';

export default function PreferencesPage() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();

  return (
    <div className="mx-auto max-w-xl py-4">
      <Card className="shadow-lg">
        <Typography.Title level={3} className="!mb-1">
          Welcome to Aether, {user.name.split(' ')[0]}
        </Typography.Title>
        <Typography.Paragraph type="secondary">Tell us what you like to read so we can personalize your shelf.</Typography.Paragraph>
        <PreferencesForm
          initialValues={user.preferences}
          submitLabel="Save and continue"
          onFinish={async (prefs) => {
            const { data } = await api.patch('/auth/me', { preferences: prefs, preferencesOnboarded: true });
            setUser(data.user);
            message.success('Preferences saved');
            nav('/', { replace: true });
          }}
        />
      </Card>
    </div>
  );
}
