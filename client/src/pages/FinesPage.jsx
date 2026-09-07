import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isPatron } from '../utils/roles.js';
import ReceiptModal from '../components/ReceiptModal.jsx';
import { formatMoney } from '../utils/format.js';

export default function FinesPage() {
  const { user } = useAuth();
  const staff = !isPatron(user);
  const qc = useQueryClient();
  const [status, setStatus] = useState();
  const [receipt, setReceipt] = useState(null);
  const { data } = useQuery({
    queryKey: ['fines', status],
    queryFn: async () => (await api.get('/fines', { params: { status } })).data,
  });
  const pay = useMutation({
    mutationFn: ({ id, paymentMethod }) => api.post(`/fines/${id}/pay`, { paymentMethod }),
    onSuccess: async (res, vars) => {
      const { data: full } = await api.get(`/fines/${vars.id}`);
      setReceipt(full);
      message.success('Paid');
      qc.invalidateQueries({ queryKey: ['fines'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Pay failed'),
  });
  const waive = useMutation({
    mutationFn: (id) => api.post(`/fines/${id}/waive`, { reason: 'Desk waiver' }),
    onSuccess: () => {
      message.success('Waived');
      qc.invalidateQueries({ queryKey: ['fines'] });
    },
  });

  return (
    <div>
      <Typography.Title level={3}>Fines & receipts</Typography.Title>
      <Select allowClear placeholder="Status" className="mb-4 w-40" onChange={setStatus} options={['PENDING', 'PAID', 'WAIVED'].map((v) => ({ value: v, label: v }))} />
      <div className="overflow-auto">
        <Table
          rowKey="_id"
          dataSource={data?.items || []}
          columns={[
            { title: 'Member', render: (_, r) => r.userId?.name || user.name },
            { title: 'Amount', dataIndex: 'amount', render: (a) => formatMoney(a) },
            { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={s === 'PAID' ? 'green' : s === 'WAIVED' ? 'gold' : 'red'}>{s}</Tag> },
            { title: 'Txn', dataIndex: 'transactionId' },
            staff && {
              title: 'Actions',
              render: (_, r) => r.status === 'PENDING' && (
                <Space>
                  <Button size="small" type="primary" onClick={() => pay.mutate({ id: r._id, paymentMethod: 'UPI' })}>Pay UPI</Button>
                  <Button size="small" onClick={() => pay.mutate({ id: r._id, paymentMethod: 'CASH' })}>Cash</Button>
                  <Button size="small" danger onClick={() => waive.mutate(r._id)}>Waive</Button>
                </Space>
              ),
            },
            {
              title: 'Receipt',
              render: (_, r) => r.status === 'PAID' && <Button size="small" onClick={async () => setReceipt(await (await api.get(`/fines/${r._id}`)).data)}>View</Button>,
            },
          ].filter(Boolean)}
        />
      </div>
      <ReceiptModal open={Boolean(receipt)} onClose={() => setReceipt(null)} fine={receipt?.fine} settings={receipt?.settings} />
    </div>
  );
}
