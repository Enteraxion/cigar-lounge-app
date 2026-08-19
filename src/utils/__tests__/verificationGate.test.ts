/**
 * Wording for the 21+ action gate.
 *
 * Tested because the wording is the whole substance of this module. A member
 * blocked here has already done what was asked — they uploaded an ID — so the
 * message has to read as a status rather than a refusal, and must never tell
 * them to do something they have already done.
 */

import { verificationGateMessage } from '../verificationGate';

const AWAITING = { awaitingReview: true, wasRejected: false };
const REJECTED = { awaitingReview: false, wasRejected: true };
const NEITHER = { awaitingReview: false, wasRejected: false };

describe('verificationGateMessage', () => {
  it('names the specific action, not "this feature"', () => {
    expect(verificationGateMessage('review', AWAITING).body).toContain('write a review');
    expect(verificationGateMessage('reservation', AWAITING).body).toContain('reserve a table');
    expect(verificationGateMessage('claim', AWAITING).body).toContain('claim a business');
  });

  it('does not ask a waiting member to upload anything', () => {
    // They already did. Telling them to upload again is the single worst thing
    // this message could say.
    const body = verificationGateMessage('review', AWAITING).body.toLowerCase();
    expect(body).not.toContain('upload');
    expect(body).toContain('notify');
  });

  it('does tell a rejected member how to fix it', () => {
    const body = verificationGateMessage('review', REJECTED).body.toLowerCase();
    expect(body).toContain('another photo');
  });

  it('distinguishes all three states', () => {
    const titles = [AWAITING, REJECTED, NEITHER].map(s => verificationGateMessage('review', s).title);
    expect(new Set(titles).size).toBe(3);
  });

  it('always produces a non-empty title and body', () => {
    for (const action of ['review', 'reservation', 'claim'] as const) {
      for (const state of [AWAITING, REJECTED, NEITHER]) {
        const m = verificationGateMessage(action, state);
        expect(m.title.length).toBeGreaterThan(0);
        expect(m.body.length).toBeGreaterThan(0);
      }
    }
  });

  describe('unconfirmed email', () => {
    /** Email unconfirmed, age already approved — email is the only thing owed. */
    const EMAIL_ONLY = {
      awaitingReview: false,
      wasRejected: false,
      isVerified: true,
      emailVerified: false,
    };

    it('names the action, like every other branch', () => {
      expect(verificationGateMessage('review', EMAIL_ONLY).body).toContain('write a review');
      expect(verificationGateMessage('reservation', EMAIL_ONLY).body).toContain('reserve a table');
      expect(verificationGateMessage('claim', EMAIL_ONLY).body).toContain('claim a business');
    });

    it('points at the emailed link rather than at a screen in the app', () => {
      // "Verify your email" alone sends people hunting for a screen that does not
      // exist. The link arrives in their mail.
      expect(verificationGateMessage('review', EMAIL_ONLY).body.toLowerCase()).toContain('link');
      expect(verificationGateMessage('review', EMAIL_ONLY).title).toBe('Confirm your email');
    });

    it('never asserts a link was already sent', () => {
      // The bug: for accounts created before the sending code shipped, or where the
      // send failed, "we sent a link" was false and sent members hunting an inbox
      // for something that did not exist.
      const body = verificationGateMessage('review', EMAIL_ONLY).body.toLowerCase();
      expect(body).not.toContain('we sent');
      expect(body).not.toContain('we have sent');
    });

    it('offers to send the link, so the alert has something to do', () => {
      expect(verificationGateMessage('review', EMAIL_ONLY).offerResend).toBe(true);
    });

    it('is silent when the email state is unknown', () => {
      // undefined is "still loading" — it must not produce an email message.
      const loading = { awaitingReview: true, wasRejected: false, emailVerified: undefined };
      const result = verificationGateMessage('review', loading);
      expect(result.title).not.toBe('Confirm your email');
      expect(result.offerResend).toBe(false);
    });
  });

  describe('when both the email and the ID are outstanding', () => {
    // Rohith, 2026-08-19: tapping "Claim this business" named only the email, when
    // that member also had no ID on file. Clearing the email would have produced a
    // second refusal naming a second requirement — the member learns what is being
    // asked one rejection at a time, which reads as the goalposts moving.

    it('names both in one message', () => {
      const both = { awaitingReview: false, wasRejected: false, emailVerified: false };
      const { title, body } = verificationGateMessage('claim', both);
      expect(title).toBe('Two things first');
      expect(body.toLowerCase()).toContain('email');
      expect(body.toLowerCase()).toContain('id');
      expect(body).toContain('claim a business');
    });

    it('says the ID is already under way when it is being reviewed', () => {
      // Not phrased as a task: there is nothing for them to do about the review.
      const both = { awaitingReview: true, wasRejected: false, emailVerified: false };
      const body = verificationGateMessage('claim', both).body.toLowerCase();
      expect(body).toContain('wait for our team');
      expect(body).toContain('under way');
    });

    it('asks for a clearer photo when the ID was rejected', () => {
      const both = { awaitingReview: false, wasRejected: true, emailVerified: false };
      expect(verificationGateMessage('claim', both).body).toContain('clearer photo');
    });

    it('still offers to send the link', () => {
      const both = { awaitingReview: false, wasRejected: true, emailVerified: false };
      expect(verificationGateMessage('claim', both).offerResend).toBe(true);
    });

    it('does not ask a grandfathered account to verify its age', () => {
      // verification === null is an account predating the 21+ gate. Age is
      // deliberately not a blocker for them, so only the email is owed.
      const grandfathered = {
        awaitingReview: false,
        wasRejected: false,
        verification: null,
        emailVerified: false,
      };
      expect(verificationGateMessage('claim', grandfathered).title).toBe('Confirm your email');
    });
  });
});
