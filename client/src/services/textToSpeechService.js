function sanitizeForSpeech(text) {
  return String(text || '')
    .replace(/[`*_#>[\](){}|\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function createTextToSpeech({ onSpeaking, enabled = true } = {}) {
  let buffer = '';
  let queue = [];
  let speaking = false;
  let voiceOn = enabled;

  function setEnabled(value) {
    voiceOn = value;
    if (!value) cancel();
  }

  function setSpeaking(value) {
    speaking = value;
    onSpeaking?.(value);
  }

  function playNext() {
    if (!voiceOn || !window.speechSynthesis) {
      setSpeaking(false);
      return;
    }
    const next = queue.shift();
    if (!next) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(next);
    utterance.rate = 1;
    const voices = window.speechSynthesis.getVoices();
    const female =
      voices.find((v) => /female|zira|samantha|susan|hazel|google uk english female/i.test(v.name)) ||
      voices.find((v) => v.lang?.toLowerCase().startsWith('en'));
    if (female) utterance.voice = female;
    utterance.onend = () => playNext();
    utterance.onerror = () => playNext();
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

function enqueue(sentence) {
    const clean = sanitizeForSpeech(sentence);
    if (!clean || !voiceOn) return;
    queue.push(clean);
    if (!speaking) playNext();
  }

  function drainSentences() {
    const pattern = /[.!?](?:\s+|$)/;
    let match = buffer.match(pattern);
    while (match) {
      const idx = match.index + match[0].length;
      enqueue(buffer.slice(0, idx));
      buffer = buffer.slice(idx);
      match = buffer.match(pattern);
    }
  }

  function ingest(chunk) {
    if (!voiceOn) return;
    buffer += chunk;
    drainSentences();
  }

  function flush() {
    if (buffer.trim()) enqueue(buffer);
    buffer = '';
  }

  function cancel() {
    buffer = '';
    queue = [];
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
    }
    setSpeaking(false);
  }

  function pause() {
    if (window.speechSynthesis?.speaking) window.speechSynthesis.pause();
  }

  function resume() {
    if (window.speechSynthesis?.paused) window.speechSynthesis.resume();
  }

  return { ingest, flush, cancel, pause, resume, setEnabled, isSpeaking: () => speaking };
}
