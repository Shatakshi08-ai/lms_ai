import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Col, Row, Select, Input, Pagination, Typography, Skeleton, Alert, Button, Empty, message } from 'antd';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDebouncedValue } from '../hooks/useDebouncedValue.js';
import BookCard from '../components/BookCard.jsx';

const PAGE_SIZE = 12;

export default function CatalogPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [genre, setGenre] = useState(params.get('genre') || params.get('category') || '');
  const [page, setPage] = useState(Number(params.get('page') || 1));
  const dq = useDebouncedValue(q);
  const qc = useQueryClient();

  useEffect(() => {
    const next = new URLSearchParams();
    if (dq) next.set('q', dq);
    if (genre) next.set('genre', genre);
    if (page > 1) next.set('page', String(page));
    setParams(next, { replace: true });
  }, [dq, genre, page, setParams]);

  const cats = useQuery({
    queryKey: ['book-categories'],
    queryFn: async () => (await api.get('/books/categories')).data,
  });
  const cartQ = useQuery({
    queryKey: ['cart-ids'],
    queryFn: async () => (await api.get('/books/cart/ids')).data,
    enabled: Boolean(user),
  });
  const wish = useQuery({
    queryKey: ['wishlist-ids'],
    queryFn: async () => (await api.get('/books/wishlist/ids')).data,
    enabled: Boolean(user),
  });
  const { data, isFetching, isError, error, isLoading } = useQuery({
    queryKey: ['books', dq, genre, page],
    queryFn: async () =>
      (await api.get('/books', { params: { q: dq || undefined, genre: genre || undefined, page, limit: PAGE_SIZE } })).data,
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
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['wishlist-ids'] });
      qc.invalidateQueries({ queryKey: ['wishlist'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      message.success(vars.on ? 'Book added to your wishlist. ❤️' : 'Removed from wishlist');
    },
    onError: (e) => {
      if (e.message !== 'auth') message.error(e.response?.data?.message || 'Wishlist update failed');
    },
  });

  const options = [
    { value: '', label: 'All categories' },
    ...((cats.data?.categories || []).filter((c) => c.count > 0).map((c) => ({ value: c.name, label: `${c.name} (${c.count})` }))),
  ];
  const cartMut = useMutation({
    mutationFn: async ({ book, on }) => {
      if (!user) {
        nav('/login');
        throw new Error('auth');
      }
      if (on) return (await api.post(`/books/${book._id}/cart`)).data;
      return (await api.delete(`/books/${book._id}/cart`)).data;
    },
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ queryKey: ['cart-ids'] });
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['notifications'] });
      if (vars.on && data?.alreadyInCart) message.info(data.message || 'This book is already in your cart.');
      else if (vars.on) message.success(data?.message || 'Book added to your cart successfully. 🛒');
      else message.success('Removed from cart.');
    },
    onError: (e) => {
      if (e.message !== 'auth') message.error(e.response?.data?.message || 'Cart update failed');
    },
  });
  const saved = new Set(wish.data?.ids || []);
  const inCart = new Set(cartQ.data?.ids || []);

  function clearFilters() {
    setQ('');
    setGenre('');
    setPage(1);
  }

  return (
    <div className="page-fade">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <Typography.Title level={3} className="!mb-0">
          {genre || 'All Books'}
        </Typography.Title>
        <Link to="/free">Browse free reads</Link>
      </div>
      {data?.visitorLimited && (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="Visitor access is limited to 10 titles. Register or log in to browse the complete QuestLearn library."
        />
      )}
      <div className="mb-4 flex flex-wrap gap-3">
        <Input.Search
          className="max-w-md"
          placeholder="Search title, author, ISBN, Book ID, or barcode"
          allowClear
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          aria-label="Search books"
        />
        <Select
          className="w-64"
          showSearch
          value={genre}
          onChange={(v) => {
            setGenre(v);
            setPage(1);
          }}
          optionFilterProp="label"
          options={options}
          aria-label="Filter by category"
        />
        <Button onClick={clearFilters} disabled={!q && !genre}>
          Clear filters
        </Button>
      </div>
      {isError && <Alert type="error" className="mb-4" showIcon message={error.response?.data?.message || 'Could not load books.'} />}
      {isLoading ? (
        <Row gutter={[16, 16]}>
          {Array.from({ length: 8 }).map((_, i) => (
            <Col xs={24} sm={12} lg={8} xl={6} key={i}>
              <Skeleton active avatar={{ shape: 'square', size: 160 }} paragraph={{ rows: 3 }} />
            </Col>
          ))}
        </Row>
      ) : (
        <>
          <p className="mb-3 text-sm text-[color:var(--muted-text)]">{data?.total || 0} titles</p>
          <Row gutter={[16, 16]}>
            {(data?.items || []).map((b) => (
              <Col xs={24} sm={12} lg={8} xl={6} key={b._id}>
                <BookCard
                  book={b}
                  wishlisted={saved.has(String(b._id))}
                  wishBusy={toggle.isPending && toggle.variables?.book?._id === b._id}
                  onWishlist={(book, on) => toggle.mutate({ book, on })}
                  inCart={inCart.has(String(b._id))}
                  cartBusy={cartMut.isPending && cartMut.variables?.book?._id === b._id}
                  onCart={(book, on) => cartMut.mutate({ book, on })}
                />
              </Col>
            ))}
          </Row>
          {!data?.items?.length && (
            <Empty className="py-12" description="No books found. Try another title, author, or category." />
          )}
        </>
      )}
      {isFetching && !isLoading && <p className="mt-4 text-sm text-[color:var(--muted-text)]">Updating results…</p>}
      <div className="mt-6 flex justify-center">
        <Pagination current={page} total={data?.total || 0} pageSize={PAGE_SIZE} onChange={setPage} showSizeChanger={false} />
      </div>
    </div>
  );
}
