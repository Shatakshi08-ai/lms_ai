import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api.js';

function useCount(target, on) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(Number(target) || 0);
      return undefined;
    }
    const end = Number(target) || 0;
    const start = performance.now();
    let raf;
    function tick(now) {
      const p = Math.min(1, (now - start) / 1200);
      setN(Math.round(end * (1 - (1 - p) ** 2)));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, on]);
  return n;
}

function Stat({ label, value, on }) {
  const n = useCount(value, on);
  return (
    <div className="ql-stat">
      <strong>{n.toLocaleString()}+</strong>
      <span>{label}</span>
    </div>
  );
}

export default function StatsSection() {
  const ref = useRef(null);
  const [on, setOn] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['public-stats'],
    queryFn: async () => (await api.get('/public/stats')).data,
  });
  const s = data?.stats || { books: 1000, members: 500, categories: 20, reviews: 1000 };

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setOn(true);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="ql-stats ql-reveal" ref={ref} aria-label="QuestLearn statistics">
      {isError && (
        <div className="ql-error">
          Unable to load this section. Please try again.
          <button type="button" onClick={() => refetch()}>Retry</button>
        </div>
      )}
      {isLoading && !data ? (
        Array.from({ length: 4 }).map((_, i) => <div key={i} className="ql-skel" />)
      ) : (
        <>
          <Stat label="Books" value={s.books} on={on} />
          <Stat label="Members" value={s.members} on={on} />
          <Stat label="Categories" value={s.categories} on={on} />
          <Stat label="Reviews" value={s.reviews} on={on} />
        </>
      )}
    </section>
  );
}
