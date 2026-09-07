import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import ElenaChat from '../components/ElenaChat.jsx';
import LandingNav from './LandingNav.jsx';
import HeroSection from './HeroSection.jsx';
import StatsSection from './StatsSection.jsx';
import { VisitorBooks, TrendingBooks } from './BookSections.jsx';
import CategoriesSection from './CategoriesSection.jsx';
import { FeaturesSection, ElenaSection, HowItWorks } from './FeaturesSection.jsx';
import { UpcomingSection, ReviewsSection, CTASection, LandingFooter } from './MoreSections.jsx';
import './landing.css';

export default function LandingPage() {
  const loc = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    document.title = 'QuestLearn – Your Digital Library & Learning Companion';
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nodes = document.querySelectorAll('.ql-reveal');
    if (reduce) {
      nodes.forEach((el) => el.classList.add('is-in'));
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('is-in');
        });
      },
      { threshold: 0.12 },
    );
    nodes.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [loc.pathname]);

  useEffect(() => {
    const hash = loc.hash?.replace('#', '');
    const id = loc.pathname === '/about' ? 'about' : loc.pathname === '/contact' ? 'contact' : hash;
    if (!id) {
      window.scrollTo(0, 0);
      return;
    }
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 80);
    return () => clearTimeout(t);
  }, [loc.pathname, loc.hash]);

  return (
    <div className="ql-landing">
      <LandingNav transparent />
      <main>
        <HeroSection />
        <StatsSection />
        <VisitorBooks />
        <CategoriesSection />
        <TrendingBooks />
        <FeaturesSection />
        <ElenaSection />
        <HowItWorks />
        <UpcomingSection />
        <ReviewsSection />
        <CTASection />
      </main>
      <LandingFooter />
      {user && <ElenaChat />}
    </div>
  );
}
