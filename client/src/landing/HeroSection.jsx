import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import QuestLearnLogo from '../components/QuestLearnLogo.jsx';
import { FloatingBooks, OpenBook } from '../assets/svgator/index.js';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Slider Revolution-compatible hero.
 * A licensed Revolution embed can replace `.ql-rev-stage`.
 */
const SLIDES = [
  {
    id: 'discover',
    kicker: 'Discover',
    title: 'Begin Your Quest for Knowledge',
    text: 'Explore thousands of books and discover something new every day.',
    cta: 'Explore Books',
    to: '/catalog',
    image: 'https://images.pexels.com/photos/2041540/pexels-photo-2041540.jpeg?auto=compress&cs=tinysrgb&w=1800',
  },
  {
    id: 'read',
    kicker: 'Read',
    title: 'Read. Learn. Grow.',
    text: 'Access available digital books and continue your learning journey wherever you are.',
    cta: 'Start Reading',
    to: '/free',
    image: 'https://images.pexels.com/photos/1290141/pexels-photo-1290141.jpeg?auto=compress&cs=tinysrgb&w=1800',
  },
  {
    id: 'manage',
    kicker: 'Manage',
    title: 'Your Library, Your Journey',
    text: 'Borrow, renew, wishlist, read, and review books with QuestLearn.',
    cta: 'Join QuestLearn',
    to: '/register',
    image: 'https://images.pexels.com/photos/256541/pexels-photo-256541.jpeg?auto=compress&cs=tinysrgb&w=1800',
  },
];

export default function HeroSection() {
  const [i, setI] = useState(0);
  const [q, setQ] = useState('');
  const [genre, setGenre] = useState('');
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const { user } = useAuth();
  const nav = useNavigate();
  const slide = SLIDES[i];
  const cats = useQuery({
    queryKey: ['book-categories'],
    queryFn: async () => (await api.get('/books/categories')).data,
  });

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setInterval(() => setI((n) => (n + 1) % SLIDES.length), 7500);
    return () => clearInterval(t);
  }, []);

  function onMove(e) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const r = e.currentTarget.getBoundingClientRect();
    setTilt({
      x: ((e.clientX - r.left) / r.width - 0.5) * 8,
      y: ((e.clientY - r.top) / r.height - 0.5) * 8,
    });
  }

  function onSearch(e) {
    e.preventDefault();
    const term = q.trim();
    if (!term && !genre) return;
    const params = new URLSearchParams();
    if (term) params.set('q', term);
    if (genre) params.set('genre', genre);
    nav(`/catalog?${params.toString()}`);
  }

  const joinTo = user ? '/app' : '/register';

  return (
    <section className="ql-hero" aria-roledescription="carousel" aria-label="QuestLearn highlights">
      <div
        className="ql-rev-stage"
        onMouseMove={onMove}
        style={{ '--ql-tilt-x': `${tilt.x}px`, '--ql-tilt-y': `${tilt.y}px` }}
      >
        {SLIDES.map((s, idx) => (
          <div key={s.id} className={`ql-rev-slide ${idx === i ? 'is-active' : ''}`} aria-hidden={idx !== i}>
            <img className="ql-rev-ken" src={s.image} alt="" />
            <div className="ql-rev-shade" />
          </div>
        ))}
        <FloatingBooks className="ql-hero-float" />
        <div className="ql-rev-content">
          <QuestLearnLogo className="ql-hero-logo" animated />
          <div key={slide.id} className="ql-rev-layer">
            <p className="ql-kicker">{slide.kicker}</p>
            <h1>{slide.title}</h1>
            <p className="ql-lead">{slide.text}</p>
            <p className="ql-sub">Discover books, explore new ideas, read online, and manage your library journey — all in one place.</p>
          </div>
          <div className="ql-hero-ctas">
            <Link className="ql-btn ql-btn-gold ql-btn-lg" to="/catalog">Explore Books</Link>
            <Link className="ql-btn ql-btn-light ql-btn-lg" to={joinTo}>
              {user ? 'Go to Dashboard' : 'Join QuestLearn'}
            </Link>
            {slide.to === '/free' && (
              <Link className="ql-btn ql-btn-ghost-light ql-btn-lg" to="/free">Start Reading</Link>
            )}
          </div>
          <form className="ql-hero-search" onSubmit={onSearch}>
            <Search size={18} aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search books, authors, ISBN, or categories..."
              aria-label="Search books, authors, ISBN, or categories"
            />
            <select value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Category">
              <option value="">All categories</option>
              {(cats.data?.categories || [])
                .filter((c) => c.count > 0)
                .slice(0, 40)
                .map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
            </select>
            <button type="submit" className="ql-btn ql-btn-gold">Search</button>
          </form>
          <div className="ql-hero-mark" aria-hidden="true">
            <OpenBook />
          </div>
        </div>
        <div className="ql-rev-dots" role="tablist">
          {SLIDES.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={idx === i}
              className={idx === i ? 'is-active' : ''}
              onClick={() => setI(idx)}
            >
              <span className="sr-only">{s.kicker}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
