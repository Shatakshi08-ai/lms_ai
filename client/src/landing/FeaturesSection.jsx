import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { HeartSave, OpenBook, RenewLoop, ReviewStar, SearchGlow } from '../assets/svgator/index.js';
import { ELENA_AVATAR } from '../constants/elena.js';

const FEATURES = [
  { title: 'Smart Book Search', text: 'Find books quickly by title, author, ISBN, or category.', Icon: SearchGlow },
  { title: 'Online Reading', text: 'Read available digital books directly through QuestLearn.', Icon: OpenBook },
  { title: 'Wishlist', text: 'Save books for later and pick up your list after you sign back in.', Icon: HeartSave },
  { title: 'Return & Renew', text: 'Manage borrowed books easily from your loans and circulation desk.', Icon: RenewLoop },
  { title: 'Book Reviews', text: 'Rate and review titles so other readers can follow your path.', Icon: ReviewStar },
  { title: 'Elena AI Assistant', text: 'Get assistance from your AI library assistant.', photo: ELENA_AVATAR },
];

export function FeaturesSection() {
  return (
    <section className="ql-section ql-reveal" id="about">
      <div className="ql-container">
        <p className="ql-kicker">Why QuestLearn</p>
        <h2>Everything You Need for Your Reading Journey</h2>
        <div className="ql-feat-grid">
          {FEATURES.map((f) => (
            <article key={f.title} className="ql-feat-card">
              {f.photo ? (
                <img className="ql-elena-mini" src={f.photo} alt="Elena, QuestLearn AI assistant" />
              ) : (
                <f.Icon className="ql-feat-svg" />
              )}
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ElenaSection() {
  const { user } = useAuth();
  const nav = useNavigate();

  function openElena() {
    sessionStorage.setItem('elenaOpen', '1');
    if (!user) {
      nav('/login?next=/app');
      return;
    }
    nav('/app');
    setTimeout(() => window.dispatchEvent(new Event('elena:open')), 400);
  }

  return (
    <section className="ql-elena-band ql-reveal">
      <div className="ql-container ql-elena-inner">
        <div>
          <h2>Meet Elena</h2>
          <p className="ql-kicker">Your AI-Powered Library Assistant</p>
          <p>Elena helps you discover books, navigate QuestLearn, and get assistance with your library and learning journey.</p>
          <button type="button" className="ql-btn ql-btn-gold" onClick={openElena}>Chat with Elena</button>
        </div>
        <img className="ql-elena-art ql-elena-photo" src={ELENA_AVATAR} alt="Elena, QuestLearn AI assistant" />
      </div>
    </section>
  );
}

export function HowItWorks() {
  const steps = [
    ['01', 'Create Your Account', 'Join QuestLearn and receive your reader identity.'],
    ['02', 'Discover Books', 'Search the catalog and explore by category.'],
    ['03', 'Read or Borrow', 'Open digital titles or borrow from the shelves.'],
    ['04', 'Review & Return', 'Share your thoughts and manage loans with ease.'],
  ];
  return (
    <section className="ql-section ql-reveal">
      <div className="ql-container">
        <h2>How QuestLearn Works</h2>
        <div className="ql-steps">
          <div className="ql-steps-line" aria-hidden="true" />
          {steps.map(([n, t, d]) => (
            <article key={n} className="ql-step">
              <OpenBook className="ql-step-icon" />
              <span>{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
