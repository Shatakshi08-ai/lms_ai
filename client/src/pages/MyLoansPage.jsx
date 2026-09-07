import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Table, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import api from '../services/api.js';
import { dueBadge } from '../utils/format.js';

export default function MyLoansPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['myloans'], queryFn: async () => (await api.get('/circulation/loans/me')).data });
  const renew = useMutation({
    mutationFn: (id) => api.post(`/circulation/renew/${id}`),
    onSuccess: () => {
      message.success('Renewed');
      qc.invalidateQueries({ queryKey: ['myloans'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Cannot renew'),
  });

  return (
    <div>
      <Typography.Title level={3}>My loans</Typography.Title>
      <div className="overflow-auto">
        <Table
          rowKey="_id"
          dataSource={data?.items || []}
          columns={[
            { title: 'Title', render: (_, r) => r.bookId?.title },
            { title: 'Barcode', render: (_, r) => r.copyId?.barcode },
            { title: 'Issued', dataIndex: 'issueDate', render: (d) => dayjs(d).format('DD MMM YYYY') },
            { title: 'Due', dataIndex: 'dueDate', render: (d) => dayjs(d).format('DD MMM YYYY') },
            { title: 'Timer', dataIndex: 'dueDate', render: (d) => { const b = dueBadge(d); return <Tag color={b.color}>{b.text}</Tag>; } },
            { title: 'Renewals', dataIndex: 'renewalCount' },
            { title: 'Status', dataIndex: 'status' },
            {
              title: '',
              render: (_, r) => ['ISSUED', 'OVERDUE'].includes(r.status) && (
                <Button size="small" onClick={() => renew.mutate(r._id)}>Renew</Button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
