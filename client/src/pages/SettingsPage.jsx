import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Form, Input, InputNumber, Switch, Typography, Upload, message } from 'antd';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [bookForm] = Form.useForm();
  const { data } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => (await api.get('/analytics/settings')).data,
  });
  const save = useMutation({
    mutationFn: (v) => api.patch('/analytics/settings', v),
    onSuccess: () => {
      message.success('Saved');
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
  const createBook = useMutation({
    mutationFn: (v) => api.post('/books', v),
    onSuccess: () => message.success('Book ingested into catalog'),
    onError: (e) => message.error(e.response?.data?.message || 'Create failed'),
  });

  async function onOcr(file) {
    const buf = await file.arrayBuffer();
    const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    const { data: ocr } = await api.post('/ai/ocr', { imageBase64: b64, mimeType: file.type });
    message.success('OCR prefill ready');
    return ocr.extracted;
  }

  const s = data?.settings;
  if (!s) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Fine & circulation rules">
        <Form
          layout="vertical"
          initialValues={s}
          onFinish={(v) => save.mutate(v)}
        >
          <Form.Item name="libraryName" label="Library name"><Input /></Form.Item>
          <Form.Item name="dailyFineRate" label="Daily fine rate"><InputNumber className="w-full" min={0} /></Form.Item>
          <Form.Item name="gracePeriodDays" label="Grace period (days)"><InputNumber className="w-full" min={0} /></Form.Item>
          <Form.Item name="maxFineCap" label="Max fine cap"><InputNumber className="w-full" min={0} /></Form.Item>
          <Form.Item name="loanPeriodDays" label="Loan period"><InputNumber className="w-full" min={1} /></Form.Item>
          <Form.Item name="unpaidFineIssueBlock" label="Block issue if unpaid ≥"><InputNumber className="w-full" min={0} /></Form.Item>
          <Button type="primary" htmlType="submit" loading={save.isPending}>Save rules</Button>
        </Form>
      </Card>
      {user.role === 'SUPER_ADMIN' && (
        <Card title="AI engine">
          <Form
            layout="vertical"
            initialValues={s.ai}
            onFinish={(ai) => save.mutate({ ai })}
          >
            <Form.Item name="provider" label="Provider">
              <Input placeholder="mock | openai | gemini | anthropic" />
            </Form.Item>
            <Form.Item name="studentCopilotEnabled" label="Elena chatbot for members" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="adminNlQueryEnabled" label="NL analytics" valuePropName="checked"><Switch /></Form.Item>
            <Form.Item name="recommendationsEnabled" label="Recommendations" valuePropName="checked"><Switch /></Form.Item>
            <Button htmlType="submit" type="primary">Save AI</Button>
          </Form>
        </Card>
      )}
      <Card title="AI OCR ingestion" className="lg:col-span-2">
        <Form form={bookForm} layout="vertical" onFinish={(v) => createBook.mutate({
          ...v,
          authors: String(v.authors || '').split(',').map((x) => x.trim()).filter(Boolean),
          genres: String(v.genres || '').split(',').map((x) => x.trim()).filter(Boolean),
          initialCopies: 3,
        })}>
          <Upload
            beforeUpload={async (file) => {
              const extracted = await onOcr(file);
              bookForm.setFieldsValue({
                title: extracted.title,
                isbn: extracted.isbn,
                authors: (extracted.authors || []).join(', '),
                category: extracted.category,
                summary: extracted.summary,
                publisher: extracted.publisher,
              });
              return false;
            }}
            maxCount={1}
          >
            <Button>Upload cover / ISBN image</Button>
          </Upload>
          <p className="text-xs text-slate-500">Without a Gemini key, mock metadata is returned so the form still works.</p>
          <Form.Item name="title" label="Title" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="isbn" label="ISBN" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="authors" label="Authors (comma)"><Input /></Form.Item>
          <Form.Item name="category" label="Category" initialValue="Computer Science"><Input /></Form.Item>
          <Form.Item name="genres" label="Genres">
            <Input placeholder="Fiction, Mystery" />
          </Form.Item>
          <Form.Item name="summary" label="Summary"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="coverImage" label="Cover URL"><Input /></Form.Item>
          <Button type="primary" htmlType="submit" loading={createBook.isPending}>Create book + copies</Button>
        </Form>
      </Card>
    </div>
  );
}
