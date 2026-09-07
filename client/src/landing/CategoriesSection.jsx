import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import api from '../services/api.js';

const SHOWCASE = [
  'Adventure',
  'African-American Studies',
  'Art',
  'Banned Books',
  'Biography',
  'Business',
  'Canadian Literature',
  'Classic',
  'Computers',
  'Cooking',
  'Correspondence',
  'Creative Writing',
  'Fiction',
  'History',
  'Romance',
  'Science',
  'Technology',
  'Young Adult',
];

export default function CategoriesSection() {
  const { data, isError, isLoading, refetch } = useQuery({
    queryKey: ['book-categories'],
    queryFn: async () => (await api.get('/books/categories')).data,
  });
  const counts = Object.fromEntries((data?.categories || []).map((c) => [c.name, c.count]));
  const live = (data?.categories || []).filter((c) => c.count > 0);
  const items = [
    ...SHOWCASE.map((name) => ({ name, count: counts[name] || 0 })),
    ...live.filter((c) => !SHOWCASE.includes(c.name)),
  ].slice(0, 18);

  return (
    <section className="ql-section ql-reveal" id="categories-preview">
      <div className="ql-container">
        <h2>Explore by Category</h2>
        {isError && (
          <div className="ql-error">
            Unable to load this section. Please try again.
            <button type="button" onClick={() => refetch()}>Retry</button>
          </div>
        )}
        {isLoading ? (
          <div className="ql-cat-grid">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="ql-skel" />)}</div>
        ) : items.length ? (
          <div className="ql-cat-grid">
            {items.map((c) => (
              <Link key={c.name} className="ql-cat-card" to={`/catalog?genre=${encodeURIComponent(c.name)}`}>
                <span>{c.name}</span>
                <small>{c.count ? `${c.count} titles` : 'Browse this subject'}</small>
              </Link>
            ))}
          </div>
        ) : (
          <p className="ql-empty">Categories will appear once the catalog is available.</p>
        )}
      </div>
    </section>
  );
}
