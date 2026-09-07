import { Outlet } from 'react-router-dom';
import LandingNav from './LandingNav.jsx';
import { LandingFooter } from './MoreSections.jsx';
import './landing.css';

export default function PublicShell() {
  return (
    <div className="ql-public-shell">
      <LandingNav />
      <div className="ql-public-main">
        <Outlet />
      </div>
      <LandingFooter />
    </div>
  );
}
