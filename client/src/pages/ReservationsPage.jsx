import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Table, Tag, Typography, message } from 'antd';
import dayjs from 'dayjs';
import api from '../services/api.js';

export default function ReservationsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['resv'],
    queryFn: async () => (await api.get('/circulation/reservations')).data,
  });
  const cancel = useMutation({
    mutationFn: (id) => api.post(`/circulation/reservations/${id}/cancel`),
    onSuccess: () => {
      message.success('Cancelled');
      qc.invalidateQueries({ queryKey: ['resv'] });
    },
  });

  return (
    <div>
      <Typography.Title level={3}>Reservation queue</Typography.Title>
      <div className="overflow-auto">
        <Table
          rowKey="_id"
          dataSource={data?.items || []}
          columns={[
            { title: 'Title', render: (_, r) => r.bookId?.title },
            { title: 'Member', render: (_, r) => r.userId?.name },
            { title: 'Position', dataIndex: 'queuePosition' },
            { title: 'Status', dataIndex: 'status', render: (s) => <Tag>{s}</Tag> },
            { title: 'Hold until', dataIndex: 'holdExpiresAt', render: (d) => (d ? dayjs(d).format('DD MMM HH:mm') : '—') },
            { title: 'Copy', render: (_, r) => r.copyId?.barcode || '—' },
            {
              title: '',
              render: (_, r) => r.status === 'PENDING' && (
                <Button size="small" onClick={() => cancel.mutate(r._id)}>Cancel</Button>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
