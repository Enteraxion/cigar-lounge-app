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
 *
 * **Every outcome now says something to the member.** Rohith, 2026-08-31: "if
 * there is any error, it should clearly tell the user what went wrong so they
 * can correct it and re-upload". Before that, a referral wrote nothing at all —
 * the member saw the same "Awaiting review" card whether we had read their
 * document and wanted a second opinion, whether Azure was down, or whether the
 * code was not deployed. Three different situations, one indistinguishable
 * screen, and no way for the member to act on any of them.
 *
 * So each outcome carries a `memberMessage` and an `action` naming the one thing
 * that will actually resolve it. `refer` survives for the cases where that thing
 * is genuinely "wait" — an outage, or a reading we do not trust — and it is the
 * only outcome that leaves the member with nothing to do.
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

/**
 * What will actually fix this, from the member's side.
 *
 * The app renders a different control for each: a camera for `retake`, a date
 * field for `fix_date_of_birth`, and neither for `none`, where nothing the
 * member does will change the answer.
 */
export type ReviewAction = 'retake' | 'fix_date_of_birth' | 'none';

export type ReviewOutcome =
  | { decision: 'approve'; reason: string }
  | { decision: 'reject'; reason: string; memberMessage: string; action: ReviewAction }
  | { decision: 'refer'; reason: string; memberMessage: string };

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
      action: 'retake',
    };
  }

  if (read.legible === false) {
    return {
      decision: 'reject',
      reason: 'illegible image',
      memberMessage:
        "We couldn't read that clearly. Try again in better light, with the whole document flat in the frame.",
      action: 'retake',
    };
  }

  const documentDob = parseIsoDate(read.dateOfBirth);
  const declaredDob = parseIsoDate(declaredDateOfBirth);

  // An absent date of birth is never a pass — that is the branch that keeps the
  // whole feature honest. It used to refer, which was safe but silent: the
  // member was left on "Awaiting review" when a clearer photograph was the one
  // thing that would have resolved it in seconds. It tells them now.
  if (!documentDob) {
    return {
      decision: 'reject',
      reason: 'could not read a date of birth',
      memberMessage:
        "We couldn't read the date of birth on your document. Photograph it again with the whole document flat in the frame and the date clearly in view.",
      action: 'retake',
    };
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
        'That document has expired. Please send one that is still in date.',
      action: 'retake',
    };
  }

  // Age is settled from the DOCUMENT, and settled here — before anything that
  // compares it against what the member typed.
  //
  // The order matters, and getting it wrong was a real fault: with the mismatch
  // checked first, an under-21 document whose date disagreed with the account
  // was answered with "correct your date of birth". That invites someone we are
  // about to refuse to adjust their answer. They would still have been rejected
  // on the next pass — the age has always come from the document — but we should
  // never have asked.
  //
  // Checking it here is also what makes the correction field safe to offer at
  // all: by the time a mismatch is reported, the document has already proved
  // its holder is 21 or over, so editing the declared date cannot gain anybody
  // anything. It reconciles an account with a document we have already accepted.
  const age = ageOn(documentDob, now);
  if (age < MINIMUM_AGE) {
    return {
      decision: 'reject',
      reason: `under age: ${age}`,
      memberMessage: `Lounge Locator is for adults aged ${MINIMUM_AGE} and over.`,
      // Nothing they can send will change this. Offering a camera would invite
      // them to try a different document, which is not what we want to suggest.
      action: 'none',
    };
  }

  // From here on we are reconciling the account against a document that has
  // already passed on its own terms — readable, in date, and 21 or over. Only
  // now is it safe to send anybody to a date field.

  // Nothing wrong with their document; the date on their account is missing or
  // malformed. Sending them back to the camera would be the wrong instruction,
  // which is exactly why the remedy is named separately from the message.
  if (!declaredDob) {
    return {
      decision: 'reject',
      reason: 'no usable declared date of birth on file',
      memberMessage:
        "We don't have a valid date of birth on your account, so there's nothing to check your document against. Enter it below and we'll check your ID again.",
      action: 'fix_date_of_birth',
    };
  }

  if (documentDob.getTime() !== declaredDob.getTime()) {
    // This used to refer, on the reasoning that a mismatch is usually a typo at
    // sign-up and calling an honest member a liar automatically is the worse
    // error. That reasoning still holds — and referring silently served it
    // badly. The member was never told, could not have corrected the date if
    // they had been (nothing in the app or the admin portal edits it), and so
    // waited on a human for a typo only they could see. Saying what disagreed
    // and offering the field is the fix; it is not an accusation.
    //
    // The date we read is deliberately NOT quoted back. The member can read
    // their own document, and echoing what our reading extracted tells anyone
    // submitting a borrowed or altered ID exactly what we saw.
    return {
      decision: 'reject',
      reason: `document says ${read.dateOfBirth}, member declared ${declaredDateOfBirth}`,
      memberMessage:
        "The date of birth on your document doesn't match the one on your account. Check the date below, correct it if it's wrong, and send your ID again.",
      action: 'fix_date_of_birth',
    };
  }

  // The model's own idea of the document type is deliberately NOT compared
  // against what the member selected. It confuses a state ID with a driving
  // licence often enough that enforcing agreement would refer honest
  // submissions, and nothing downstream depends on which of the two it was.

  return { decision: 'approve', reason: `date of birth matches, age ${age}` };
}
