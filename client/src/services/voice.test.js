import { describe, it, expect, vi } from 'vitest';
import { createSpeechToText } from './speechToTextService.js';
import { createTextToSpeech } from './textToSpeechService.js';

class FakeRecognition {
  constructor() {
    this.lang = '';
    this.interimResults = false;
    this.continuous = false;
    this.onstart = null;
    this.onresult = null;
    this.onerror = null;
    this.onend = null;
  }
  start() {
    this.onstart?.();
  }
  stop() {
    this.onend?.();
  }
}

describe('voice assistant services (mocked browser APIs)', () => {
  it('reports unsupported when SpeechRecognition is missing', () => {
    const prev = window.SpeechRecognition;
    const prevW = window.webkitSpeechRecognition;
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    const errors = [];
    const stt = createSpeechToText({ onError: (m) => errors.push(m) });
    expect(stt.supported()).toBe(false);
    stt.start();
    expect(errors[0]).toMatch(/not supported/i);
    window.SpeechRecognition = prev;
    window.webkitSpeechRecognition = prevW;
  });

  it('starts, captures recognized text, and stops', () => {
    window.SpeechRecognition = FakeRecognition;
    let listening = false;
    let transcript = '';
    const stt = createSpeechToText({
      onTranscript: (t) => { transcript = t; },
      onListening: (v) => { listening = v; },
    });
    expect(stt.supported()).toBe(true);
    stt.start();
    expect(listening).toBe(true);
    stt.stop();
    expect(listening).toBe(false);
    expect(transcript).toBe('');
  });

  it('sets speaking state through mocked speechSynthesis', () => {
    window.SpeechSynthesisUtterance = class {
      constructor(text) {
        this.text = text;
        this.rate = 1;
        this.voice = null;
        this.onend = null;
        this.onerror = null;
      }
    };
    const speakCalls = [];
    window.speechSynthesis = {
      speak: (u) => {
        speakCalls.push(u.text);
        u.onend?.();
      },
      cancel() {},
      resume() {},
      pause() {},
      getVoices: () => [],
      speaking: false,
      paused: false,
    };
    let speaking = false;
    const tts = createTextToSpeech({ onSpeaking: (v) => { speaking = v; } });
    tts.ingest('Hello library. ');
    tts.flush();
    expect(speakCalls.length).toBeGreaterThan(0);
    expect(speaking).toBe(false);
  });

  it('handles recognition errors', () => {
    window.SpeechRecognition = class extends FakeRecognition {
      start() {
        this.onstart?.();
        this.onerror?.({ error: 'not-allowed' });
      }
    };
    const errors = [];
    const stt = createSpeechToText({ onError: (m) => errors.push(m) });
    stt.start();
    expect(errors[0]).toMatch(/microphone/i);
  });
});
