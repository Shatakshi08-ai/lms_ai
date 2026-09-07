import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Col, Row, Pagination, Typography, Empty, Skeleton, message, Alert } from 'antd';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import BookCard from '../components/BookCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function FreeBooksPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const wish = useQuery({
    queryKey: ['wishlist-ids'],
    queryFn: async () => (await api.get('/books/wishlist/ids')).data,
    enabled: Boolean(user),
  });
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['free-books', page],
    queryFn: async () => (await api.get('/books/free', { params: { page, limit: 12 } })).data,
  });
  const toggle = useMutation({
    mutationFn: async ({ book, on }) => {
      if (!user) {
        nav('/login');
        throw new Error('auth');
      }
      if (on) await api.post(`/books/${book._id}/wishlist`);
      else await api.delete(`/books/${book._id}/wishlist`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['wishlist-ids'] }),
    onError: (e) => {
      if (e.message !== 'auth') message.error(e.response?.data?.message || 'Wishlist update failed');
    },
  });
  const saved = new Set(wish.data?.ids || []);

  return (
    <div className="page-fade">
      <Typography.Title level={3}>Free Books</Typography.Title>
      <Typography.Paragraph className="!text-[color:var(--muted-text)]">
        Public-domain titles you can read inside QuestLearn. Full text is loaded from Project Gutenberg.
      </Typography.Paragraph>
      {isError && <Alert type="error" showIcon className="mb-4" message={error.response?.data?.message || 'Could not load free books.'} />}
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : (
        <>
          <p className="mb-3 text-sm text-[color:var(--muted-text)]">{data?.total || 0} free titles</p>
          <Row gutter={[16, 16]}>
            {(data?.items || []).map((b) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={b._id}>
                <BookCard
                  book={b}
                  wishlisted={saved.has(String(b._id))}
                  onWishlist={(book, on) => toggle.mutate({ book, on })}
                />
              </Col>
            ))}
          </Row>
          {!data?.items?.length && <Empty className="py-12" description="No free books yet. Run npm run seed:catalog." />}
          <div className="mt-6 flex justify-center">
            <Pagination current={page} total={data?.total || 0} pageSize={12} onChange={setPage} showSizeChanger={false} />
          </div>
        </>
      )}
    </div>
  );
}
