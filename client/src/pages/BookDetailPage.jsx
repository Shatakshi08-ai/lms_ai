import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Descriptions, Table, Tag, Typography, message, Alert, Rate, Form, Input, Space, Row, Col, Empty } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useState } from 'react';
import { Heart } from 'lucide-react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isPatron } from '../utils/roles.js';
import BarcodeModal from '../components/BarcodeModal.jsx';
import { downloadBookPdf, readErrorMessage } from '../services/downloadPdf.js';
import BookCard from '../components/BookCard.jsx';
import AuthPrompt from '../components/AuthPrompt.jsx';

const FALLBACK_COVER = 'https://www.gutenberg.org/pics/logo-144x144.png';

export default function BookDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [bc, setBc] = useState(null);
  const [form] = Form.useForm();
  const [pdfBusy, setPdfBusy] = useState(false);

  const { data, isError, error } = useQuery({
    queryKey: ['book', id],
    queryFn: async () => (await api.get(`/books/${id}`)).data,
    retry: false,
  });
  const reviewsQ = useQuery({
    queryKey: ['reviews', id],
    queryFn: async () => (await api.get(`/books/${id}/reviews`)).data,
  });
  const relatedQ = useQuery({
    queryKey: ['related', id],
    queryFn: async () => (await api.get(`/books/${id}/related`)).data,
  });
  const wishQ = useQuery({
    queryKey: ['wishlist-ids'],
    queryFn: async () => (await api.get('/books/wishlist/ids')).data,
    enabled: Boolean(user),
  });
  const progressQ = useQuery({
    queryKey: ['progress', id],
    queryFn: async () => (await api.get(`/books/${id}/progress`)).data,
    enabled: Boolean(user),
  });

  const insights = useMutation({
    mutationFn: async () => (await api.get(`/ai/insights/${id}`)).data,
  });
  const reserve = useMutation({
    mutationFn: async () => api.post('/circulation/reservations', { bookId: id }),
    onSuccess: () => {
      message.success('Reservation placed');
      qc.invalidateQueries({ queryKey: ['book', id] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Failed'),
  });
  const wishlisted = (wishQ.data?.ids || []).includes(String(id));
  const cartQ = useQuery({
    queryKey: ['cart-ids'],
    queryFn: async () => (await api.get('/books/cart/ids')).data,
    enabled: Boolean(user),
  });
  const inCart = (cartQ.data?.ids || []).includes(String(id));
  const cart = useMutation({
    mutationFn: async (on) => {
      if (!user) {
        nav('/login');
        throw new Error('auth');
      }
      if (on) return (await api.post(`/books/${id}/cart`)).data;
      else await api.delete(`/books/${id}/cart`);
    },
    onSuccess: (data, on) => {
      qc.invalidateQueries({ queryKey: ['cart-ids'] });
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['patron-home'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (on && data?.alreadyInCart) message.info(data.message || 'This book is already in your cart.');
      else if (on) message.success(data?.message || 'Book added to your cart successfully. 🛒');
      else message.success('Removed from cart.');
    },
    onError: (e) => {
      if (e.message !== 'auth') message.error(e.response?.data?.message || 'Cart update failed');
    },
  });
  const wish = useMutation({
    mutationFn: async (on) => {
      if (!user) {
        nav('/login');
        throw new Error('auth');
      }
      if (on) await api.post(`/books/${id}/wishlist`);
      else await api.delete(`/books/${id}/wishlist`);
    },
    onSuccess: (_d, on) => {
      qc.invalidateQueries({ queryKey: ['wishlist-ids'] });
      qc.invalidateQueries({ queryKey: ['wishlist'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      message.success(on ? 'Book added to your wishlist. ❤️' : 'Removed from wishlist');
    },
    onError: (e) => {
      if (e.message !== 'auth') message.error(e.response?.data?.message || 'Wishlist update failed');
    },
  });
  const reviewMut = useMutation({
    mutationFn: (v) => api.post(`/books/${id}/reviews`, v),
    onSuccess: () => {
      message.success('Review saved');
      form.resetFields();
      qc.invalidateQueries({ queryKey: ['reviews', id] });
      qc.invalidateQueries({ queryKey: ['book', id] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Could not save review'),
  });
  const delReview = useMutation({
    mutationFn: (reviewId) => api.delete(`/books/${id}/reviews/${reviewId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews', id] });
      qc.invalidateQueries({ queryKey: ['book', id] });
    },
  });

  const book = data?.book;
  if (error?.response?.status === 403 || error?.response?.data?.code === 'LOGIN_REQUIRED') {
    return <AuthPrompt open onClose={() => nav('/')} />;
  }
  if (isError) return <Alert type="error" message="This book could not be loaded." />;
  if (!book) return null;

  const mine = (reviewsQ.data?.items || []).find((r) => String(r.userId?._id || r.userId) === String(user?._id));
  const progress = progressQ.data?.progress;

  return (
    <div className="page-fade grid gap-4 lg:grid-cols-3">
      <Card
        cover={
          <img
            alt=""
            src={book.coverImage || FALLBACK_COVER}
            className="max-h-80 object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              e.currentTarget.src = FALLBACK_COVER;
            }}
          />
        }
        className="lg:col-span-1"
      >
        <Typography.Title level={4}>{book.title}</Typography.Title>
        <p className="text-[color:var(--muted-text)]">{book.subtitle}</p>
        <Space wrap className="mb-2">
          {book.isFree ? <Tag color="green">FREE</Tag> : <Tag>Library</Tag>}
          <Tag>{book.category}</Tag>
          {(book.genres || []).slice(0, 4).map((g) => (
            <Tag key={g} className="genre-tag">{g}</Tag>
          ))}
        </Space>
        <div className="mb-3 flex items-center gap-2">
          <Rate disabled allowHalf value={book.averageRating || 0} />
          <span className="text-sm text-[color:var(--muted-text)]">{book.averageRating || 0} · {book.reviewCount || 0} reviews</span>
        </div>
        <Tag color={book.availableCopies > 0 ? 'green' : 'gold'}>
          {book.status || (book.availableCopies > 0 ? 'Available' : 'Borrowed')} · {book.availableCopies} available / {book.totalCopies}
        </Tag>
        {progress && <p className="mt-2 text-sm">Reading progress: {progress.percent}% (page {progress.page})</p>}
        <Space direction="vertical" className="mt-4 w-full">
          <Button type="primary" block onClick={() => nav(`/catalog/${id}/read`)}>
            {progress?.page > 1 ? 'Continue reading' : 'Read Book'}
          </Button>
          {user && (data?.canDownloadPdf || book.gutenbergId || book.isFree || book.pdfFileName) && (
            <Button
              block
              loading={pdfBusy}
              onClick={async () => {
                setPdfBusy(true);
                try {
                  await downloadBookPdf(id, book.title || book.catalogId);
                  message.success('Download started.');
                } catch (e) {
                  message.error(await readErrorMessage(e, 'PDF download is not available for this title.'));
                } finally {
                  setPdfBusy(false);
                }
              }}
            >
              Download PDF
            </Button>
          )}
          <Button
            block
            icon={<Heart size={16} fill={wishlisted ? 'currentColor' : 'none'} />}
            loading={wish.isPending}
            onClick={() => wish.mutate(!wishlisted)}
          >
            {wishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}
          </Button>
          <Button block loading={cart.isPending} onClick={() => cart.mutate(!inCart)}>
            {inCart ? 'Remove from cart' : 'Add to cart'}
          </Button>
          {isPatron(user) && (
            <Button block onClick={() => reserve.mutate()} loading={reserve.isPending}>
              Reserve in FIFO queue
            </Button>
          )}
        </Space>
      </Card>
      <div className="space-y-4 lg:col-span-2">
        <Card title="Bibliographic record">
          <Descriptions column={{ xs: 1, md: 2 }} bordered size="small">
            <Descriptions.Item label="Book ID">{book.catalogId || '—'}</Descriptions.Item>
            <Descriptions.Item label="Barcode">
              {book.barcode ? <Button type="link" className="p-0" onClick={() => setBc(book.barcode)}>{book.barcode}</Button> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="ISBN">{book.isbn}</Descriptions.Item>
            <Descriptions.Item label="Authors">{(book.authors || []).join(', ')}</Descriptions.Item>
            <Descriptions.Item label="Publisher">{book.publisher}</Descriptions.Item>
            <Descriptions.Item label="Year">{book.publicationYear}</Descriptions.Item>
            <Descriptions.Item label="Shelf">{book.shelfLocation || '—'}</Descriptions.Item>
            <Descriptions.Item label="Language">{book.language}</Descriptions.Item>
            <Descriptions.Item label="Summary" span={2}>{book.summary}</Descriptions.Item>
          </Descriptions>
        </Card>
        <Card title="Write a Review">
          {user ? (
          <Form form={form} layout="vertical" onFinish={(v) => reviewMut.mutate(v)} initialValues={{ rating: mine?.rating || 5, comment: mine?.comment }}>
            <Form.Item name="rating" label="Star rating" rules={[{ required: true }]}>
              <Rate />
            </Form.Item>
            <Form.Item name="comment" label="Review" rules={[{ required: true, min: 8, message: 'Please write at least 8 characters' }]}>
              <Input.TextArea rows={3} placeholder={mine ? 'Update your review' : 'What did you think?'} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={reviewMut.isPending}>
              {mine ? 'Update review' : 'Submit review'}
            </Button>
          </Form>
          ) : (
            <p className="text-[color:var(--muted-text)]">
              <Link to="/login">Sign in</Link> to rate and review this title.
            </p>
          )}
        </Card>
        <Card title="Reviews">
          {(reviewsQ.data?.items || []).map((r) => (
            <div key={r._id} className="mb-4 border-b border-[color:var(--border-color)] pb-3">
              <div className="flex items-center justify-between gap-2">
                <strong>{r.userId?.name || 'Reader'}</strong>
                <span className="text-xs text-[color:var(--muted-text)]">{new Date(r.createdAt).toLocaleDateString()}</span>
              </div>
              <Rate disabled value={r.rating} style={{ fontSize: 14 }} />
              <p className="mb-1">{r.comment}</p>
              {String(r.userId?._id || r.userId) === String(user?._id) && (
                <Button size="small" danger onClick={() => delReview.mutate(r._id)}>Delete</Button>
              )}
            </div>
          ))}
          {!reviewsQ.data?.items?.length && <Empty description="No reviews yet." />}
        </Card>
        <Card
          title="AI insights"
          extra={<Button onClick={() => insights.mutate()} loading={insights.isPending}>Generate</Button>}
        >
          {insights.data ? (
            <>
              <Alert type="info" message={`Reading level: ${insights.data.readingLevel} · ${insights.data.audience}`} className="mb-3" />
              <ul className="list-disc pl-5">
                {(insights.data.takeaways || []).map((t) => <li key={t}>{t}</li>)}
              </ul>
            </>
          ) : (
            <p className="text-[color:var(--muted-text)]">Generate 3 takeaways, reading level, and audience.</p>
          )}
        </Card>
        <Card title="Physical copies" className="overflow-auto">
          <Table
            rowKey="_id"
            dataSource={data.copies}
            pagination={false}
            columns={[
              { title: 'Barcode', dataIndex: 'barcode', render: (v) => v ? <Button type="link" onClick={() => setBc(v)}>{v}</Button> : '—' },
              { title: 'Condition', dataIndex: 'condition' },
              { title: 'Status', dataIndex: 'status', render: (v) => v ? <Tag>{v}</Tag> : '—' },
              { title: 'Shelf', dataIndex: 'shelfLocation' },
            ]}
          />
        </Card>
        <Card title="Related books">
          <Row gutter={[12, 12]}>
            {(relatedQ.data?.items || []).map((b) => (
              <Col xs={12} md={8} lg={6} key={b._id}>
                <BookCard book={b} coverClass="h-28" />
              </Col>
            ))}
          </Row>
          {!relatedQ.data?.items?.length && <Empty description="No related titles yet." />}
        </Card>
      </div>
      <BarcodeModal open={Boolean(bc)} value={bc} onClose={() => setBc(null)} />
    </div>
  );
}
