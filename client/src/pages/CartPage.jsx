import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Empty, Modal, Skeleton, Tag, Typography, message } from 'antd';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import api from '../services/api.js';
import { downloadBookPdf } from '../services/downloadPdf.js';

const FALLBACK = 'https://www.gutenberg.org/pics/logo-144x144.png';

export default function CartPage() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['cart'],
    queryFn: async () => (await api.get('/books/cart')).data,
  });
  const remove = useMutation({
    mutationFn: (id) => api.delete(`/books/${id}/cart`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['cart-ids'] });
      qc.invalidateQueries({ queryKey: ['patron-home'] });
      message.success('Removed from cart.');
    },
  });
  const clear = useMutation({
    mutationFn: () => api.delete('/books/cart'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cart'] });
      qc.invalidateQueries({ queryKey: ['cart-ids'] });
      message.success('Cart cleared');
    },
  });

  const items = data?.items || [];

  function confirmRemove(b) {
    Modal.confirm({
      title: 'Remove from cart?',
      content: b.title,
      okText: 'Remove',
      okButtonProps: { danger: true },
      onOk: () => remove.mutateAsync(b._id),
    });
  }

  return (
    <div className="page-fade">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Typography.Title level={3} className="!mb-1">
            Book cart
          </Typography.Title>
          <p className="text-[color:var(--muted-text)] m-0">
            A shortlist for the counter. Adding a title here does not borrow it.
          </p>
        </div>
        <Button disabled={!items.length} onClick={() => clear.mutate()} loading={clear.isPending}>
          Clear cart
        </Button>
      </div>
      {isLoading && <Skeleton active />}
      {isError && (
        <p>
          Unable to load cart. <Button onClick={() => refetch()}>Retry</Button>
        </p>
      )}
      {!isLoading && !items.length && (
        <Empty description="Your cart is empty. Explore books and add your favorites to your cart." />
      )}
      <div className="ql-cart-grid">
        {items.map((b) => (
          <article key={b._id} className="ql-cart-card">
            <Link to={`/catalog/${b._id}`} className="ql-cart-cover">
              <img alt={b.title} src={b.coverImage || FALLBACK} />
            </Link>
            <div className="ql-cart-body">
              <h3>{b.title}</h3>
              <p>{(b.authors || []).join(', ') || 'Unknown author'}</p>
              <div className="flex flex-wrap gap-1">
                {b.category && <Tag>{b.category}</Tag>}
                <Tag color={b.availableCopies > 0 ? 'green' : 'red'}>
                  {b.availableCopies > 0 ? `${b.availableCopies} available` : 'Unavailable'}
                </Tag>
                {b.isFree && <Tag color="gold">Free</Tag>}
              </div>
              {b.addedAt && (
                <p className="mt-1 text-xs text-[color:var(--muted-text)]">Added {dayjs(b.addedAt).format('DD MMM YYYY, hh:mm A')}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to={`/catalog/${b._id}`}>
                  <Button type="primary">View</Button>
                </Link>
                {(b.isFree || b.gutenbergId) && (
                  <Link to={`/catalog/${b._id}/read`}>
                    <Button>Read</Button>
                  </Link>
                )}
                {(b.isFree || b.gutenbergId) && (
                  <Button
                    onClick={() =>
                      downloadBookPdf(b._id, b.title).catch((e) => message.error(e.message || 'Download failed'))
                    }
                  >
                    Download
                  </Button>
                )}
                <Button danger onClick={() => confirmRemove(b)} loading={remove.isPending}>
                  Remove from Cart
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
