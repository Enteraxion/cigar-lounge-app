/**
 * The message shown when an action needs 21+ verification.
 *
 * Step 4 of the 21+ flow (Dr. Brinkley, 2026-08-19): writing a review, reserving
 * a table and claiming a business are gated on verification, while browsing is
 * not.
 *
 * One place rather than three copies of an Alert, because the wording is the
 * part that matters. A member blocked here has already done what was asked —
 * they uploaded an ID — so the message must read as a status, not a refusal, and
 * must never imply they missed a step.
 */

export type GatedAction = 'review' | 'reservation' | 'claim';

const WHAT: Record<GatedAction, string> = {
  review: 'write a review',
  reservation: 'reserve a table',
  claim: 'claim a business',
};

export function verificationGateMessage(
  action: GatedAction,
  state: { awaitingReview: boolean; wasRejected: boolean },
): { title: string; body: string } {
  if (state.wasRejected) {
    return {
      title: 'Verification needed',
      body: `We couldn't verify the ID you sent, so you can't ${WHAT[action]} yet. You can upload another photo from your profile.`,
    };
  }
  if (state.awaitingReview) {
    // Deliberately not an apology and not an instruction: they have already done
    // their part, and there is nothing here for them to fix.
    return {
      title: 'Still being reviewed',
      body: `Your ID is with our team. You'll be able to ${WHAT[action]} as soon as it's checked — we'll notify you.`,
    };
  }
  return {
    title: 'Verify your age first',
    body: `Lounge Locator needs to confirm you're 21 or over before you can ${WHAT[action]}. You can upload a photo of your ID from your profile.`,
  };
}
