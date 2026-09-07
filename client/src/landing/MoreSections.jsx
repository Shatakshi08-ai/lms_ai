import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Rate } from 'antd';
import api from '../services/api.js';
import QuestLearnLogo from '../components/QuestLearnLogo.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FALLBACK = 'https://www.gutenberg.org/pics/logo-144x144.png';

export function UpcomingSection() {
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ['upcoming-books'],
    queryFn: async () => (await api.get('/books/upcoming')).data,
  });
  const items = [...(data?.comingSoon || []), ...(data?.featured || [])].slice(0, 8);

  return (
    <section className="ql-section ql-reveal">
      <div className="ql-container">
        <h2>Upcoming Books</h2>
        {isError && (
          <div className="ql-error">
            Unable to load this section. Please try again.
            <button type="button" onClick={() => refetch()}>Retry</button>
          </div>
        )}
        {isLoading ? (
          <div className="ql-book-grid">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="ql-skel" />)}</div>
        ) : items.length ? (
          <div className="ql-book-grid">
            {items.map((b) => (
              <Link key={b._id} to={`/catalog/${b._id}`} className="ql-mini-card">
                <img src={b.coverImage || FALLBACK} alt={b.title || 'Upcoming book'} loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = FALLBACK; }} />
                <strong>{b.title}</strong>
                <span>{(b.authors || []).join(', ')}</span>
                <small>{b.releaseDate ? new Date(b.releaseDate).toLocaleDateString() : 'Coming to the shelves'}</small>
              </Link>
            ))}
          </div>
        ) : (
          <p className="ql-empty">No upcoming titles posted yet.</p>
        )}
      </div>
    </section>
  );
}

export function ReviewsSection() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-reviews'],
    queryFn: async () => (await api.get('/public/reviews')).data,
  });
  const items = data?.items || [];

  return (
    <section className="ql-section ql-reveal">
      <div className="ql-container">
        <h2>What Our Readers Say</h2>
        {isError && (
          <div className="ql-error">
            Unable to load this section. Please try again.
            <button type="button" onClick={() => refetch()}>Retry</button>
          </div>
        )}
        {isLoading ? (
          <div className="ql-rev-grid">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="ql-skel" />)}</div>
        ) : items.length ? (
          <div className="ql-rev-grid">
            {items.map((r) => (
              <article key={r._id} className="ql-review-card">
                <div className="ql-avatar">{(r.userId?.name || 'R')[0]}</div>
                <strong>{r.userId?.name || 'Reader'}</strong>
                <p className="ql-book-ref">{r.bookId?.title}</p>
                <Rate disabled value={r.rating} style={{ fontSize: 14 }} />
                <p>{r.comment}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="ql-empty">Be the first to share your reading experience.</p>
        )}
      </div>
    </section>
  );
}

export function CTASection() {
  return (
    <section className="ql-cta ql-reveal">
      <div className="ql-container">
        <h2>Your Next Great Book Is Waiting</h2>
        <p>Join QuestLearn and start your journey through knowledge today.</p>
        <div className="ql-hero-ctas">
          <Link className="ql-btn ql-btn-gold ql-btn-lg" to="/catalog">Explore Books</Link>
          <Link className="ql-btn ql-btn-light ql-btn-lg" to="/register">Create Account</Link>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  const { user } = useAuth();
  const nav = useNavigate();

  function openElena() {
    sessionStorage.setItem('elenaOpen', '1');
    if (!user) {
      nav('/login?next=/app');
      return;
    }
    window.dispatchEvent(new Event('elena:open'));
  }

  return (
    <footer className="ql-footer" id="contact">
      <div className="ql-container ql-footer-grid">
        <div>
          <Link to="/" className="ql-brand" aria-label="QuestLearn home">
            <QuestLearnLogo className="ql-brand-mark" />
            <span><strong>QuestLearn</strong></span>
          </Link>
          <p>Your digital library and learning companion.</p>
        </div>
        <div>
          <h3>Quick Links</h3>
          <Link to="/">Home</Link>
          <Link to="/catalog">Books</Link>
          <Link to="/categories">Categories</Link>
          <Link to="/#trending">Trending Books</Link>
          <Link to="/about">About</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          <button type="button" className="ql-footer-elena" onClick={openElena}>
            Elena AI Assistant
          </button>
        </div>
        <div>
          <h3>Library</h3>
          <Link to="/loans">Return & Renew</Link>
          <Link to="/wishlist">Wishlist</Link>
          <Link to="/catalog">Reviews</Link>
          <Link to="/contact">FAQs</Link>
        </div>
        <div>
          <h3>Account</h3>
          <Link to="/login">Login</Link>
          <Link to="/register">Register</Link>
          <Link to="/app">Dashboard</Link>
          <Link to="/profile">Profile</Link>
        </div>
        <div>
          <h3>Contact</h3>
          <p>Reach your library desk through QuestLearn after you sign in.</p>
        </div>
      </div>
      <p className="ql-copy">© 2026 QuestLearn. All Rights Reserved.</p>
    </footer>
  );
}
