import { useEffect, useRef, useState } from 'react';
import { Button, Drawer, Form, Input, Select, Space, Typography, message } from 'antd';
import api from '../services/api.js';

export default function CirculationDrawer({ open, onClose }) {
  const [mode, setMode] = useState('issue');
  const [users, setUsers] = useState([]);
  const scanRef = useRef(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      setTimeout(() => scanRef.current?.focus(), 200);
      api.get('/users', { params: { role: 'STUDENT', limit: 50 } }).then((r) => setUsers(r.data.items || [])).catch(() => {});
    }
  }, [open]);

  async function submit(values) {
    try {
      if (mode === 'issue') {
        await api.post('/circulation/issue', { userId: values.userId, barcode: values.barcode });
        message.success('Issued');
      } else {
        const { data } = await api.post('/circulation/return', { barcode: values.barcode });
        message.success(data.fine?.amount ? `Returned · fine ${data.fine.amount}` : 'Returned');
      }
      form.resetFields();
      scanRef.current?.focus();
    } catch (e) {
      message.error(e.response?.data?.message || 'Failed');
    }
  }

  return (
    <Drawer title="Circulation counter" open={open} onClose={onClose} width={420}>
      <Space className="mb-4">
        <Button type={mode === 'issue' ? 'primary' : 'default'} onClick={() => setMode('issue')}>
          Issue
        </Button>
        <Button type={mode === 'return' ? 'primary' : 'default'} onClick={() => setMode('return')}>
          Return
        </Button>
      </Space>
      <Typography.Paragraph type="secondary">
        Scan or type a barcode (BC-XXXXXX). Issue also needs a member.
      </Typography.Paragraph>
      <Form form={form} layout="vertical" onFinish={submit}>
        {mode === 'issue' && (
          <Form.Item name="userId" label="Member" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="Select member"
              options={users.map((u) => ({ value: u._id, label: `${u.name} · ${u.readerId}` }))}
            />
          </Form.Item>
        )}
        <Form.Item name="barcode" label="Barcode" rules={[{ required: true }]}>
          <Input ref={scanRef} placeholder="BC-100001" autoFocus />
        </Form.Item>
        <Button type="primary" htmlType="submit" block>
          {mode === 'issue' ? 'Quick issue' : 'Quick return'}
        </Button>
      </Form>
    </Drawer>
  );
}
