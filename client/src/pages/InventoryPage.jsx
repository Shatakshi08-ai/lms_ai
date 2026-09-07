import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, InputNumber, Switch, Typography, Upload, message } from 'antd';
import { useState } from 'react';
import Barcode from 'react-barcode';
import api from '../services/api.js';
import BarcodeTools from '../components/BarcodeTools.jsx';
import CirculationDrawer from '../components/CirculationDrawer.jsx';

export default function InventoryPage() {
  const qc = useQueryClient();
  const [bookForm] = Form.useForm();
  const [created, setCreated] = useState(null);
  const [counter, setCounter] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);

  const createBook = useMutation({
    mutationFn: async (v) => {
      const payload = {
        ...v,
        authors: String(v.authors || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        genres: String(v.genres || '')
          .split(',')
          .map((x) => x.trim())
          .filter(Boolean),
        initialCopies: v.initialCopies || 1,
        isFree: Boolean(v.isFree),
      };
      const { data } = await api.post('/books', payload);
      if (pdfFile && data.book?._id) {
        const fd = new FormData();
        fd.append('pdf', pdfFile);
        await api.post(`/books/${data.book._id}/pdf`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        data.pdfStatus = 'Uploaded';
      }
      return data;
    },
    onSuccess: (data) => {
      setCreated(data);
      setPdfFile(null);
      bookForm.resetFields();
      qc.invalidateQueries({ queryKey: ['books'] });
      message.success(`Saved ${data.book?.title} · ${data.catalogId || data.book?.catalogId}`);
    },
    onError: (e) => message.error(e.response?.data?.message || 'Create failed'),
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
        <BarcodeTools />
      </Card>
      <Card title="Add a book">
        <Form
          form={bookForm}
          layout="vertical"
          onFinish={(v) => createBook.mutate(v)}
          initialValues={{ category: 'Computer Science', initialCopies: 3 }}
        >
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
          <Form.Item name="summary" label="Summary">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="coverImage" label="Cover URL">
            <Input />
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
