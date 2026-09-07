import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Col, Row, Pagination, Typography, Empty, Skeleton, message, Alert } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import BookCard from '../components/BookCard.jsx';

export default function WishlistPage() {
  const [page, setPage] = useState(1);
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['wishlist', page],
    queryFn: async () => (await api.get('/books/wishlist', { params: { page } })).data,
  });
  const cartQ = useQuery({
    queryKey: ['cart-ids'],
    queryFn: async () => (await api.get('/books/cart/ids')).data,
  });
  const wishlistItems = Array.isArray(data?.items) ? data.items : [];
  const inCart = new Set(cartQ.data?.ids || []);

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

  const cartMut = useMutation({
    mutationFn: async ({ book, on }) => {
      if (on) return (await api.post(`/books/${book._id}/cart`)).data;
      return (await api.delete(`/books/${book._id}/cart`)).data;
    },
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: ['cart-ids'] });
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['patron-home'] });
      if (vars.on && res?.alreadyInCart) message.info(res.message || 'Already in cart.');
      else if (vars.on) message.success(res?.message || 'Book added to your cart.');
      else message.success('Removed from cart.');
    },
    onError: (e) => message.error(e.response?.data?.message || 'Cart update failed'),
  });

  return (
    <div className="page-fade">
      <Typography.Title level={3}>My Wishlist</Typography.Title>
      <Typography.Paragraph className="!text-[color:var(--muted-text)]">
        Titles you saved stay here after you sign out and back in.
      </Typography.Paragraph>
      {isError && (
        <Alert
          className="mb-4"
          type="error"
          showIcon
          message="Could not load your wishlist."
          action={
            <button type="button" onClick={() => refetch()}>
              Retry
            </button>
          }
        />
      )}
      {isLoading ? (
        <Skeleton active />
      ) : (
        <>
          <Row gutter={[16, 16]}>
            {wishlistItems.map((b) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={b._id}>
                <BookCard
                  book={b}
                  wishlisted
                  onWishlist={(book) => toggle.mutate({ book })}
                  wishBusy={toggle.isPending && toggle.variables?.book?._id === b._id}
                  inCart={inCart.has(String(b._id))}
                  onCart={(book, on) => cartMut.mutate({ book, on })}
                  cartBusy={cartMut.isPending && cartMut.variables?.book?._id === b._id}
                />
              </Col>
            ))}
          </Row>
          {!wishlistItems.length && (
            <Empty
              className="py-12"
              description={
                <span>
                  Your wishlist is empty.
                  <br />
                  Start saving books you want to read later.
                  <br />
                  <Link to="/catalog">Browse books</Link>
                </span>
              }
            />
          )}
          <div className="mt-6 flex justify-center">
            <Pagination current={page} total={data?.total || 0} pageSize={12} onChange={setPage} showSizeChanger={false} />
          </div>
        </>
      )}
    </div>
  );
}
