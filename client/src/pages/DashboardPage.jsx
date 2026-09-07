import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Col, Empty, Row, Skeleton, Statistic, Table, Typography, Button } from 'antd';
import { BookMarked, Users, AlertTriangle, Wallet } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Line, LineChart } from 'recharts';
import { useState } from 'react';
import dayjs from 'dayjs';
import api from '../services/api.js';
import BarcodeTools from '../components/BarcodeTools.jsx';
import CirculationDrawer from '../components/CirculationDrawer.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { formatMoney } from '../utils/format.js';

export default function DashboardPage() {
  const { user } = useAuth();
  const [counter, setCounter] = useState(false);
  const isLibrarian = user.role === 'LIBRARIAN';
  const dash = useQuery({ queryKey: ['dash'], queryFn: async () => (await api.get('/analytics/dashboard')).data });
  const today = useQuery({
    queryKey: ['today'],
    queryFn: async () => (await api.get('/circulation/today')).data,
    enabled: isLibrarian,
  });
  const k = dash.data?.kpis || {};
  const monthly = (dash.data?.charts?.monthly || []).map((m) => ({
    name: `${m._id?.m}/${m._id?.y}`,
    issues: m.issues,
  }));
  const cats = (dash.data?.charts?.categoryPop || []).map((c) => ({ name: c._id, count: c.count }));
  const rev = (dash.data?.charts?.revenueMonthly || []).map((m) => ({
    name: `${m._id?.m}/${m._id?.y}`,
    amount: m.amount,
  }));

  const staffCards = [
    ['Total users', k.totalUsers],
    ['Members', k.totalMembers],
    ['Students', k.totalStudents],
    ['Librarians', k.totalLibrarians],
    ['Active accounts', k.activeUsers],
    ['Total books', k.totalBooks],
    ['Available titles', k.availableBooks],
    ['Issued', k.issuedBooks],
    ['Returned', k.returnedBooks],
    ['Overdue', k.overdueBooks],
    ['Reservations', k.reservedBooks],
    ['Wishlist activity', k.wishlistCount],
    ['Cart activity', k.cartCount],
    ['Downloads', k.downloads],
    ['New readers (7d)', k.recentRegistrations],
  ];

  if (dash.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Unable to load dashboard statistics."
        action={<Button onClick={() => dash.refetch()}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-4 page-fade">
      <div className="flex flex-wrap items-center justify-between gap-3 anim-fade-in">
        <Typography.Title level={3} className="!mb-0">
          {isLibrarian ? 'Librarian operations' : 'Admin operations'}
        </Typography.Title>
        <Button type="primary" className="anim-btn" onClick={() => setCounter(true)}>
          Open counter
        </Button>
      </div>
      <Card title="Scan or upload barcode" className="hover-card">
        <BarcodeTools />
      </Card>
      {dash.isLoading ? (
        <Row gutter={[16, 16]}>
          {[0, 1, 2, 3].map((i) => (
            <Col xs={24} sm={12} lg={6} key={i}>
              <Card className="hover-card">
                <Skeleton active paragraph={{ rows: 2 }} />
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <>
          <Row gutter={[16, 16]} className="stagger-container">
            <Col xs={24} sm={12} lg={6}>
              <Card className="hover-card">
                <Statistic title="Active loans" value={k.activeLoans ?? 0} prefix={<BookMarked size={16} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="hover-card">
                <Statistic title="Overdue" value={k.overdueBooks ?? 0} prefix={<AlertTriangle size={16} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="hover-card">
                <Statistic title="Patrons" value={(k.totalMembers || 0) + (k.totalStudents || 0)} prefix={<Users size={16} />} />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className="hover-card">
                <Statistic title="Fine revenue" value={formatMoney(k.revenue || 0)} prefix={<Wallet size={16} />} />
              </Card>
            </Col>
          </Row>
          <Row gutter={[16, 16]} className="stagger-container">
            {staffCards.map(([title, value]) => (
              <Col xs={12} md={8} lg={4} key={title}>
                <Card className="hover-card ql-stat-card">
                  <Statistic title={title} value={value ?? 0} />
                </Card>
              </Col>
            ))}
          </Row>
        </>
      )}
      {isLibrarian && (
        <Row gutter={16} className="stagger-container">
          <Col xs={24} md={8}><Card className="hover-card"><Statistic title="Issued today" value={today.data?.issued || 0} /></Card></Col>
          <Col xs={24} md={8}><Card className="hover-card"><Statistic title="Returned today" value={today.data?.returned || 0} /></Card></Col>
          <Col xs={24} md={8}><Card className="hover-card"><Statistic title="Overdue now" value={today.data?.overdue || 0} /></Card></Col>
        </Row>
      )}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title="Recent issues" className="hover-card">
            <div className="overflow-auto">
              <Table
                size="small"
                rowKey={(r) => r._id}
                pagination={false}
                dataSource={dash.data?.recent?.issues || []}
                locale={{ emptyText: <Empty description="No issues yet." /> }}
                columns={[
                  { title: 'Book', render: (_, r) => r.bookId?.title || '—' },
                  { title: 'Reader', render: (_, r) => r.userId?.name || '—' },
                  { title: 'When', dataIndex: 'issueDate', render: (v) => (v ? dayjs(v).format('DD MMM') : '—') },
                ]}
              />
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent returns" className="hover-card">
            <div className="overflow-auto">
              <Table
                size="small"
                rowKey={(r) => r._id}
                pagination={false}
                dataSource={dash.data?.recent?.returns || []}
                locale={{ emptyText: <Empty description="No returns yet." /> }}
                columns={[
                  { title: 'Book', render: (_, r) => r.bookId?.title || '—' },
                  { title: 'Reader', render: (_, r) => r.userId?.name || '—' },
                  { title: 'When', dataIndex: 'returnDate', render: (v) => (v ? dayjs(v).format('DD MMM') : '—') },
                ]}
              />
            </div>
          </Card>
        </Col>
      </Row>
      {!isLibrarian && (
        <Card title="Recent registrations" className="hover-card">
          <div className="overflow-auto">
            <Table
              size="small"
              rowKey="_id"
              pagination={false}
              dataSource={dash.data?.recent?.users || []}
              locale={{ emptyText: <Empty description="No new patrons this week." /> }}
              columns={[
                { title: 'Name', dataIndex: 'name' },
                { title: 'Email', dataIndex: 'email' },
                { title: 'Role', dataIndex: 'role' },
                { title: 'Joined', dataIndex: 'createdAt', render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
              ]}
            />
          </div>
        </Card>
      )}
      <Row gutter={[16, 16]} className="stagger-container">
        <Col xs={24} lg={12}>
          <Card title="Monthly circulation" className="hover-card">
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={monthly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="issues" stroke="#c9a15a" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Category popularity" className="hover-card">
            <div className="h-72">
              <ResponsiveContainer>
                <BarChart data={cats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" fill="#17375c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
        <Col xs={24}>
          <Card title="Fine revenue by month" className="hover-card">
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={rev}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="amount" fill="#c9a15a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Col>
      </Row>
      <CirculationDrawer open={counter} onClose={() => setCounter(false)} />
    </div>
  );
}
