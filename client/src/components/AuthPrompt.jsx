import { Link } from 'react-router-dom';

export const LOGIN_READ_MESSAGE = 'Please register or log in to QuestLearn to access and read this book.';

export default function AuthPrompt({ open, onClose, message = LOGIN_READ_MESSAGE }) {
  if (!open) return null;
  return (
    <div className="ql-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="ql-modal" role="dialog" aria-labelledby="ql-auth-title" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 id="ql-auth-title">Join QuestLearn</h3>
        <p>{message}</p>
        <div className="ql-hero-ctas">
          <Link className="ql-btn ql-btn-gold" to="/register">Register</Link>
          <Link className="ql-btn ql-btn-navy" to="/login">Login</Link>
          <button type="button" className="ql-btn ql-btn-ghost" onClick={onClose} style={{ color: '#0c1d33', borderColor: '#0c1d33' }}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
