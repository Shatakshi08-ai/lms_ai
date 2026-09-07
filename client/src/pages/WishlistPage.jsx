import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Col, Row, Pagination, Typography, Empty, Skeleton, message, Alert } from 'antd';
import { useState } from 'react';
import api from '../services/api.js';
import BookCard from '../components/BookCard.jsx';

export default function WishlistPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['wishlist', page],
    queryFn: async () => (await api.get('/books/wishlist', { params: { page } })).data,
  });
  const wishlistItems = Array.isArray(data?.items) ? data.items : [];
  const toggle = useMutation({
    mutationFn: async ({ book }) => api.delete(`/books/${book._id}/wishlist`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wishlist'] });
      qc.invalidateQueries({ queryKey: ['wishlist-ids'] });
      qc.invalidateQueries({ queryKey: ['patron-home'] });
      message.success('Removed from wishlist');
    },
    onError: (e) => message.error(e.response?.data?.message || 'Could not update wishlist'),
  });

  return (
    <div className="page-fade">
      <Typography.Title level={3}>My Wishlist</Typography.Title>
      <Typography.Paragraph className="!text-[color:var(--muted-text)]">
        Titles you saved stay here after you sign out and back in.
      </Typography.Paragraph>
      {isError && (
        <Alert className="mb-4" type="error" showIcon message="Could not load your wishlist." action={<button type="button" onClick={() => refetch()}>Retry</button>} />
      )}
      {isLoading ? (
        <Skeleton active />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {wishlistItems.map((b) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={b._id}>
                <BookCard book={b} wishlisted onWishlist={(book) => toggle.mutate({ book })} />
              </Col>
            ))}
          </Row>
          {!wishlistItems.length && (
            <Empty className="py-12" description="Your wishlist is empty. Add books you want to read later." />
          )}
          <div className="mt-6 flex justify-center">
            <Pagination current={page} total={data?.total || 0} pageSize={12} onChange={setPage} showSizeChanger={false} />
          </div>
        </>
      )}
    </div>
  );
}
