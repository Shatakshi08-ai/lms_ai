import { useMutation } from '@tanstack/react-query';
import { Button, Card, Input, Typography, Alert } from 'antd';
import { useState } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import DashboardPage from './DashboardPage.jsx';

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [q, setQ] = useState('Which computer science books were issued most this month?');
  const nl = useMutation({ mutationFn: async () => (await api.post('/ai/nl-query', { question: q })).data });
  const report = useMutation({ mutationFn: async () => (await api.get('/ai/report')).data });

  return (
    <div className="space-y-4">
      <Typography.Title level={3}>Analytics & AI reports</Typography.Title>
      <DashboardPage />
      {['SUPER_ADMIN', 'ADMIN'].includes(user.role) && (
        <>
          <Card title="Natural-language analytics (sandboxed templates)">
            <Input.TextArea rows={2} value={q} onChange={(e) => setQ(e.target.value)} className="mb-2" />
            <Button type="primary" onClick={() => nl.mutate()} loading={nl.isPending}>Run query</Button>
            {nl.data && (
              <div className="mt-3 space-y-2">
                <Alert type="success" message={`Template: ${nl.data.templateId}`} />
                <p>{nl.data.summary}</p>
                <pre className="max-h-64 overflow-auto rounded bg-slate-900 p-3 text-xs text-slate-100">
                  {JSON.stringify(nl.data.data, null, 2)}
                </pre>
              </div>
            )}
          </Card>
          <Card title="Predictive / executive report" extra={<Button onClick={() => report.mutate()} loading={report.isPending}>Generate</Button>}>
            {report.data?.report && (
              <>
                <p>{report.data.report.narrative}</p>
                <pre className="max-h-64 overflow-auto text-xs">{JSON.stringify(report.data.report.demandForecast, null, 2)}</pre>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
