import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { message } from 'antd';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import BookCard from '../components/BookCard.jsx';
import AuthPrompt from '../components/AuthPrompt.jsx';

function SectionFrame({ title, id, children, error, onRetry, loading, lead }) {
  return (
    <section className="ql-section ql-reveal" id={id}>
      <div className="ql-container">
        <h2>{title}</h2>
        {lead ? <p className="ql-section-lead">{lead}</p> : null}
        {error && (
          <div className="ql-error">
            Unable to load this section. Please try again.
            <button type="button" onClick={onRetry}>Retry</button>
          </div>
        )}
        {loading ? <div className="ql-skel-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ql-skel" />)}</div> : children}
      </div>
    </section>
  );
}

function useWish() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const ids = useQuery({
    queryKey: ['wishlist-ids'],
    queryFn: async () => (await api.get('/books/wishlist/ids')).data,
    enabled: Boolean(user),
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
  return { saved: new Set(ids.data?.ids || []), toggle };
}

function Grid({ items, saved, toggle, locked, onLocked }) {
  if (!items?.length) return <p className="ql-empty">No titles to show yet.</p>;
  return (
    <div className="ql-book-grid">
      {items.map((b) => (
        <BookCard
          key={b._id}
          book={b}
          locked={locked || b.locked}
          onLocked={onLocked}
          wishlisted={saved.has(String(b._id))}
          onWishlist={(book, on) => toggle.mutate({ book, on })}
        />
      ))}
    </div>
  );
}

export function VisitorBooks() {
  const q = useQuery({
    queryKey: ['landing-visitor'],
    queryFn: async () => (await api.get('/books/visitor')).data,
  });
  const { saved, toggle } = useWish();
  return (
    <SectionFrame
      id="visitor-books"
      title="Visitor Collection"
      lead="Guests can preview 10 titles. Register or log in to open the full QuestLearn library."
      error={q.isError}
      onRetry={q.refetch}
      loading={q.isLoading}
    >
      <Grid items={(q.data?.items || []).slice(0, 10)} saved={saved} toggle={toggle} />
    </SectionFrame>
  );
}

export function TrendingBooks() {
  const { user } = useAuth();
  const [gate, setGate] = useState(false);
  const q = useQuery({
    queryKey: ['landing-trending', Boolean(user)],
    queryFn: async () => (await api.get('/books', { params: { limit: 8, preview: user ? undefined : 'trending', sort: 'rating' } })).data,
  });
  const { saved, toggle } = useWish();
  return (
    <SectionFrame id="trending" title="Trending Books" error={q.isError} onRetry={q.refetch} loading={q.isLoading}>
      <Grid
        items={q.data?.items}
        saved={saved}
        toggle={toggle}
        locked={!user}
        onLocked={() => setGate(true)}
      />
      <div className="ql-center">
        {user ? (
          <Link className="ql-btn ql-btn-navy" to="/catalog">View All Books</Link>
        ) : (
          <button type="button" className="ql-btn ql-btn-navy" onClick={() => setGate(true)}>View All Books</button>
        )}
      </div>
      <AuthPrompt open={gate} onClose={() => setGate(false)} />
    </SectionFrame>
  );
}
