/**
 * Deciding what to do with an identity document once a model has read it.
 *
 * Julian asked on 2026-08-25 for AI verification so a person no longer has to
 * approve every 21+ submission. This is the half of that which decides; the
 * reading happens in index.ts.
 *
 * Kept pure and separate because the judgement is the part worth testing. The
 * interesting question is not "does it call the model" but "what does it let
 * through", and every branch below is a case where letting the wrong thing
 * through has a consequence — an under-age member inside a 21+ app, or a real
 * member wrongly refused and gone.
 *
 * **What this deliberately does not attempt.** It cannot tell a genuine document
 * from a good forgery. Holograms, microprint, UV features and the feel of the
 * card do not survive a phone photograph, and a model asked "is this real?"
 * answers confidently either way. So nothing here treats the model's confidence
 * as evidence of authenticity. What it establishes is narrower and still useful:
 * that a legible document exists, that its printed date of birth matches what
 * the member typed, and that it has not expired.
 *
 * Everything it cannot settle goes to the queue a human already works from, so
 * the failure mode is "an administrator looks at it", never "it is approved
 * because nothing objected".
 */

/** What the model is asked to extract. Every field may be absent. */
export type ReadDocument = {
  /** ISO yyyy-mm-dd, as printed on the document. */
  dateOfBirth?: string | null;
  /** ISO yyyy-mm-dd. Absent on documents that do not print one. */
  expiryDate?: string | null;
  /** What the model believes it is looking at. */
  documentKind?: 'drivers_license' | 'state_id' | 'passport' | 'military_id' | 'other' | null;
  /** False when the image is too blurred, cropped or dark to read. */
  legible?: boolean | null;
  /** Set when the image is not an identity document at all. */
  notAnIdReason?: string | null;
};

export type ReviewOutcome =
  | { decision: 'approve'; reason: string }
  | { decision: 'reject'; reason: string; memberMessage: string }
  | { decision: 'refer'; reason: string };

/** Parses yyyy-mm-dd strictly. Anything else is "we do not know". */
export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Rejects 2001-02-30, which Date would otherwise roll forward into March.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

export function ageOn(birth: Date, when: Date): number {
  let age = when.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = when.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && when.getUTCDate() < birth.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export const MINIMUM_AGE = 21;

/**
 * Turns what the model read into a decision.
 *
 * `declaredDateOfBirth` is what the member typed at sign-up. The comparison
 * between that and the document is the whole point: a member who lies about
 * their age has to lie consistently in two places, one of which is a photograph
 * of a government document.
 */
export function reviewDocument(
  read: ReadDocument,
  declaredDateOfBirth: string,
  now: Date = new Date(),
): ReviewOutcome {
  // Not an identity document at all. Rejected rather than referred: this needs
  // the member to do something, and waiting on a human to tell them so wastes
  // their time and ours.
  if (read.notAnIdReason) {
    return {
      decision: 'reject',
      reason: `not an identity document: ${read.notAnIdReason}`,
      memberMessage:
        "That doesn't look like an identity document. Please photograph your driving licence, state ID, passport or military ID.",
    };
  }

  if (read.legible === false) {
    return {
      decision: 'reject',
      reason: 'illegible image',
      memberMessage:
        "We couldn't read that clearly. Try again in better light, with the whole document flat in the frame.",
    };
  }

  const documentDob = parseIsoDate(read.dateOfBirth);
  const declaredDob = parseIsoDate(declaredDateOfBirth);

  // Anything unreadable goes to a person rather than being guessed at. This is
  // the branch that keeps the whole feature honest — an absent date of birth is
  // not a pass.
  if (!documentDob) {
    return { decision: 'refer', reason: 'could not read a date of birth' };
  }
  if (!declaredDob) {
    return { decision: 'refer', reason: 'no usable declared date of birth on file' };
  }

  // Expiry is checked before age. An expired licence may still show a valid date
  // of birth, but accepting one means accepting a document its issuer has
  // withdrawn.
  const expiry = parseIsoDate(read.expiryDate);
  if (expiry && expiry.getTime() < now.getTime()) {
    return {
      decision: 'reject',
      reason: `document expired ${read.expiryDate}`,
      memberMessage:
        'That document has expired. Please use one that is still in date.',
    };
  }

  if (documentDob.getTime() !== declaredDob.getTime()) {
    // Referred, not rejected. A mismatch is usually a typo at sign-up rather
    // than a lie, and calling an honest member a liar automatically is a worse
    // error than asking someone to look.
    return {
      decision: 'refer',
      reason: `document says ${read.dateOfBirth}, member declared ${declaredDateOfBirth}`,
    };
  }

  const age = ageOn(documentDob, now);
  if (age < MINIMUM_AGE) {
    return {
      decision: 'reject',
      reason: `under age: ${age}`,
      memberMessage: `Lounge Locator is for adults aged ${MINIMUM_AGE} and over.`,
    };
  }

  // The model's own idea of the document type is deliberately NOT compared
  // against what the member selected. It confuses a state ID with a driving
  // licence often enough that enforcing agreement would refer honest
  // submissions, and nothing downstream depends on which of the two it was.

  return { decision: 'approve', reason: `date of birth matches, age ${age}` };
}
