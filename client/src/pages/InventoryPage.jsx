import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, InputNumber, Switch, Typography, Upload, message, Space, Divider } from 'antd';
import { useRef, useState } from 'react';
import Barcode from 'react-barcode';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import BarcodeTools from '../components/BarcodeTools.jsx';
import CirculationDrawer from '../components/CirculationDrawer.jsx';

function looksLikeIsbn(code) {
  const cleaned = String(code || '').replace(/[-\s]/g, '');
  return /^(97[89])?\d{9}[\dXx]$/.test(cleaned);
}

export default function InventoryPage() {
  const qc = useQueryClient();
  const [bookForm] = Form.useForm();
  const [editForm] = Form.useForm();
  const [created, setCreated] = useState(null);
  const [editing, setEditing] = useState(null);
  const [counter, setCounter] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [editPdfFile, setEditPdfFile] = useState(null);
  const [editCoverFile, setEditCoverFile] = useState(null);
  const formAnchor = useRef(null);

  function scrollToForm() {
    window.setTimeout(() => formAnchor.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  function prefillNewBook(code) {
    const values = { initialCopies: 3, category: 'General', isFree: false };
    if (looksLikeIsbn(code)) values.isbn = String(code).replace(/[-\s]/g, '');
    else values.scannedCode = code;
    bookForm.setFieldsValue(values);
    setEditing(null);
    scrollToForm();
  }

  function startEdit(book) {
    setEditing(book);
    editForm.setFieldsValue({
      title: book.title,
      isbn: book.isbn,
      authors: (book.authors || []).join(', '),
      category: book.category,
      genres: (book.genres || []).join(', '),
      summary: book.summary,
      coverImage: book.coverImage,
      publisher: book.publisher,
      publicationYear: book.publicationYear,
      availableCopies: book.availableCopies,
      totalCopies: book.totalCopies,
      isFree: Boolean(book.isFree),
      shelfLocation: book.shelfLocation,
    });
    setEditPdfFile(null);
    setEditCoverFile(null);
    scrollToForm();
  }

  const createBook = useMutation({
    mutationFn: async (v) => {
      const payload = {
        title: v.title,
        isbn: v.isbn,
        authors: String(v.authors || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        genres: String(v.genres || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        category: v.category,
        summary: v.summary,
        coverImage: v.coverImage,
        publisher: v.publisher,
        publicationYear: v.publicationYear,
        shelfLocation: v.shelfLocation || (v.scannedCode ? `SCAN-${v.scannedCode}` : undefined),
        initialCopies: v.initialCopies || 1,
        isFree: Boolean(v.isFree),
      };
      const { data } = await api.post('/books', payload);
      const id = data.book?._id;
      if (id && coverFile) {
        const fd = new FormData();
        fd.append('cover', coverFile);
        const coverRes = await api.post(`/books/${id}/cover`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        data.book.coverImage = coverRes.data.coverImage;
      }
      if (id && pdfFile) {
        const fd = new FormData();
        fd.append('pdf', pdfFile);
        await api.post(`/books/${id}/pdf`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        data.pdfStatus = 'Uploaded';
      }
      return data;
    },
    onSuccess: (data) => {
      setCreated(data);
      setPdfFile(null);
      setCoverFile(null);
      bookForm.resetFields();
      bookForm.setFieldsValue({ category: 'Computer Science', initialCopies: 3 });
      qc.invalidateQueries({ queryKey: ['books'] });
      message.success(`Saved ${data.book?.title} · ${data.catalogId || data.book?.catalogId}`);
    },
    onError: (e) => message.error(e.response?.data?.message || 'Create failed'),
  });

  const updateBook = useMutation({
    mutationFn: async (v) => {
      const payload = {
        title: v.title,
        isbn: v.isbn,
        authors: String(v.authors || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        genres: String(v.genres || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        category: v.category,
        summary: v.summary,
        coverImage: v.coverImage,
        publisher: v.publisher,
        publicationYear: v.publicationYear,
        shelfLocation: v.shelfLocation,
        isFree: Boolean(v.isFree),
      };
      const { data } = await api.patch(`/books/${editing._id}`, payload);
      if (editCoverFile) {
        const fd = new FormData();
        fd.append('cover', editCoverFile);
        const coverRes = await api.post(`/books/${editing._id}/cover`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        data.book.coverImage = coverRes.data.coverImage;
      }
      if (editPdfFile) {
        const fd = new FormData();
        fd.append('pdf', editPdfFile);
        await api.post(`/books/${editing._id}/pdf`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        data.pdfStatus = 'Uploaded';
      }
      if (Number(v.addCopies) > 0) {
        await api.post(`/books/${editing._id}/copies`, { count: Number(v.addCopies) });
      }
      return data;
    },
    onSuccess: (data) => {
      message.success(`Updated ${data.book?.title}`);
      setEditing(data.book);
      setEditPdfFile(null);
      setEditCoverFile(null);
      qc.invalidateQueries({ queryKey: ['books'] });
      qc.invalidateQueries({ queryKey: ['book', data.book?._id] });
    },
    onError: (e) => message.error(e.response?.data?.message || 'Update failed'),
  });

  return (
    <div className="space-y-4 page-fade">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Typography.Title level={3} className="!mb-0">
          Inventory & barcodes
        </Typography.Title>
        <Button onClick={() => setCounter(true)}>Open circulation counter</Button>
      </div>

      <Card title="Scan or upload barcode">
        <BarcodeTools
          onFound={(data) => {
            setCreated(null);
            if (data?.book) startEdit(data.book);
          }}
          onNotFound={(code) => prefillNewBook(code)}
          onEdit={(book) => startEdit(book)}
        />
      </Card>

      <div ref={formAnchor} />

      {editing && (
        <Card
          title={`Update book · ${editing.catalogId || editing.title}`}
          extra={
            <Button
              onClick={() => {
                setEditing(null);
                editForm.resetFields();
              }}
            >
              Cancel edit
            </Button>
          }
        >
          <Form form={editForm} layout="vertical" onFinish={(v) => updateBook.mutate(v)}>
            <Form.Item name="title" label="Title" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="isbn" label="ISBN" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="authors" label="Authors (comma separated)">
              <Input />
            </Form.Item>
            <Form.Item name="category" label="Category" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="genres" label="Genres (comma separated)">
              <Input />
            </Form.Item>
            <Form.Item name="summary" label="Summary">
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="coverImage" label="Cover URL">
              <Input />
            </Form.Item>
            <Form.Item label="Upload new cover image">
              <Upload
                maxCount={1}
                accept="image/*"
                beforeUpload={(file) => {
                  setEditCoverFile(file);
                  return false;
                }}
                onRemove={() => setEditCoverFile(null)}
              >
                <Button>Upload cover</Button>
              </Upload>
            </Form.Item>
            <Form.Item name="publisher" label="Publisher">
              <Input />
            </Form.Item>
            <Form.Item name="publicationYear" label="Publication year">
              <InputNumber className="w-full" min={1400} max={2100} />
            </Form.Item>
            <Form.Item name="shelfLocation" label="Shelf location">
              <Input />
            </Form.Item>
            <Form.Item name="addCopies" label="Add extra copies">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="isFree" label="Free digital edition" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item label="Replace / upload PDF">
              <Upload
                maxCount={1}
                accept="application/pdf"
                beforeUpload={(file) => {
                  setEditPdfFile(file);
                  return false;
                }}
                onRemove={() => setEditPdfFile(null)}
              >
                <Button>Upload PDF</Button>
              </Upload>
            </Form.Item>
            <Space wrap>
              <Button type="primary" htmlType="submit" loading={updateBook.isPending}>
                Save changes
              </Button>
              <Link to={`/catalog/${editing._id}/read`}>
                <Button>Read book</Button>
              </Link>
              <Link to={`/catalog/${editing._id}`}>
                <Button>Open details</Button>
              </Link>
            </Space>
          </Form>
          {(editing.barcode || editing.catalogId) && (
            <div className="mt-4">
              <Barcode value={editing.barcode || editing.catalogId} />
            </div>
          )}
        </Card>
      )}

      <Card title="Add a book" id="add-book-form">
        <Form
          form={bookForm}
          layout="vertical"
          onFinish={(v) => createBook.mutate(v)}
          initialValues={{ category: 'Computer Science', initialCopies: 3 }}
        >
          <Form.Item name="scannedCode" label="Scanned barcode (reference)">
            <Input placeholder="Filled automatically when a scan finds no match" />
          </Form.Item>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="isbn" label="ISBN" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="authors" label="Authors (comma separated)">
            <Input />
          </Form.Item>
          <Form.Item name="category" label="Category" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="genres" label="Genres (comma separated)">
            <Input placeholder="Fantasy, Classic" />
          </Form.Item>
          <Form.Item name="summary" label="Summary">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="coverImage" label="Cover URL">
            <Input placeholder="https://…" />
          </Form.Item>
          <Form.Item label="Upload cover image">
            <Upload
              maxCount={1}
              accept="image/*"
              beforeUpload={(file) => {
                setCoverFile(file);
                return false;
              }}
              onRemove={() => setCoverFile(null)}
            >
              <Button>Upload cover</Button>
            </Upload>
          </Form.Item>
          <Form.Item name="publisher" label="Publisher">
            <Input />
          </Form.Item>
          <Form.Item name="publicationYear" label="Publication year">
            <InputNumber className="w-full" min={1400} max={2100} />
          </Form.Item>
          <Form.Item name="initialCopies" label="Number of copies">
            <InputNumber min={1} className="w-full" />
          </Form.Item>
          <Form.Item name="isFree" label="Free digital edition" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Complete PDF (optional)">
            <Upload
              maxCount={1}
              accept="application/pdf"
              beforeUpload={(file) => {
                setPdfFile(file);
                return false;
              }}
              onRemove={() => setPdfFile(null)}
            >
              <Button>Upload complete PDF</Button>
            </Upload>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={createBook.isPending}>
            Save book
          </Button>
        </Form>
        {created?.book && (
          <div className="mt-4 rounded-md border border-[color:var(--border-color)] p-3">
            <p>
              <strong>Book ID:</strong> {created.book.catalogId}
            </p>
            <p>
              <strong>Barcode:</strong> {created.book.barcode}
            </p>
            <p>
              <strong>Title:</strong> {created.book.title}
            </p>
            <p>
              <strong>PDF:</strong> {created.pdfStatus || 'No PDF yet'}
            </p>
            <Divider />
            <Space wrap>
              <Link to={`/catalog/${created.book._id}`}>
                <Button>View in catalog</Button>
              </Link>
              <Link to={`/catalog/${created.book._id}/read`}>
                <Button type="primary">Read book</Button>
              </Link>
            </Space>
            {created.book.barcode && (
              <div className="mt-2">
                <Barcode value={created.book.barcode} />
                <Button className="mt-2" onClick={() => window.print()}>
                  View / Print barcode
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>
      <CirculationDrawer open={counter} onClose={() => setCounter(false)} />
    </div>
  );
}
