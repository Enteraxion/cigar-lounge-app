/**
 * The message shown when an action needs a verified account.
 *
 * Step 4 of the 21+ flow (Dr. Brinkley, 2026-08-19): writing a review, reserving
 * a table and claiming a business are gated, while browsing is not. Email
 * confirmation (Rohith, same day) gates the same three.
 *
 * One place rather than three copies of an Alert, because the wording is the part
 * that matters. Two rules it has to hold to:
 *
 * **Name every outstanding thing at once.** Reported by Rohith on 2026-08-19:
 * tapping "Claim this business" said only "confirm your email", when that member
 * also had no ID on file. Clearing the email would have produced a second refusal
 * naming a second requirement — a member finds out what is being asked of them one
 * rejection at a time, which reads as the app moving the goalposts.
 *
 * **Never claim we sent something we might not have.** The old wording asserted
 * "We sent a link to your email address". For any account created before the
 * sending code shipped, or where the send failed, that was simply false — and the
 * member would go hunting an inbox for a link that was never sent. It now offers
 * to send one instead, which is true either way.
 */

export type GatedAction = 'review' | 'reservation' | 'claim';

const WHAT: Record<GatedAction, string> = {
  review: 'write a review',
  reservation: 'reserve a table',
  claim: 'claim a business',
};

export type VerificationGateState = {
  awaitingReview: boolean;
  wasRejected: boolean;
  isVerified?: boolean;
  /**
   * `null` means no verification record at all — an account predating the 21+
   * gate. Age is deliberately not a blocker for those, so they must not be told
   * to verify it.
   */
  verification?: unknown;
  /** Only `false` means positively unconfirmed; undefined means not yet known. */
  emailVerified?: boolean;
};

export type VerificationGateMessage = {
  title: string;
  body: string;
  /**
   * True when an email link is part of what's outstanding, so the caller can put
   * a "Send link" button on the alert rather than a dead OK.
   */
  offerResend: boolean;
};

/** What the member still owes on the age side, if anything. */
type AgeBlocker = 'rejected' | 'reviewing' | 'not-sent' | null;

function ageBlocker(state: VerificationGateState): AgeBlocker {
  if (state.isVerified || state.verification === null) {
    return null;
  }
  if (state.wasRejected) {
    return 'rejected';
  }
  if (state.awaitingReview) {
    return 'reviewing';
  }
  return 'not-sent';
}

/** The age half of the sentence, phrased as something to do. */
const AGE_TODO: Record<Exclude<AgeBlocker, null>, string> = {
  rejected: 'send us a clearer photo of your ID',
  // Phrased as a wait, not a task — there is nothing for them to do here, and
  // telling them to act would send them looking for a step that does not exist.
  reviewing: 'wait for our team to finish checking your ID',
  'not-sent': 'verify your age with a photo of your ID',
};

const EMAIL_TODO = 'confirm your email address';

export function verificationGateMessage(
  action: GatedAction,
  state: VerificationGateState,
): VerificationGateMessage {
  const age = ageBlocker(state);
  const emailOutstanding = state.emailVerified === false;
  const what = WHAT[action];

  // Both outstanding — say so in one message. See the header for why.
  if (emailOutstanding && age) {
    return {
      title: 'Two things first',
      body:
        `Before you can ${what} we need to ${EMAIL_TODO} and ${AGE_TODO[age]}.` +
        (age === 'reviewing'
          ? " Your ID is already with us, so that part is under way."
          : '') +
        " We can email you the confirmation link now — the ID is in your profile.",
      offerResend: true,
    };
  }

  if (emailOutstanding) {
    return {
      title: 'Confirm your email',
      body: `Tap the link in the email we send you and you'll be able to ${what}.`,
      offerResend: true,
    };
  }

  if (age === 'rejected') {
    return {
      title: 'Verification needed',
      body: `We couldn't verify the ID you sent, so you can't ${what} yet. You can upload another photo from your profile.`,
      offerResend: false,
    };
  }

  if (age === 'reviewing') {
    // Deliberately not an apology and not an instruction: they have already done
    // their part, and there is nothing here for them to fix.
    return {
      title: 'Still being reviewed',
      body: `Your ID is with our team. You'll be able to ${what} as soon as it's checked — we'll notify you.`,
      offerResend: false,
    };
  }

  return {
    title: 'Verify your age first',
    body: `Lounge Locator needs to confirm you're 21 or over before you can ${what}. You can upload a photo of your ID from your profile.`,
    offerResend: false,
  };
}
