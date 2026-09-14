/**
 * voiceSearchService
 *
 * Speech recognition for the microphone on Search and Map, which until
 * 2026-09-13 opened a screen with a pulsing icon that listened to nothing.
 *
 * Kept out of the screen for the usual reason: the screen's job is to show what
 * is happening, and this one's is to deal with a native module that can fail in
 * half a dozen ways a member needs different wording for. Permission refused,
 * no microphone, a language the device cannot transcribe, silence, or simply no
 * network on a device that transcribes server-side — each is a different
 * sentence, and none of them is "something went wrong".
 *
 * **Audio may leave the device.** iOS transcribes on-device for some locales and
 * on Apple's servers for others, and the app cannot choose. That is why
 * NSSpeechRecognitionUsageDescription exists separately from the microphone
 * permission, and why the privacy policy names it.
 */

import Voice, {
  type SpeechErrorEvent,
  type SpeechResultsEvent,
} from '@react-native-voice/voice';

export type VoiceStatus = 'idle' | 'listening' | 'error';

export type VoiceHandlers = {
  /** Fires repeatedly as the phrase is refined — drives the live caption. */
  onPartial: (text: string) => void;
  /** The final transcript. Fires once per session. */
  onResult: (text: string) => void;
  /** Already worded for a member. */
  onError: (message: string) => void;
  /** iOS stopped listening on its own, usually after a pause. */
  onEnd: () => void;
};

/**
 * Turns a native error into something worth reading.
 *
 * The codes are iOS's, and the mapping matters: "permission denied" and "we
 * couldn't hear anything" send a member to two completely different places, and
 * a single "voice search failed" would send them nowhere.
 */
function messageFor(error: SpeechErrorEvent['error']): string {
  const code = error?.code ?? '';
  const message = error?.message ?? '';

  // iOS reports denial through several codes depending on which of the two
  // permissions was refused.
  if (/denied|not authorized|unauthorized|203|7/.test(`${code} ${message}`.toLowerCase())) {
    return 'Allow microphone and speech recognition in Settings to search by voice.';
  }
  if (/no speech|no match|1110|recognition_fail/i.test(`${code} ${message}`)) {
    return "We didn't catch that. Try again, a little closer to the microphone.";
  }
  if (/network|1009|connection/i.test(`${code} ${message}`)) {
    return 'Voice search needs a connection on this device. Check your network and try again.';
  }
  // Deliberately NOT matched on the word "unavailable" alone. iOS reports a
  // finished session and a genuinely unsupported device with overlapping
  // wording, and treating the first as the second told Rohith his working
  // microphone did not exist (2026-09-13).
  if (/1101|kAFAssistantErrorDomain/i.test(`${code} ${message}`)) {
    return 'Voice search is not available on this device right now.';
  }
  return "We couldn't start listening. Try again, or type your search instead.";
}

/** Whether the device can do this at all — false on a simulator, among others. */
export async function isVoiceAvailable(): Promise<boolean> {
  try {
    const available = await Voice.isAvailable();
    // The native module answers with 0/1 on iOS rather than a boolean.
    return !!available;
  } catch {
    /**
     * Assume it works.
     *
     * A throw here means the availability CHECK failed, which is not the same
     * as the microphone being unusable — and refusing to try on that basis is
     * how a working device gets told voice search does not exist. If it really
     * is unavailable, `startListening` will fail in a moment and say so with
     * an error that actually came from trying.
     */
    return true;
  }
}

/**
 * Starts listening. Returns a stop function.
 *
 * Handlers are assigned rather than added, because the native module keeps one
 * listener per event: registering a second screen's handlers without clearing
 * the first would leave the old screen receiving transcripts it can do nothing
 * with. `stop` clears them for that reason, not only to release the microphone.
 */
export async function startListening(handlers: VoiceHandlers): Promise<() => Promise<void>> {
  Voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0];
    if (text) {
      handlers.onPartial(text);
    }
  };
  Voice.onSpeechResults = (event: SpeechResultsEvent) => {
    const text = event.value?.[0];
    if (text) {
      handlers.onResult(text);
    }
  };
  Voice.onSpeechError = (event: SpeechErrorEvent) => {
    handlers.onError(messageFor(event.error));
  };
  Voice.onSpeechEnd = () => handlers.onEnd();

  const stop = async () => {
    try {
      await Voice.stop();
    } catch {
      // Stopping something that already stopped is not a failure.
    }
    try {
      await Voice.destroy();
    } finally {
      Voice.removeAllListeners();
    }
  };

  try {
    // en-US explicitly: the directory, its city names and the brand vocabulary
    // are American, and letting the recogniser follow a device set to another
    // locale produced worse transcripts of the exact words this app searches.
    await Voice.start('en-US');
  } catch (error) {
    await stop();
    throw new Error(
      messageFor({ code: String(error), message: String(error) } as SpeechErrorEvent['error']),
    );
  }

  return stop;
}
