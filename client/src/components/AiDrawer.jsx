import { useEffect, useState } from 'react';
import { Button, Drawer, Input, List, Space, Tag, message } from 'antd';
import { Bot, Mic, Volume2 } from 'lucide-react';
import api from '../services/api.js';
import { useVoice } from '../hooks/useVoice.js';
import { useAuth } from '../context/AuthContext.jsx';
import { isPatron } from '../utils/roles.js';

export default function AiDrawer() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [loading, setLoading] = useState(false);
  const voice = useVoice();

  useEffect(() => {
    if (voice.transcript) setText(voice.transcript);
  }, [voice.transcript]);

  async function send(q) {
    const content = (q || text).trim();
    if (!content) return;
    setMsgs((m) => [...m, { role: 'user', content }]);
    setText('');
    setLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { message: content });
      setMsgs((m) => [...m, { role: 'assistant', content: data.answer, tool: data.tool }]);
      voice.speak(data.answer);
    } catch (e) {
      message.error(e.response?.data?.message || 'AI unavailable');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button type="primary" ghost onClick={() => setOpen(true)} icon={<Bot size={16} />}>
        Copilot
      </Button>
      <Drawer
        title={`${isPatron(user) ? 'Member' : 'Staff'} library copilot`}
        open={open}
        onClose={() => setOpen(false)}
        width={420}
      >
        <List
          className="mb-4 max-h-[60vh] overflow-auto"
          dataSource={msgs}
          locale={{ emptyText: 'Ask about titles, availability, or your loans.' }}
          renderItem={(item) => (
            <List.Item>
              <div>
                <Tag color={item.role === 'user' ? 'blue' : 'green'}>{item.role}</Tag>
                {item.tool && <Tag>{item.tool}</Tag>}
                <p className="mt-1 whitespace-pre-wrap">{item.content}</p>
              </div>
            </List.Item>
          )}
        />
        <Space.Compact className="w-full">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPressEnter={() => send()}
            placeholder="Find books on transformers…"
          />
          <Button icon={<Mic size={16} />} type={voice.listening ? 'primary' : 'default'} onClick={voice.listening ? voice.stop : voice.start} />
          <Button icon={<Volume2 size={16} />} onClick={() => voice.speak(msgs.at(-1)?.content || 'Hello')} />
          <Button type="primary" loading={loading} onClick={() => send()}>
            Send
          </Button>
        </Space.Compact>
      </Drawer>
    </>
  );
}
