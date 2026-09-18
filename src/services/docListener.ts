/**
 * Listen to one Firestore document, on a phone.
 *
 * This exists only because the two Firebase SDKs disagree about where
 * `onSnapshot` lives. @react-native-firebase/firestore has no modular
 * `onSnapshot` export — the method is on the reference itself at runtime, and
 * the modular DocumentReference type does not declare it. The web SDK is the
 * other way round: a real `onSnapshot(ref, next, error)` function, and no
 * method on the reference. Calling the method on the web throws
 * "onSnapshot is not a function", which is what the first browser run did.
 *
 * So the difference is isolated here, in the smallest module that can hold it,
 * and docListener.web.ts is the browser half. Callers pass a reference and get
 * an unsubscribe back either way.
 *
 * The cast is deliberate and narrow — the exact shape used, not `any`, so a
 * signature change still fails the build.
 */
type Listenable = {
  onSnapshot: (
    next: (snapshot: DocSnapshot | null) => void,
    error: (e: unknown) => void,
  ) => () => void;
};

export type DocSnapshot = { exists: () => boolean; data: () => unknown };

export function listenToDoc(
  reference: unknown,
  next: (snapshot: DocSnapshot | null) => void,
  onError: (e: unknown) => void,
): () => void {
  return (reference as Listenable).onSnapshot(next, onError);
}
