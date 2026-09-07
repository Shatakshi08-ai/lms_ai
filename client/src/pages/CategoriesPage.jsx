import { useQuery } from '@tanstack/react-query';
import { Input, Typography, Empty, Skeleton } from 'antd';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';

export default function CategoriesPage() {
  const [q, setQ] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['book-categories'],
    queryFn: async () => (await api.get('/books/categories')).data,
  });
  const list = useMemo(() => {
    const items = data?.categories || [];
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((c) => c.name.toLowerCase().includes(term));
  }, [data, q]);

  return (
    <div className="page-fade">
      <Typography.Title level={3}>Categories</Typography.Title>
      <Typography.Paragraph className="!text-[color:var(--muted-text)]">
        Browse by subject. Selecting a category opens matching titles in Books.
      </Typography.Paragraph>
      <Input.Search
        className="mb-4 max-w-md"
        allowClear
        placeholder="Search categories"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        aria-label="Search categories"
      />
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton.Button key={i} active block style={{ height: 88 }} />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((cat) => (
            <Link key={cat.name} className="category-card" to={`/catalog?genre=${encodeURIComponent(cat.name)}`}>
              <div className="text-xs uppercase tracking-wide text-[color:var(--muted-text)]">Category</div>
              <div className="mt-1 text-base font-semibold">{cat.name}</div>
              <div className="mt-1 text-sm text-[color:var(--muted-text)]">{cat.count} titles</div>
            </Link>
          ))}
        </div>
      )}
      {!isLoading && !list.length && <Empty className="py-10" description="No matching categories." />}
    </div>
  );
}
