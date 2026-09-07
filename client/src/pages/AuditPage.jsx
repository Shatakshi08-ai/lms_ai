import { useQuery } from '@tanstack/react-query';
import { DatePicker, Input, Pagination, Select, Table, Typography } from 'antd';
import { useState } from 'react';
import dayjs from 'dayjs';
import api from '../services/api.js';

const ACTIONS = [
  '',
  'AUTH_LOGIN',
  'AUTH_LOGOUT',
  'AUTH_REGISTER',
  'BOOK_VIEW',
  'BOOK_READ',
  'BOOK_SEARCH',
  'BOOK_DOWNLOAD',
  'CART_ADD',
  'CART_REMOVE',
  'WISHLIST_ADD',
  'WISHLIST_REMOVE',
  'CIRCULATION_ISSUE',
  'CIRCULATION_RETURN',
  'CIRCULATION_RENEW',
  'RESERVATION_CREATE',
  'BARCODE_SCAN',
  'BARCODE_UPLOAD',
  'BOOK_CREATE',
  'BOOK_UPDATE',
  'NOTIFICATION_VIEW',
];

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [user, setUser] = useState('');
  const [role, setRole] = useState('');
  const [action, setAction] = useState('');
  const [book, setBook] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState([]);

  const { data, isFetching } = useQuery({
    queryKey: ['audit', page, user, role, action, book, status, range],
    queryFn: async () =>
      (
        await api.get('/analytics/audit', {
          params: {
            page,
            limit: 20,
            user: user || undefined,
            role: role || undefined,
            action: action || undefined,
            book: book || undefined,
            status: status || undefined,
            from: range?.[0] ? range[0].startOf('day').toISOString() : undefined,
            to: range?.[1] ? range[1].endOf('day').toISOString() : undefined,
          },
        })
      ).data,
  });

  return (
    <div className="page-fade">
      <Typography.Title level={3}>Activity logs</Typography.Title>
      <div className="mb-4 flex flex-wrap gap-2">
        <Input
          allowClear
          placeholder="User name, email, or reader ID"
          className="w-56"
          value={user}
          onChange={(e) => {
            setUser(e.target.value);
            setPage(1);
          }}
        />
        <Select
          allowClear
          placeholder="Role"
          className="w-40"
          value={role || undefined}
          onChange={(v) => {
            setRole(v || '');
            setPage(1);
          }}
          options={['STUDENT', 'MEMBER', 'LIBRARIAN', 'ADMIN', 'SUPER_ADMIN'].map((r) => ({ value: r, label: r }))}
        />
        <Select
          allowClear
          showSearch
          placeholder="Action"
          className="w-52"
          value={action || undefined}
          onChange={(v) => {
            setAction(v || '');
            setPage(1);
          }}
          options={ACTIONS.filter(Boolean).map((a) => ({ value: a, label: a }))}
        />
        <Input
          allowClear
          placeholder="Book title"
          className="w-48"
          value={book}
          onChange={(e) => {
            setBook(e.target.value);
            setPage(1);
          }}
        />
        <Select
          allowClear
          placeholder="Status"
          className="w-32"
          value={status || undefined}
          onChange={(v) => {
            setStatus(v || '');
            setPage(1);
          }}
          options={[
            { value: 'SUCCESS', label: 'Success' },
            { value: 'FAILED', label: 'Failed' },
          ]}
        />
        <DatePicker.RangePicker
          value={range}
          onChange={(v) => {
            setRange(v || []);
            setPage(1);
          }}
        />
      </div>
      <div className="overflow-auto">
        <Table
          rowKey="_id"
          loading={isFetching}
          pagination={false}
          dataSource={data?.items || []}
          columns={[
            {
              title: 'User',
              render: (_, r) => r.actorId?.name || r.actorId?.email || '—',
            },
            { title: 'Role', render: (_, r) => r.actorRole || r.actorId?.role || '—' },
            { title: 'Action', dataIndex: 'action' },
            { title: 'Book / resource', render: (_, r) => r.bookTitle || r.bookId?.title || r.entity },
            { title: 'Book ID', render: (_, r) => r.catalogId || r.bookId?.catalogId || '—' },
            { title: 'Date', render: (_, r) => dayjs(r.timestamp || r.createdAt).format('DD MMM YYYY') },
            { title: 'Time', render: (_, r) => dayjs(r.timestamp || r.createdAt).format('hh:mm A') },
            { title: 'Status', dataIndex: 'status', render: (s) => s || 'SUCCESS' },
          ]}
        />
      </div>
      <div className="mt-4 flex justify-center">
        <Pagination
          current={page}
          total={data?.total || 0}
          pageSize={data?.limit || 20}
          onChange={setPage}
          showSizeChanger={false}
        />
      </div>
    </div>
  );
}
