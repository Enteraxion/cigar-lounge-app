/**
 * `@react-native-voice/voice` on the web.
 *
 * Browsers have their own speech recognition, and the shapes line up closely
 * enough that voiceSearchService.ts needs no changes: it assigns callbacks to
 * `Voice.onSpeechResults` and friends, calls `start`/`stop`/`destroy`, and asks
 * `isAvailable()` first.
 *
 * Coverage is the catch. Chrome on Android and desktop support this well;
 * Safari's support is partial and iOS support has historically been unreliable.
 * `isAvailable()` answers honestly, and voiceSearchService already handles a
 * false answer by telling the member voice search is not available here rather
 * than failing silently — which is exactly the right behaviour.
 */

export type SpeechResultsEvent = { value?: string[] };
export type SpeechErrorEvent = { error?: { code?: string; message?: string } };

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function RecognitionClass(): (new () => Recognition) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const Voice = {
  onSpeechStart: null as (() => void) | null,
  onSpeechPartialResults: null as ((e: SpeechResultsEvent) => void) | null,
  onSpeechResults: null as ((e: SpeechResultsEvent) => void) | null,
  onSpeechError: null as ((e: SpeechErrorEvent) => void) | null,
  onSpeechEnd: null as (() => void) | null,

  _recognition: null as Recognition | null,

  async isAvailable(): Promise<boolean> {
    return RecognitionClass() !== null;
  },

  async start(locale = 'en-US'): Promise<void> {
    const Ctor = RecognitionClass();
    if (!Ctor) {
      Voice.onSpeechError?.({ error: { code: 'not-available' } });
      return;
    }
    const recognition = new Ctor();
    Voice._recognition = recognition;
    recognition.lang = locale;
    recognition.continuous = true;
    // The app builds its transcript from partial results and decides when the
    // sentence has ended, so interim results are what it needs.
    recognition.interimResults = true;

    recognition.onresult = (event: unknown) => {
      const results = (event as { results: ArrayLike<ArrayLike<{ transcript: string }>> }).results;
      const phrases: string[] = [];
      for (let i = 0; i < results.length; i += 1) {
        phrases.push(results[i][0].transcript);
      }
      const value = [phrases.join(' ').trim()];
      Voice.onSpeechPartialResults?.({ value });
      Voice.onSpeechResults?.({ value });
    };
    recognition.onerror = event => {
      Voice.onSpeechError?.({ error: { code: event.error } });
    };
    recognition.onend = () => {
      Voice.onSpeechEnd?.();
    };

    recognition.start();
    Voice.onSpeechStart?.();
  },

  async stop(): Promise<void> {
    Voice._recognition?.stop();
  },

  async destroy(): Promise<void> {
    Voice._recognition?.abort();
    Voice._recognition = null;
  },

  removeAllListeners(): void {
    Voice.onSpeechStart = null;
    Voice.onSpeechPartialResults = null;
    Voice.onSpeechResults = null;
    Voice.onSpeechError = null;
    Voice.onSpeechEnd = null;
  },
};

export default Voice;
