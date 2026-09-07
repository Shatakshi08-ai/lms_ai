import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Drawer, Input, Space, Switch, Tooltip } from 'antd';
import {
  Copy,
  Menu,
  Mic,
  Plus,
  RotateCcw,
  Search,
  Send,
  Square,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { createSpeechToText } from '../services/speechToTextService.js';
import { createTextToSpeech } from '../services/textToSpeechService.js';
import { streamElenaChat } from '../services/elenaStream.js';
import { ELENA_AVATAR } from '../constants/elena.js';
import api from '../services/api.js';
import ElenaMarkdown from './ElenaMarkdown.jsx';

function nowLabel(value) {
  const d = value ? new Date(value) : new Date();
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function greeting(name) {
  return `Hi ${name}, I'm Elena. Ask me anything — studies, programming, or books in this library.`;
}

export default function ElenaChat() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [text, setText] = useState('');
  const [msgs, setMsgs] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceOut, setVoiceOut] = useState(false);
  const [error, setError] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [search, setSearch] = useState('');
  const [lastUser, setLastUser] = useState('');
  const bodyRef = useRef(null);
  const abortRef = useRef(null);
  const ttsRef = useRef(null);
  const sttRef = useRef(null);
  const conversationIdRef = useRef(null);
  const sendRef = useRef(() => {});
  const generatingRef = useRef(false);
  const firstName = user?.name?.split(' ')[0] || 'there';

  const onlineLabel = useMemo(() => {
    if (isListening) return 'Listening';
    if (isGenerating) return 'Typing';
    if (isSpeaking) return 'Speaking';
    return 'Online';
  }, [isListening, isGenerating, isSpeaking]);

  useEffect(() => {
    function openElena() {
      setOpen(true);
    }
    if (sessionStorage.getItem('elenaOpen') === '1') {
      sessionStorage.removeItem('elenaOpen');
      setOpen(true);
    }
    window.addEventListener('elena:open', openElena);
    return () => window.removeEventListener('elena:open', openElena);
  }, []);

  useEffect(() => {
    ttsRef.current = createTextToSpeech({ onSpeaking: setIsSpeaking, enabled: voiceOut });
    sttRef.current = createSpeechToText({
      onListening: setIsListening,
      onError: setError,
      onTranscript: (transcript) => {
        if (!transcript) return;
        setText(transcript);
        sendRef.current(transcript);
      },
    });
    return () => {
      ttsRef.current?.cancel();
      sttRef.current?.stop();
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    ttsRef.current?.setEnabled(voiceOut);
  }, [voiceOut]);

  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ role: 'assistant', content: greeting(firstName), at: nowLabel(), welcome: true }]);
    }
  }, [open, msgs.length, firstName]);

  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [msgs, isGenerating]);

  const loadHistory = useCallback(async (q = '') => {
    try {
      const { data } = await api.get('/ai/conversations', { params: { q, limit: 40 } });
      setConversations(data.items || []);
    } catch {
      // keep existing list
    }
  }, []);

  useEffect(() => {
    if (open) loadHistory(search);
  }, [open, search, loadHistory]);

  async function openConversation(id) {
    try {
      const { data } = await api.get(`/ai/conversations/${id}`);
      const conv = data.conversation;
      conversationIdRef.current = conv._id;
      setConversationId(conv._id);
      setMsgs(
        (conv.messages || []).map((m) => ({
          role: m.role,
          content: m.content,
          at: nowLabel(m.timestamp),
          rating: m.metadata?.rating,
        })),
      );
      setHistoryOpen(false);
    } catch {
      setError('Could not load that conversation.');
    }
  }

  async function deleteConversation(id, e) {
    e?.stopPropagation();
    try {
      await api.delete(`/ai/conversations/${id}`);
      if (conversationIdRef.current === id) {
        conversationIdRef.current = null;
        setConversationId(null);
        setMsgs([{ role: 'assistant', content: greeting(firstName), at: nowLabel(), welcome: true }]);
      }
      loadHistory(search);
    } catch {
      setError('Could not delete that conversation.');
    }
  }

  function finishGenerating() {
    generatingRef.current = false;
    setIsGenerating(false);
    abortRef.current = null;
    setMsgs((m) => m.map((item) => ({ ...item, streaming: false })));
  }

  async function send(q, opts = {}) {
    const content = (q || text).trim();
    if ((!content && !opts.regenerate) || generatingRef.current) return;
    generatingRef.current = true;
    setError('');
    if (content) setLastUser(content);
    if (!opts.alreadyAppended && !opts.regenerate) {
      setMsgs((m) => [...m.filter((x) => !x.welcome), { role: 'user', content, at: nowLabel() }]);
    }
    if (opts.regenerate) {
      setMsgs((m) => {
        const next = [...m];
        if (next.at(-1)?.role === 'assistant') next.pop();
        return [...next, { role: 'assistant', content: '', at: nowLabel(), streaming: true }];
      });
    } else {
      setText('');
      setMsgs((m) => [...m, { role: 'assistant', content: '', at: nowLabel(), streaming: true }]);
    }
    setIsGenerating(true);
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      await streamElenaChat({
        message: content,
        conversationId: conversationIdRef.current,
        regenerate: opts.regenerate,
        signal: abort.signal,
        onStart: ({ conversationId: id }) => {
          if (id) {
            setConversationId(id);
            conversationIdRef.current = id;
          }
        },
        onChunk: (chunk) => {
          if (voiceOut) ttsRef.current?.ingest(chunk);
          setMsgs((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === 'assistant' && last.streaming) {
              next[next.length - 1] = { ...last, content: last.content + chunk };
            } else {
              next.push({ role: 'assistant', content: chunk, at: nowLabel(), streaming: true });
            }
            return next;
          });
        },
        onDone: ({ conversationId: id }) => {
          if (id) {
            setConversationId(id);
            conversationIdRef.current = id;
          }
          ttsRef.current?.flush();
          finishGenerating();
          loadHistory(search);
        },
        onError: (message) => {
          generatingRef.current = false;
          setIsGenerating(false);
          abortRef.current = null;
          const friendly = message || 'Elena is temporarily unavailable. Please try again in a moment.';
          setError(friendly);
          setMsgs((m) => {
            const cleaned = m
              .filter((item) => !(item.role === 'assistant' && !String(item.content || '').trim()))
              .map((item) => ({ ...item, streaming: false }));
            const last = cleaned[cleaned.length - 1];
            if (last?.role === 'assistant' && last.error) return cleaned;
            return [...cleaned, { role: 'assistant', content: friendly, at: nowLabel(), error: true }];
          });
        },
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        finishGenerating();
        return;
      }
      finishGenerating();
      setError('Elena is temporarily unavailable. Please try again in a moment.');
    }
  }

  sendRef.current = send;

  function stopGeneration() {
    abortRef.current?.abort();
    ttsRef.current?.cancel();
    finishGenerating();
  }

  function newChat() {
    ttsRef.current?.cancel();
    abortRef.current?.abort();
    conversationIdRef.current = null;
    setConversationId(null);
    setMsgs([{ role: 'assistant', content: greeting(firstName), at: nowLabel(), welcome: true }]);
    setError('');
    generatingRef.current = false;
    setIsGenerating(false);
  }

  async function clearChat() {
    ttsRef.current?.cancel();
    abortRef.current?.abort();
    if (conversationIdRef.current) {
      try {
        await api.post(`/ai/conversations/${conversationIdRef.current}/clear`);
      } catch {
        // local reset still happens
      }
    }
    setMsgs([{ role: 'assistant', content: greeting(firstName), at: nowLabel(), welcome: true }]);
    setError('');
    generatingRef.current = false;
    setIsGenerating(false);
  }

  function onMic() {
    ttsRef.current?.cancel();
    if (isGenerating) stopGeneration();
    if (isListening) {
      sttRef.current?.stop();
      return;
    }
    if (!sttRef.current?.supported()) {
      setError('Voice input is not supported in this browser. You can still type.');
      return;
    }
    setError('');
    sttRef.current?.start();
  }

  async function speakText(content) {
    const clean = String(content || '').trim();
    if (!clean) return;
    if (isSpeaking) {
      ttsRef.current?.cancel();
      return;
    }
    try {
      const res = await api.post('/ai/tts', { text: clean.slice(0, 900) }, { responseType: 'blob' });
      const type = res.headers['content-type'] || res.data?.type || '';
      if (String(type).includes('json') || res.data?.size < 80) throw new Error('no audio');
      const url = URL.createObjectURL(res.data);
      const audio = new Audio(url);
      setIsSpeaking(true);
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch {
      ttsRef.current?.cancel();
      ttsRef.current?.setEnabled(true);
      ttsRef.current?.ingest(`${clean}.`);
      ttsRef.current?.flush();
    }
  }

  async function copyText(content) {
    try {
      await navigator.clipboard.writeText(content);
    } catch {
      setError('Could not copy that message.');
    }
  }

  async function rate(index, rating) {
    setMsgs((m) => m.map((item, i) => (i === index ? { ...item, rating } : item)));
    if (!conversationIdRef.current) return;
    try {
      await api.post(`/ai/conversations/${conversationIdRef.current}/feedback`, { index, rating });
    } catch {
      // local only
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const historyList = (
    <div className="elena-history">
      <Button type="primary" block icon={<Plus size={14} />} onClick={newChat}>
        New Chat
      </Button>
      <Input
        className="mt-2"
        prefix={<Search size={14} />}
        placeholder="Search conversations"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        allowClear
      />
      <div className="elena-history-list">
        {conversations.map((c) => (
          <button
            key={c._id}
            type="button"
            className={`elena-history-item ${conversationId === c._id ? 'is-active' : ''}`}
            onClick={() => openConversation(c._id)}
          >
            <span className="truncate">{c.title || 'Conversation'}</span>
            <Trash2 size={14} onClick={(e) => deleteConversation(c._id, e)} />
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <>
      <Tooltip title="Chat with Elena" placement="left">
        <button
          type="button"
          className="elena-fab"
          onClick={() => setOpen((v) => !v)}
          aria-label="Chat with Elena"
        >
          <img className="elena-fab-photo" src={ELENA_AVATAR} alt="" />
          Elena
        </button>
      </Tooltip>
      {open && (
        <div className="elena-panel" role="dialog" aria-label="Elena AI assistant">
          <div className="elena-panel-header">
            <div className="flex items-center gap-2 min-w-0">
              <Button type="text" className="!text-white md:!hidden" icon={<Menu size={16} />} onClick={() => setHistoryOpen(true)} aria-label="Open chat history" />
              <img className="elena-avatar" src={ELENA_AVATAR} alt="Elena" />
              <div className="min-w-0">
                <div className="text-sm font-semibold">Elena AI</div>
                <div className="elena-status">
                  <span className="elena-online-dot" />
                  {onlineLabel}
                </div>
              </div>
            </div>
            <Space>
              <Button type="text" className="!text-white hidden md:inline-flex" onClick={newChat}>
                + New Chat
              </Button>
              <Button type="text" className="!text-white" aria-label="Close chat" icon={<X size={16} />} onClick={() => setOpen(false)} />
            </Space>
          </div>
          <div className="elena-shell">
            <aside className="elena-sidebar hidden md:flex">{historyList}</aside>
            <div className="elena-main">
              <div className="elena-panel-body" ref={bodyRef} aria-live="polite">
                {msgs.map((item, i) => (
                  <div key={`${item.at}-${i}`} className={`elena-row ${item.role === 'user' ? 'is-user' : 'is-bot'}`}>
                    {item.role === 'assistant' && <img className="elena-avatar elena-avatar-sm" src={ELENA_AVATAR} alt="" />}
                    <div className={`elena-bubble ${item.role === 'user' ? 'elena-bubble-user' : 'elena-bubble-bot'}`}>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                        {item.role === 'user' ? firstName : 'Elena'} · {item.at}
                      </div>
                      {item.role === 'assistant' ? (
                        item.streaming && !item.content ? (
                          <div className="elena-typing" aria-label="Elena is typing">
                            <span />
                            <span />
                            <span />
                          </div>
                        ) : (
                          <ElenaMarkdown content={item.content} />
                        )
                      ) : (
                        <p className="m-0 whitespace-pre-wrap">{item.content}</p>
                      )}
                      {item.role === 'assistant' && item.content && !item.streaming && !item.welcome && !item.error && (
                        <div className="elena-actions">
                          <Button type="text" size="small" icon={<Copy size={14} />} onClick={() => copyText(item.content)} aria-label="Copy response">
                            Copy
                          </Button>
                          <Button type="text" size="small" icon={<RotateCcw size={14} />} onClick={() => send(lastUser, { regenerate: true })} disabled={isGenerating}>
                            Regenerate
                          </Button>
                          <Button type="text" size="small" icon={isSpeaking ? <Square size={14} /> : <Volume2 size={14} />} onClick={() => speakText(item.content)}>
                            {isSpeaking ? 'Stop' : 'Read aloud'}
                          </Button>
                          <Button type="text" size="small" icon={<ThumbsUp size={14} />} onClick={() => rate(i, 'up')} aria-label="Good response" />
                          <Button type="text" size="small" icon={<ThumbsDown size={14} />} onClick={() => rate(i, 'down')} aria-label="Bad response" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {error && <p className="text-sm text-[color:var(--pastel-red)]">{error}</p>}
                {itemErrorRetry(error, lastUser, isGenerating, send)}
              </div>
              <div className="elena-panel-footer">
                <div className="mb-2 flex items-center justify-between gap-2 text-xs text-[color:var(--muted-text)]">
                  <span>{isListening ? 'Listening…' : isGenerating ? 'Streaming…' : 'Ready'}</span>
                  <label className="flex items-center gap-2">
                    {voiceOut ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    Voice reply
                    <Switch size="small" checked={voiceOut} onChange={setVoiceOut} aria-label="Toggle voice output" />
                  </label>
                </div>
                <Input.TextArea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  autoSize={{ minRows: 1, maxRows: 4 }}
                  placeholder="Type your message..."
                  aria-label="Chat message"
                  maxLength={4000}
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button type="primary" icon={<Send size={14} />} onClick={() => send()} disabled={!text.trim() || isGenerating}>
                    Send
                  </Button>
                  <Button
                    icon={<Mic size={16} />}
                    type={isListening ? 'primary' : 'default'}
                    className={isListening ? 'elena-mic-live' : ''}
                    onClick={onMic}
                    aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                  />
                  <Button icon={<Square size={14} />} onClick={stopGeneration} disabled={!isGenerating && !isSpeaking}>
                    Stop
                  </Button>
                  <Button onClick={clearChat} disabled={isGenerating}>
                    Clear
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <Drawer title="Conversations" placement="left" open={historyOpen} onClose={() => setHistoryOpen(false)} width={280}>
        {historyList}
      </Drawer>
    </>
  );
}

function itemErrorRetry(error, lastUser, isGenerating, send) {
  if (!error || !lastUser) return null;
  return (
    <Button size="small" icon={<RotateCcw size={14} />} onClick={() => send(lastUser)} disabled={isGenerating}>
      Retry
    </Button>
  );
}
