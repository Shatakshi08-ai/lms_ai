import { useQuery } from '@tanstack/react-query';
import { Button, Card, Statistic, Table, Tag, Typography } from 'antd';
import { useState } from 'react';
import dayjs from 'dayjs';
import api from '../services/api.js';
import BarcodeTools from '../components/BarcodeTools.jsx';
import CirculationDrawer from '../components/CirculationDrawer.jsx';
import { dueBadge } from '../utils/format.js';

export default function CirculationPage() {
  const [open, setOpen] = useState(true);
  const today = useQuery({ queryKey: ['today'], queryFn: async () => (await api.get('/circulation/today')).data });
  const loans = useQuery({
    queryKey: ['loans-active'],
    queryFn: async () => (await api.get('/circulation/loans', { params: { status: 'ISSUED', limit: 50 } })).data,
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <Typography.Title level={3} className="!mb-0">Circulation desk</Typography.Title>
        <Button type="primary" onClick={() => setOpen(true)}>Scanner / 1-click</Button>
      </div>
      <Card title="Scan or upload barcode" className="hover-card">
        <BarcodeTools />
      </Card>
      <div className="grid gap-3 md:grid-cols-3">
        <Card><Statistic title="Issued today" value={today.data?.issued || 0} /></Card>
        <Card><Statistic title="Returned today" value={today.data?.returned || 0} /></Card>
        <Card><Statistic title="Overdue" value={today.data?.overdue || 0} /></Card>
      </div>
      <Card title="Active loans" className="overflow-auto">
        <Table
          rowKey="_id"
          dataSource={loans.data?.items || []}
          columns={[
            { title: 'Member', render: (_, r) => `${r.userId?.name} (${r.userId?.readerId})` },
            { title: 'Title', render: (_, r) => r.bookId?.title },
            { title: 'Barcode', render: (_, r) => r.copyId?.barcode },
            { title: 'Due', dataIndex: 'dueDate', render: (d) => dayjs(d).format('DD MMM YYYY') },
            { title: 'Timer', dataIndex: 'dueDate', render: (d) => { const b = dueBadge(d); return <Tag color={b.color}>{b.text}</Tag>; } },
          ]}
        />
      </Card>
      <CirculationDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
