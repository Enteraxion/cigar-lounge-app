/**
 * Listen to one Firestore document, in a browser. See docListener.ts for why
 * the two platforms need different code for this single call.
 */
import { onSnapshot, type DocumentReference } from '@react-native-firebase/firestore';

export type DocSnapshot = { exists: () => boolean; data: () => unknown };

export function listenToDoc(
  reference: unknown,
  next: (snapshot: DocSnapshot | null) => void,
  onError: (e: unknown) => void,
): () => void {
  return onSnapshot(reference as DocumentReference, snapshot => next(snapshot as DocSnapshot), onError);
}
