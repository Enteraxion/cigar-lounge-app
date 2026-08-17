/**
 * conciergeMemoryService
 *
 * Everything the Concierge remembers between sessions: saved conversations,
 * the member's personalisation preferences, and the feedback they leave on a
 * recommendation.
 *
 * These three existed only as screens before. Saved Conversations listed
 * three invented chats; AI Settings had toggles that changed nothing; AI
 * Feedback collected a rating and threw it away behind a success message.
 * Each is a small amount of persistence away from being real, and the
 * preferences in particular are the difference between a settings screen
 * that decorates and one that steers — they are sent to the model on every
 * request (see conciergeService.askConcierge).
 */

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from '@react-native-firebase/firestore';
import type {
  AiFeedbackDocument,
  AiPreferences,
  ConversationDocument,
  ConversationTurn,
} from '../types/firestore';

const db = getFirestore();

export type SavedConversation = ConversationDocument & { id: string };

/** What a conversation is called before the member has said anything much. */
const UNTITLED = 'New conversation';

function titleFrom(messages: ConversationTurn[]): string {
  const firstUser = messages.find(turn => turn.role === 'user');
  if (!firstUser?.text.trim()) {
    return UNTITLED;
  }
  const text = firstUser.text.trim();
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function summaryFrom(messages: ConversationTurn[]): string {
  const lastAssistant = [...messages].reverse().find(turn => turn.role === 'assistant');
  const text = lastAssistant?.text.trim() ?? '';
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

// ---------------------------------------------------------------------------
// Saved conversations
// ---------------------------------------------------------------------------

export async function getSavedConversations(
  userId: string,
  max = 30,
): Promise<SavedConversation[]> {
  const snapshot = await getDocs(
    query(
      collection(db, 'users', userId, 'conversations'),
      orderBy('updatedAt', 'desc'),
      limit(max),
    ),
  );
  return snapshot.docs.map(d => ({ id: d.id, ...(d.data() as ConversationDocument) }));
}

/**
 * Creates a conversation, or updates the one already open.
 *
 * Returns the id so the chat screen can keep saving into the same document
 * as the conversation continues rather than leaving a trail of one-turn
 * fragments in the member's list.
 */
export async function saveConversation(
  userId: string,
  messages: ConversationTurn[],
  conversationId?: string,
): Promise<string> {
  const payload = {
    title: titleFrom(messages),
    summary: summaryFrom(messages),
    messages,
    updatedAt: serverTimestamp(),
  };

  if (conversationId) {
    await updateDoc(doc(db, 'users', userId, 'conversations', conversationId), payload);
    return conversationId;
  }
  const created = await addDoc(collection(db, 'users', userId, 'conversations'), {
    ...payload,
    createdAt: serverTimestamp(),
  });
  return created.id;
}

export async function deleteConversation(userId: string, conversationId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', userId, 'conversations', conversationId));
}

export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string,
): Promise<void> {
  await updateDoc(doc(db, 'users', userId, 'conversations', conversationId), {
    title: title.trim() || UNTITLED,
    updatedAt: serverTimestamp(),
  });
}

// ---------------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------------

/**
 * What the Concierge assumes about a member who has never opened AI
 * Settings. Deliberately neutral: an empty atmosphere list means "no
 * preference", which the prompt omits entirely rather than inventing one.
 */
export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  experienceMode: 'business',
  maxTravelDistanceMiles: 25,
  atmospheres: [],
};

export async function saveAiPreferences(
  userId: string,
  preferences: AiPreferences,
): Promise<void> {
  // merge so this never clobbers the rest of the profile document.
  await setDoc(doc(db, 'users', userId), { aiPreferences: preferences }, { merge: true });
}

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export async function submitAiFeedback(
  userId: string,
  feedback: Omit<AiFeedbackDocument, 'createdAt'>,
): Promise<void> {
  await addDoc(collection(db, 'users', userId, 'aiFeedback'), {
    ...feedback,
    createdAt: serverTimestamp(),
  });
}
