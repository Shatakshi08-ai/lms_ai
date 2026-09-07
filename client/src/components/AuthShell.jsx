import { Link } from 'react-router-dom';
import QuestLearnLogo from './QuestLearnLogo.jsx';
import '../landing/landing.css';

export default function AuthShell({ children, shake }) {
  return (
    <div className={`ql-landing min-h-screen ${shake ? 'auth-shake' : ''}`}>
      <header className="ql-nav ql-nav-solid">
        <div className="ql-nav-inner">
          <Link to="/" className="ql-brand" aria-label="QuestLearn home">
            <QuestLearnLogo className="ql-brand-mark" />
            <span>
              <strong>QuestLearn</strong>
              <em>Your Journey to Knowledge Begins Here.</em>
            </span>
          </Link>
          <nav className="ml-auto flex gap-3 text-sm">
            <Link to="/" className="text-white/90">Home</Link>
            <Link to="/login" className="text-white/90">Sign in</Link>
            <Link to="/register" className="text-white/90">Register</Link>
          </nav>
        </div>
      </header>
      <div className="auth-page grid min-h-[calc(100vh-72px)] place-items-center p-4">
        <div className="auth-orb auth-orb-a" aria-hidden />
        <div className="auth-orb auth-orb-b" aria-hidden />
        <div className="auth-orb auth-orb-c" aria-hidden />
        {children}
      </div>
    </div>
  );
}
