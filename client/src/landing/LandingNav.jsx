import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Menu, X, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import QuestLearnLogo from '../components/QuestLearnLogo.jsx';

const LINKS = [
  { to: '/', label: 'Home', hash: '' },
  { to: '/catalog', label: 'Books' },
  { to: '/categories', label: 'Categories' },
  { to: '/about', label: 'About Us' },
  { to: '/upcoming', label: 'Upcoming Books' },
  { to: '/contact', label: 'Contact' },
];

export default function LandingNav({ transparent = false }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 24);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const solid = !transparent || scrolled || open;

  async function onLogout() {
    await logout();
    nav('/');
    setOpen(false);
  }

  return (
    <header className={`ql-nav ${solid ? 'ql-nav-solid' : 'ql-nav-overlay'}`}>
      <div className="ql-nav-inner">
        <Link to="/" className="ql-brand" aria-label="QuestLearn home">
          <QuestLearnLogo className="ql-brand-mark" />
          <span>
            <strong>QuestLearn</strong>
            <em>Your Journey to Knowledge Begins Here.</em>
          </span>
        </Link>
        <nav className="ql-nav-links" aria-label="Primary">
          {LINKS.map((l) => (
            <NavLink key={l.label} to={l.to} className={({ isActive }) => (isActive ? 'is-active' : '')} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="ql-nav-actions">
          <Link to="/catalog" className="ql-icon-btn" aria-label="Search books">
            <Search size={18} />
          </Link>
          {user ? (
            <>
              <Link className="ql-btn ql-btn-ghost" to="/app">Dashboard</Link>
              <Link className="ql-btn ql-btn-ghost" to="/profile">Profile</Link>
              <button type="button" className="ql-btn ql-btn-gold" onClick={onLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link className="ql-btn ql-btn-ghost" to="/login">Login</Link>
              <Link className="ql-btn ql-btn-gold" to="/register">Sign Up</Link>
            </>
          )}
          <button type="button" className="ql-burger" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
      {open && (
        <div className="ql-mobile-menu" role="dialog" aria-label="Mobile navigation">
          {LINKS.map((l, i) => (
            <NavLink key={l.label} to={l.to} style={{ animationDelay: `${i * 40}ms` }} onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <Link to="/app" onClick={() => setOpen(false)}>Dashboard</Link>
              <Link to="/profile" onClick={() => setOpen(false)}>Profile</Link>
              <button type="button" onClick={onLogout}>Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setOpen(false)}>Login</Link>
              <Link to="/register" onClick={() => setOpen(false)}>Sign Up</Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
