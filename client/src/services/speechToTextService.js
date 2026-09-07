function getSpeechRecognition() {
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
}

export function createSpeechToText({ onTranscript, onError, onListening }) {
  let recognition = null;
  let active = false;

  function supported() {
    return Boolean(getSpeechRecognition());
  }

  function start() {
    if (!supported()) {
      onError?.('Voice input is not supported in this browser.\nPlease use text chat or a supported browser.');
      return;
    }
    stop();
    const SpeechRecognition = getSpeechRecognition();
    recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.onstart = () => {
      active = true;
      onListening?.(true);
    };
    recognition.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (result?.isFinal) {
        const text = result[0]?.transcript?.trim() || '';
        onTranscript?.(text);
      }
    };
    recognition.onerror = (event) => {
      active = false;
      onListening?.(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        onError?.('Microphone access is required for voice input.\nPlease allow microphone access and try again.');
      } else if (event.error !== 'aborted' && event.error !== 'no-speech') {
        onError?.('Voice input failed. Please try again or use text chat.');
      }
    };
    recognition.onend = () => {
      active = false;
      onListening?.(false);
    };
    try {
      recognition.start();
    } catch {
      onError?.('Voice input failed. Please try again or use text chat.');
    }
  }

  function stop() {
    try {
      recognition?.stop();
    } catch {
      // already stopped
    }
    active = false;
    onListening?.(false);
  }

  return {
    supported,
    start,
    stop,
    isListening: () => active,
  };
}
