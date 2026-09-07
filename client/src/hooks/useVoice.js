import { useCallback, useEffect, useRef, useState } from 'react';
import { createSpeechToText } from '../services/speechToTextService.js';
import { createTextToSpeech } from '../services/textToSpeechService.js';

export function useVoice({ onTranscript, onError } = {}) {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const sttRef = useRef(null);
  const ttsRef = useRef(null);

  useEffect(() => {
    sttRef.current = createSpeechToText({
      onTranscript: (text) => {
        setTranscript(text);
        onTranscript?.(text);
      },
      onError,
      onListening: setListening,
    });
    ttsRef.current = createTextToSpeech({ onSpeaking: setSpeaking });
    return () => {
      sttRef.current?.stop();
      ttsRef.current?.cancel();
    };
  }, [onError, onTranscript]);

  const start = useCallback(() => {
    ttsRef.current?.cancel();
    setTranscript('');
    sttRef.current?.start();
  }, []);

  const stop = useCallback(() => sttRef.current?.stop(), []);
  const speak = useCallback((text) => {
    ttsRef.current?.cancel();
    ttsRef.current?.ingest(`${text} `);
    ttsRef.current?.flush();
  }, []);

  return {
    listening,
    speaking,
    transcript,
    start,
    stop,
    speak,
    tts: ttsRef,
    supported: typeof window !== 'undefined' && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
  };
}
