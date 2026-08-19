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
});
