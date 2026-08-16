/**
 * conciergeService
 *
 * Client half of the AI Concierge. The model call itself lives in the
 * `askConcierge` Cloud Function (functions/src/index.ts) — an Anthropic API
 * key shipped inside a React Native bundle is a published API key, so the
 * app never holds one and never talks to Anthropic directly.
 *
 * The function returns the reply plus the ids of any lounges it recommended,
 * chosen from real Firestore documents it was given. This file turns those
 * ids back into full lounge objects so the chat can render the app's real
 * lounge cards — the same cards as Search and Home, tapping through to the
 * same detail screen.
 */

import { getFunctions, httpsCallable } from '@react-native-firebase/functions';
import { getLoungesByIds, type Lounge } from './loungeService';

const functions = getFunctions();

export type ConciergeTurn = { role: 'user' | 'assistant'; text: string };

export type ConciergeAnswer = {
  reply: string;
  /** Real lounges the concierge recommended, in the order it ranked them. */
  lounges: Lounge[];
};

type AskConciergeResult = { reply: string; loungeIds: string[] };

/**
 * Sends the conversation so far and returns the concierge's next reply.
 *
 * `city` scopes which lounges the function offers the model to choose from —
 * pass the member's home city or current city when known. Without it the
 * function falls back to the highest-rated lounges overall, so the concierge
 * still answers with real venues rather than failing.
 */
export async function askConcierge(
  messages: ConciergeTurn[],
  city?: string,
): Promise<ConciergeAnswer> {
  const callable = httpsCallable<
    { messages: ConciergeTurn[]; city?: string },
    AskConciergeResult
  >(functions, 'askConcierge');

  const { data } = await callable({ messages, city });

  // A recommendation the member can't open is worse than none, so the ids
  // are resolved to real documents before they reach the UI; anything that
  // no longer exists simply drops out (getLoungesByIds skips missing ids).
  const lounges = data.loungeIds?.length ? await getLoungesByIds(data.loungeIds) : [];
  return { reply: data.reply, lounges };
}
