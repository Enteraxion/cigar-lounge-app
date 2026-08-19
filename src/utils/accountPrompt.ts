/**
 * Which single thing to ask a member for, when several are outstanding.
 *
 * A new member can legitimately owe us three things at once: a confirmed email
 * address, a photographed ID, and the wait while somebody reviews it. Showing all
 * of them stacks banners on the first screen of the app and gets none of them
 * read — so exactly one is shown, and this decides which.
 *
 * Split out of the banner component so the ordering can be tested. It is a
 * product judgement rather than an obvious rule, and the reasoning is worth
 * keeping next to it:
 *
 *  1. `rejected` — the most specific and most urgent. Somebody looked at their ID
 *     and said no, and there is a named reason to act on.
 *  2. `needs-id` — they chose "Explore first" and have sent nothing. The largest
 *     outstanding ask, and nothing else on screen reveals it exists.
 *  3. `confirm-email` — actionable and quick, so it outranks the wait below even
 *     though it is the smaller obligation.
 *  4. `awaiting-review` — purely informational. There is nothing for the member to
 *     do, so it yields to anything that asks them for something.
 *
 * Deliberately ordered so an informational message never hides an actionable one.
 */

export type AccountPrompt =
  | 'rejected'
  | 'needs-id'
  | 'confirm-email'
  | 'awaiting-review'
  /** Nothing outstanding — a verified member, or an account predating the gate. */
  | 'none';

export type AccountPromptInput = {
  wasRejected: boolean;
  needsId: boolean;
  awaitingReview: boolean;
  /**
   * False only when we positively know the address is unconfirmed. Undefined
   * while the account is still being read, which must not be mistaken for
   * unconfirmed — that would flash "confirm your email" at a member who already
   * has, every time the app starts.
   */
  emailVerified: boolean | undefined;
};

export function accountPrompt(state: AccountPromptInput): AccountPrompt {
  if (state.wasRejected) {
    return 'rejected';
  }
  if (state.needsId) {
    return 'needs-id';
  }
  if (state.emailVerified === false) {
    return 'confirm-email';
  }
  if (state.awaitingReview) {
    return 'awaiting-review';
  }
  return 'none';
}
