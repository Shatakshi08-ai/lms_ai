import { useQuery } from '@tanstack/react-query';
import { Col, Row, Typography, Empty } from 'antd';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import BookCard from '../components/BookCard.jsx';

function Section({ title, books }) {
  if (!books?.length) return null;
  return (
    <section className="mb-8">
      <Typography.Title level={4}>{title}</Typography.Title>
      <Row gutter={[16, 16]}>
        {books.map((b) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={b._id}>
            <BookCard book={b} />
          </Col>
        ))}
      </Row>
    </section>
  );
}

export default function UpcomingBooksPage() {
  const { data } = useQuery({
    queryKey: ['upcoming-books'],
    queryFn: async () => (await api.get('/books/upcoming')).data,
  });

  const hasAny = (data?.newReleases || []).length || (data?.comingSoon || []).length || (data?.featured || []).length;

  return (
    <div>
      <Typography.Title level={3}>Upcoming Books</Typography.Title>
      <Typography.Paragraph className="!text-[color:var(--muted-text)]">
        New releases, coming soon titles, and featured picks from the catalog.{' '}
        <Link to="/catalog">Back to all books</Link>
      </Typography.Paragraph>
      {!hasAny && <Empty description="No upcoming titles yet" />}
      <Section title="📚 New Releases" books={data?.newReleases} />
      <Section title="📖 Coming Soon" books={data?.comingSoon} />
      <Section title="⭐ Featured Books" books={data?.featured} />
    </div>
  );
}
