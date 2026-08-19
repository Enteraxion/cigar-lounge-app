/**
 * Which single prompt a member sees when several apply.
 *
 * Worth pinning because the failure is invisible: get the order wrong and a
 * member is told to sit tight for a review when the real blocker is a link in
 * their inbox — and nothing errors, nothing logs, they just never finish signing
 * up. The rule is also a product judgement rather than a derivable fact, so it
 * needs to be written down somewhere that fails if it changes by accident.
 */

import { accountPrompt, type AccountPromptInput } from '../accountPrompt';

const NOTHING: AccountPromptInput = {
  wasRejected: false,
  needsId: false,
  awaitingReview: false,
  emailVerified: true,
};

const state = (over: Partial<AccountPromptInput>): AccountPromptInput => ({ ...NOTHING, ...over });

describe('accountPrompt', () => {
  it('shows nothing for a member who owes nothing', () => {
    expect(accountPrompt(NOTHING)).toBe('none');
  });

  it('shows each prompt on its own', () => {
    expect(accountPrompt(state({ wasRejected: true }))).toBe('rejected');
    expect(accountPrompt(state({ needsId: true }))).toBe('needs-id');
    expect(accountPrompt(state({ emailVerified: false }))).toBe('confirm-email');
    expect(accountPrompt(state({ awaitingReview: true }))).toBe('awaiting-review');
  });

  it('never treats an unknown email state as unconfirmed', () => {
    // undefined means "still loading". Reading it as false would flash "confirm
    // your email" at a member who already did, on every cold start.
    expect(accountPrompt(state({ emailVerified: undefined }))).toBe('none');
  });

  describe('ordering', () => {
    it('puts a rejection above everything', () => {
      expect(
        accountPrompt(
          state({ wasRejected: true, needsId: true, awaitingReview: true, emailVerified: false }),
        ),
      ).toBe('rejected');
    });

    it('puts the missing ID above the email', () => {
      expect(accountPrompt(state({ needsId: true, emailVerified: false }))).toBe('needs-id');
    });

    it('puts the email above the review wait', () => {
      // The one that matters most. "Your ID is being reviewed" is informational —
      // there is nothing for the member to do — so it must not hide a prompt they
      // can act on right now. This is the exact state a new member is in seconds
      // after signing up and submitting their ID.
      expect(accountPrompt(state({ awaitingReview: true, emailVerified: false }))).toBe(
        'confirm-email',
      );
    });

    it('falls back to the review wait once the email is confirmed', () => {
      expect(accountPrompt(state({ awaitingReview: true, emailVerified: true }))).toBe(
        'awaiting-review',
      );
    });
  });

  it('returns exactly one prompt for every combination', () => {
    // Guards against a future branch that returns nothing for a member who does in
    // fact owe something — the state would simply go unmentioned.
    const flags = [true, false];
    const emails: (boolean | undefined)[] = [true, false, undefined];
    for (const wasRejected of flags) {
      for (const needsId of flags) {
        for (const awaitingReview of flags) {
          for (const emailVerified of emails) {
            const result = accountPrompt({ wasRejected, needsId, awaitingReview, emailVerified });
            const owesSomething =
              wasRejected || needsId || awaitingReview || emailVerified === false;
            expect(result === 'none').toBe(!owesSomething);
          }
        }
      }
    }
  });
});
