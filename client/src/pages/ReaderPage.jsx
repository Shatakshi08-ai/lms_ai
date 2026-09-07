import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Card, Slider, Space, Typography, Alert, Spin, message } from 'antd';
import { Link, useNavigate, useParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { downloadBookPdf, readErrorMessage } from '../services/downloadPdf.js';
import AuthPrompt from '../components/AuthPrompt.jsx';

export default function ReaderPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [fontSize, setFontSize] = useState(18);
  const [sepia, setSepia] = useState(false);
  const [away, setAway] = useState(false);
  const [gate, setGate] = useState(false);
  const mark = useMemo(() => (user?.name ? `QuestLearn · User: ${user.name}` : 'QuestLearn'), [user]);
  const [pdfBusy, setPdfBusy] = useState(false);

  const bookQ = useQuery({
    queryKey: ['book', id],
    queryFn: async () => (await api.get(`/books/${id}`)).data,
    retry: false,
  });
  const progressQ = useQuery({
    queryKey: ['progress', id],
    queryFn: async () => (await api.get(`/books/${id}/progress`)).data,
    enabled: Boolean(user),
  });

  useEffect(() => {
    const saved = progressQ.data?.progress?.page;
    if (saved && page === 1) setPage(saved);
  }, [progressQ.data]);

  const denied = bookQ.error?.response?.status === 403 || bookQ.error?.response?.data?.code === 'LOGIN_REQUIRED';

  const readQ = useQuery({
    queryKey: ['read', id, page],
    queryFn: async () => (await api.get(`/books/${id}/read`, { params: { page } })).data,
    enabled: Boolean(bookQ.data?.book) && !denied,
    retry: false,
  });

  const save = useMutation({
    mutationFn: (body) => api.put(`/books/${id}/progress`, body),
  });

  useEffect(() => {
    if (!user || !readQ.data?.readable) return;
    save.mutate({
      page: readQ.data.page,
      totalPages: readQ.data.totalPages,
      percent: Math.round((readQ.data.page / readQ.data.totalPages) * 100),
    });
  }, [readQ.data?.page, readQ.data?.totalPages]);

  useEffect(() => {
    if (denied || readQ.error?.response?.status === 403) setGate(true);
  }, [denied, readQ.error]);

  useEffect(() => {
    function showRestricted() {
      setRestricted(true);
      window.setTimeout(() => setRestricted(false), 2200);
    }
    function onVis() {
      setAway(document.hidden);
    }
    function onKeys(e) {
      if ((e.ctrlKey || e.metaKey) && ['c', 'x', 's', 'p', 'u'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        showRestricted();
      }
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        showRestricted();
      }
    }
    function onCapture() {
      showRestricted();
    }
    function onCopy(e) {
      e.preventDefault();
      showRestricted();
    }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('keydown', onKeys);
    window.addEventListener('keyup', onKeys);
    document.addEventListener('copy', onCopy);
    document.addEventListener('capture', onCapture);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('keydown', onKeys);
      window.removeEventListener('keyup', onKeys);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('capture', onCapture);
    };
  }, []);

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      await downloadBookPdf(id, bookQ.data?.book?.catalogId || bookQ.data?.book?.title);
      message.success('Download started.');
    } catch (e) {
      message.error(await readErrorMessage(e, 'PDF download is not available for this title.'));
    } finally {
      setPdfBusy(false);
    }
  }

  const book = bookQ.data?.book;
  const read = readQ.data;

  if (denied) {
    return <AuthPrompt open={gate || true} onClose={() => nav('/')} />;
  }
  if (bookQ.isLoading) return <div className="grid min-h-[40vh] place-items-center"><Spin /></div>;
  if (!book) return <Alert type="error" message="Book not found." />;

  if (read && !read.readable) {
    return (
      <Card className="page-fade">
        <Typography.Title level={3}>{book.title}</Typography.Title>
        <Alert className="mb-4" type="info" showIcon message={read.message} />
        <Space>
          {user && (book.gutenbergId || book.isFree) && (
            <Button type="primary" loading={pdfBusy} onClick={downloadPdf}>Download PDF</Button>
          )}
          <Button onClick={() => nav(`/catalog/${id}`)}>Back to details</Button>
        </Space>
      </Card>
    );
  }

  const total = read?.totalPages || 1;
  const current = read?.page || page;

  return (
    <div
      className={`reader-page reader-protect page-fade ${sepia ? 'reader-sepia' : ''}`}
      onContextMenu={(e) => e.preventDefault()}
    >
      {restricted && (
        <div className="reader-restricted" role="alert">
          It is restricted.
        </div>
      )}
      {away && (
        <div className="reader-away" role="alert">
          Reading paused because this window is not active. Return here to continue.
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <Typography.Title level={4} className="!mb-0">{book.title}</Typography.Title>
          <p className="text-sm text-[color:var(--muted-text)]">{(book.authors || []).join(', ')}</p>
        </div>
        <Space wrap>
          {user && (book.gutenbergId || book.isFree) && (
            <Button type="primary" loading={pdfBusy} onClick={downloadPdf}>Download PDF</Button>
          )}
          <Button onClick={() => setSepia((v) => !v)}>{sepia ? 'Light' : 'Sepia'}</Button>
          <Link to={`/catalog/${id}`}>Details</Link>
          <Link to="/catalog">Library</Link>
        </Space>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-4">
        <span className="text-sm">Zoom</span>
        <Slider className="w-40" min={14} max={28} value={fontSize} onChange={setFontSize} />
        <span className="text-sm text-[color:var(--muted-text)]">
          Page {current} of {total} · {Math.round((current / total) * 100)}%
        </span>
      </div>
      {readQ.isError && <Alert type="error" className="mb-4" message={readQ.error?.response?.data?.message || 'Could not load reading content.'} />}
      <Card className="reader-frame reader-protect">
        {readQ.isFetching ? (
          <Spin />
        ) : (
          <div className="reader-content" style={{ fontSize }}>
            {user && <div className="reader-watermark" aria-hidden="true">{mark}</div>}
            {read?.content}
          </div>
        )}
      </Card>
      <div className="mt-4 flex justify-between gap-3">
        <Button disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</Button>
        <Button type="primary" disabled={current >= total} onClick={() => setPage(current + 1)}>Next</Button>
      </div>
      <p className="mt-3 text-xs text-[color:var(--muted-text)]">
        Browser-level copy, print, and context-menu shortcuts are limited here. Operating-system screenshots cannot be fully blocked on the web.
      </p>
    </div>
  );
}
