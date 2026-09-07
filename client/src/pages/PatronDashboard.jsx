import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Card, Col, Empty, Row, Skeleton, Statistic, Table, Tag, Timeline, Typography } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { dueBadge, formatMoney } from '../utils/format.js';
import BookCard from '../components/BookCard.jsx';

export default function PatronDashboard() {
  const { user } = useAuth();
  const home = useQuery({
    queryKey: ['patron-home'],
    queryFn: async () => (await api.get('/analytics/me')).data,
  });
  const rec = useQuery({
    queryKey: ['rec'],
    queryFn: async () => (await api.post('/ai/recommend', {})).data,
  });
  const d = home.data;
  const roleWord = user.role === 'MEMBER' ? 'Member' : 'Student';
  const s = d?.stats || {};

  if (home.isError) {
    return (
      <Alert
        type="error"
        showIcon
        message="Unable to load your dashboard. Please try again."
        action={<Button onClick={() => home.refetch()}>Retry</Button>}
      />
    );
  }

  return (
    <div className="space-y-4 page-fade">
      <div className="anim-fade-in">
        <Typography.Title level={3} className="!mb-1">
          {roleWord} dashboard
        </Typography.Title>
        <p className="text-[color:var(--muted-text)]">
          {d?.profile?.name || user.name} · {d?.profile?.email || user.email} · {d?.profile?.readerId || user.readerId} · {user.status}
        </p>
      </div>
      {s.pendingFine > 0 && (
        <Alert type="warning" showIcon message={`Outstanding fines ${formatMoney(s.pendingFine)}. Settle them before new issues if the library threshold is crossed.`} />
      )}
      {home.isLoading ? (
        <Skeleton active />
      ) : (
        <>
          <Row gutter={[16, 16]} className="stagger-container">
            {[
              ['Issued now', s.issued],
              ['Returned', s.returned],
              ['Overdue', s.overdue],
              ['Due soon', s.dueSoon],
              ['Reservations', s.reservations],
              ['Remaining borrows', s.remainingBorrows],
            ].map(([title, value]) => (
              <Col xs={12} md={8} lg={4} key={title}>
                <Card className="hover-card ql-stat-card">
                  <Statistic title={title} value={value ?? 0} />
                </Card>
              </Col>
            ))}
          </Row>
          <Card title="Profile" className="hover-card">
            <p className="m-0">
              Phone: {d.profile?.phone || 'Not set'} · Department: {d.profile?.department || '—'} · Member since{' '}
              {d.profile?.createdAt ? dayjs(d.profile.createdAt).format('DD MMM YYYY') : '—'} · Loan period {s.loanPeriodDays} days ·
              Max renewals {s.maxRenewals}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Link to="/profile">Edit profile</Link>
              <Link to="/cart">Cart ({s.cart || 0})</Link>
              <Link to="/wishlist">Wishlist ({s.wishlist || 0})</Link>
              <Link to="/loans">My loans</Link>
            </div>
          </Card>
          <Card title="Currently issued" className="hover-card">
            <Row gutter={[16, 16]}>
              {(d.issued || []).map((l) => {
                const b = dueBadge(l.dueDate);
                return (
                  <Col xs={24} sm={12} lg={8} key={l._id}>
                    {l.bookId ? (
                      <BookCard book={l.bookId} extra={<Tag color={b.color}>{b.text}</Tag>} coverClass="h-36" />
                    ) : (
                      <Card>Unknown title</Card>
                    )}
                  </Col>
                );
              })}
            </Row>
            {!d.issued?.length && <Empty description="No books currently issued." />}
          </Card>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <Card title="Reserved" className="hover-card">
                {(d.reservations || []).map((r) => (
                  <div key={r._id} className="mb-2">
                    {r.bookId?.title || 'Title'} · {r.status}
                  </div>
                ))}
                {!d.reservations?.length && <Empty description="No reservations." />}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="Notifications" className="hover-card">
                {(d.notifications || []).map((n) => (
                  <div key={n._id} className="mb-2">
                    <strong>{n.title}</strong>
                    <div className="text-sm text-[color:var(--muted-text)]">{n.body}</div>
                  </div>
                ))}
                {!d.notifications?.length && <Empty description="No notifications yet." />}
              </Card>
            </Col>
          </Row>
          <Card title="My wishlist" className="hover-card">
            <Row gutter={[12, 12]}>
              {(d.wishlist || []).map((b) => (
                <Col xs={12} md={8} lg={6} key={b._id}>
                  <BookCard book={b} coverClass="h-28" />
                </Col>
              ))}
            </Row>
            {!(d.wishlist || []).length && (
              <Empty
                description={
                  <span>
                    Wishlist is empty. <Link to="/catalog">Browse books</Link>
                  </span>
                }
              />
            )}
          </Card>
          <Card title="Recently viewed" className="hover-card">
            <Row gutter={[12, 12]}>
              {(d.recentViews || []).map((b) => (
                <Col xs={12} md={8} lg={6} key={b._id}>
                  <BookCard book={b} coverClass="h-28" />
                </Col>
              ))}
            </Row>
            {!(d.recentViews || []).length && <Empty description="Open a book to see it here." />}
          </Card>
          <Card title="Book cart" className="hover-card">
            <Row gutter={[12, 12]}>
              {(d.cart || []).map((b) => (
                <Col xs={12} md={8} lg={6} key={b._id}>
                  <BookCard book={b} coverClass="h-28" />
                </Col>
              ))}
            </Row>
            {!d.cart?.length && (
              <Empty
                description={
                  <span>
                    Cart is empty. <Link to="/catalog">Browse books</Link>
                  </span>
                }
              />
            )}
          </Card>
          <Card title="Recommended for you" className="hover-card">
            <Row gutter={[12, 12]} className="stagger-container">
              {(rec.data?.recommendations || []).map((b) => (
                <Col xs={12} md={8} lg={6} key={b._id}>
                  <BookCard book={b} extra={<Tag>affinity {b.affinityScore}</Tag>} coverClass="h-28" />
                </Col>
              ))}
            </Row>
            {rec.isError && <Alert type="error" message="Unable to load recommendations." />}
            {!rec.isLoading && !rec.data?.recommendations?.length && <Empty description="No recommendations yet. Set genres in Preferences." />}
          </Card>
          <Card title="Upcoming books" className="hover-card">
            <Row gutter={[12, 12]}>
              {(d.upcoming || []).map((b) => (
                <Col xs={12} md={8} lg={6} key={b._id}>
                  <BookCard book={b} coverClass="h-28" />
                </Col>
              ))}
            </Row>
            {!d.upcoming?.length && <Empty description="No upcoming titles." />}
          </Card>
          <Card title="Borrowing history" className="hover-card">
            <div className="overflow-auto">
              <Table
                rowKey="_id"
                pagination={{ pageSize: 6 }}
                dataSource={d.history || []}
                columns={[
                  { title: 'Title', render: (_, r) => r.bookId?.title || '—' },
                  { title: 'Status', dataIndex: 'status' },
                  { title: 'Issued', dataIndex: 'issueDate', render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
                  { title: 'Due', dataIndex: 'dueDate', render: (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—') },
                ]}
              />
            </div>
          </Card>
          <Card title="Activity" className="hover-card">
            <Timeline
              items={(d.history || []).slice(0, 10).map((l) => ({
                children: `${l.bookId?.title || 'Book'} · ${l.status} · ${dayjs(l.issueDate).format('DD MMM YYYY')}`,
              }))}
            />
          </Card>
        </>
      )}
    </div>
  );
}
