import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Descriptions, Drawer, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useState } from 'react';
import dayjs from 'dayjs';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function UsersPage() {
  const { user } = useAuth();
  const isAdmin = ['ADMIN', 'SUPER_ADMIN'].includes(user.role);
  const [q, setQ] = useState('');
  const [role, setRole] = useState(user.role === 'LIBRARIAN' ? 'PATRON' : undefined);
  const [status, setStatus] = useState();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['users', q, role, status, page],
    queryFn: async () =>
      (await api.get('/users', { params: { q: q || undefined, role: role || undefined, status: status || undefined, page, limit: 20 } })).data,
  });
  const create = useMutation({
    mutationFn: (v) => api.post('/users', v),
    onSuccess: () => {
      message.success('User created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed'),
  });
  const patch = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/users/${id}`, body),
    onSuccess: () => {
      message.success('Updated');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Update failed'),
  });

  async function openDetail(id) {
    try {
      const { data: d } = await api.get(`/users/${id}`);
      setDetail(d);
    } catch (e) {
      message.error(e.response?.data?.message || 'Unable to load member');
    }
  }

  return (
    <div className="page-fade">
      <div className="mb-4 flex flex-wrap justify-between gap-3">
        <Typography.Title level={3} className="!mb-0">People</Typography.Title>
        {isAdmin && <Button type="primary" onClick={() => setOpen(true)}>New user</Button>}
      </div>
      <Space wrap className="mb-4">
        <Input.Search allowClear placeholder="Name, email, reader ID" onSearch={(v) => { setPage(1); setQ(v); }} />
        <Select
          allowClear
          placeholder="Role"
          style={{ width: 160 }}
          value={role}
          onChange={(v) => { setPage(1); setRole(v); }}
          options={[
            { value: 'STUDENT', label: 'Student' },
            { value: 'MEMBER', label: 'Member' },
            { value: 'PATRON', label: 'All patrons' },
            ...(isAdmin
              ? [
                  { value: 'LIBRARIAN', label: 'Librarian' },
                  { value: 'ADMIN', label: 'Admin' },
                ]
              : []),
          ]}
        />
        <Select
          allowClear
          placeholder="Status"
          style={{ width: 140 }}
          value={status}
          onChange={(v) => { setPage(1); setStatus(v); }}
          options={['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].map((v) => ({ value: v, label: v }))}
        />
        {isError && <Button onClick={() => refetch()}>Retry</Button>}
      </Space>
      <div className="overflow-auto">
        <Table
          rowKey="_id"
          loading={isLoading}
          dataSource={data?.items || []}
          pagination={{
            current: page,
            total: data?.total || 0,
            pageSize: 20,
            onChange: setPage,
          }}
          columns={[
            { title: 'Reader ID', dataIndex: 'readerId' },
            { title: 'Name', dataIndex: 'name' },
            { title: 'Email', dataIndex: 'email' },
            { title: 'Role', dataIndex: 'role', render: (r) => <Tag>{r}</Tag> },
            {
              title: 'Status',
              dataIndex: 'status',
              render: (s, r) =>
                isAdmin ? (
                  <Select
                    size="small"
                    value={s}
                    style={{ width: 140 }}
                    onChange={(status) => patch.mutate({ id: r._id, status })}
                    options={['ACTIVE', 'SUSPENDED', 'DEACTIVATED'].map((v) => ({ value: v, label: v }))}
                  />
                ) : (
                  <Tag color={s === 'ACTIVE' ? 'green' : 'red'}>{s}</Tag>
                ),
            },
            { title: 'Joined', dataIndex: 'createdAt', render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
            { title: 'Last activity', dataIndex: 'lastActivityAt', render: (v) => (v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—') },
            {
              title: '',
              render: (_, r) => (
                <Button size="small" onClick={() => openDetail(r._id)}>
                  Details
                </Button>
              ),
            },
          ]}
        />
      </div>
      <Modal title="Create user" open={open} onCancel={() => setOpen(false)} footer={null}>
        <Form layout="vertical" onFinish={(v) => create.mutate(v)}>
          <Form.Item name="name" label="Name" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}><Input /></Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 8 }]}><Input.Password /></Form.Item>
          <Form.Item name="department" label="Department"><Input /></Form.Item>
          <Form.Item name="role" label="Role" initialValue="STUDENT">
            <Select options={['STUDENT', 'MEMBER', 'LIBRARIAN', 'ADMIN'].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={create.isPending}>Create</Button>
        </Form>
      </Modal>
      <Drawer title="Account details" open={Boolean(detail)} width={480} onClose={() => setDetail(null)}>
        {detail?.user && (
          <>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Name">{detail.user.name}</Descriptions.Item>
              <Descriptions.Item label="Email">{detail.user.email}</Descriptions.Item>
              <Descriptions.Item label="Phone">{detail.user.phone || '—'}</Descriptions.Item>
              <Descriptions.Item label="Role">{detail.user.role}</Descriptions.Item>
              <Descriptions.Item label="Status">{detail.user.status}</Descriptions.Item>
              <Descriptions.Item label="Reader ID">{detail.user.readerId}</Descriptions.Item>
            </Descriptions>
            <Typography.Title level={5}>Issued</Typography.Title>
            {(detail.library?.issued || []).map((l) => (
              <div key={l._id}>{l.bookId?.title} · due {l.dueDate ? dayjs(l.dueDate).format('DD MMM YYYY') : '—'}</div>
            ))}
            <Typography.Title level={5}>Fines</Typography.Title>
            <p>Pending total: {detail.library?.pendingFineTotal || 0}</p>
          </>
        )}
      </Drawer>
    </div>
  );
}
