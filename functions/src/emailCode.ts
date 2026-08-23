/**
 * The two primitives behind the 6-digit email verification code.
 *
 * In their own module so they can be unit-tested. Importing index.ts from a test
 * pulls in the whole firebase-functions runtime, which does not load outside a
 * Functions environment — the same reason validation.ts exists separately.
 */

import { createHash, randomInt } from 'node:crypto';

/**
 * Hashes a code for storage.
 *
 * Salted with the uid so the same code drawn for two members does not produce
 * the same stored hash. To be honest about what this does and does not buy: a
 * 6-digit space is small enough that anyone holding the hash can brute-force it
 * instantly, so this protects against a *read* of the document — a
 * misconfigured rule, a Firestore export, someone browsing the console — and
 * nothing more. The real defences are the attempt limit and the expiry in
 * index.ts. firestore.rules denies this collection to every client, and there
 * are tests in integration/rules.test.ts pinning that.
 */
export function hashCode(uid: string, code: string): string {
  return createHash('sha256').update(`${uid}:${code}`).digest('hex');
}

/**
 * A uniformly random 6-digit code.
 *
 * `randomInt`, not `Math.random` — this is a credential, and Math.random is
 * seeded predictably enough to be guessable. padStart matters as much: for the
 * number 42, `String(...)` gives "42", and roughly one code in ten falls below
 * 100000. Without the padding those members would receive a short code the
 * app's own six-digit check would refuse to submit.
 */
export function generateCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}
