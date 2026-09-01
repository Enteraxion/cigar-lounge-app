/**
 * The 21+ decision.
 *
 * These are the tests that matter most in this project. Every case below is one
 * where letting the wrong thing through has a real consequence: an under-age
 * member inside a 21+ app, or an honest member wrongly refused and gone.
 *
 * The rule the whole suite is really checking: **anything uncertain must go to a
 * person, never through.** A missing date of birth, an unreadable field, a
 * mismatch — none of those may approve.
 */

import { ageOn, parseIsoDate, reviewDocument } from './idReview';

const NOW = new Date(Date.UTC(2026, 7, 31)); // 2026-08-31
const ADULT = '1990-05-12';

describe('reviewDocument — approving', () => {
  it('approves when the document matches the declared date and the member is over 21', () => {
    const out = reviewDocument({ dateOfBirth: ADULT, legible: true }, ADULT, NOW);
    expect(out.decision).toBe('approve');
  });

  it('approves a document with no expiry date printed on it', () => {
    // Some IDs do not print one. Absent must not be read as expired.
    const out = reviewDocument({ dateOfBirth: ADULT, expiryDate: null }, ADULT, NOW);
    expect(out.decision).toBe('approve');
  });
});

describe('reviewDocument — refusing', () => {
  it('rejects an under-age member even when everything else agrees', () => {
    const under = '2010-01-01';
    const out = reviewDocument({ dateOfBirth: under }, under, NOW);
    expect(out.decision).toBe('reject');
    expect(out).toMatchObject({ memberMessage: expect.stringContaining('21') });
  });

  it('rejects someone who turns 21 tomorrow', () => {
    // The boundary is the case a lazy implementation gets wrong.
    const out = reviewDocument({ dateOfBirth: '2005-09-01' }, '2005-09-01', NOW);
    expect(out.decision).toBe('reject');
  });

  it('approves someone whose 21st birthday is today', () => {
    const out = reviewDocument({ dateOfBirth: '2005-08-31' }, '2005-08-31', NOW);
    expect(out.decision).toBe('approve');
  });

  it('rejects an expired document', () => {
    const out = reviewDocument(
      { dateOfBirth: ADULT, expiryDate: '2025-01-01' },
      ADULT,
      NOW,
    );
    expect(out.decision).toBe('reject');
    expect(out.reason).toContain('expired');
  });

  it('rejects something that is not an identity document', () => {
    const out = reviewDocument({ notAnIdReason: 'a bank card' }, ADULT, NOW);
    expect(out.decision).toBe('reject');
  });

  it('rejects an unreadable photo, and says how to fix it', () => {
    const out = reviewDocument({ legible: false }, ADULT, NOW);
    expect(out.decision).toBe('reject');
    expect(out).toMatchObject({ memberMessage: expect.stringContaining('light') });
  });
});

describe('reviewDocument — telling the member what to do', () => {
  it('NEVER approves when the date of birth could not be read', () => {
    // The single most important case. An absent date is not a pass — whatever
    // else changes about the wording, this assertion must not weaken to
    // "anything but approve" being acceptable only sometimes.
    for (const dob of [null, undefined, '', 'unknown', '12/05/1990', '1990-13-45']) {
      const out = reviewDocument({ dateOfBirth: dob as string | null }, ADULT, NOW);
      expect(out.decision).not.toBe('approve');
      // And it says so, rather than leaving them on a silent queue: a clearer
      // photograph is the one thing that resolves this, and until 2026-08-31
      // nobody was told to take one.
      expect(out).toMatchObject({ action: 'retake' });
    }
  });

  it('sends a date mismatch to the member, not to a human', () => {
    // This referred silently until 2026-08-31. A mismatch is usually a typo at
    // sign-up rather than a lie — and the member could not see it, could not
    // correct it (nothing in the app or the portal edited the date) and so
    // waited on an administrator for a mistake only they could have fixed.
    const out = reviewDocument({ dateOfBirth: '1990-05-21' }, ADULT, NOW);
    expect(out.decision).toBe('reject');
    expect(out).toMatchObject({ action: 'fix_date_of_birth' });
    // The reason carries both dates for our logs...
    expect(out.reason).toContain('1990-05-21');
  });

  it('never quotes the date it read back to the member', () => {
    // The member can read their own document. Echoing what our reading
    // extracted tells anyone submitting a borrowed or altered ID exactly what
    // we saw, which is free calibration for the next attempt.
    const out = reviewDocument({ dateOfBirth: '1990-05-21' }, ADULT, NOW);
    expect(out).toMatchObject({ memberMessage: expect.any(String) });
    expect('memberMessage' in out && out.memberMessage).not.toContain('1990');
    expect('memberMessage' in out && out.memberMessage).not.toContain('05-21');
  });

  it('points at the account, not the camera, when the declared date is missing', () => {
    // Nothing is wrong with their document. Sending them back to photograph it
    // again would be the wrong instruction, which is why the remedy is named
    // separately from the message.
    const out = reviewDocument({ dateOfBirth: ADULT }, '', NOW);
    expect(out.decision).toBe('reject');
    expect(out).toMatchObject({ action: 'fix_date_of_birth' });
  });

  it('offers no remedy to someone genuinely under age', () => {
    // Offering the camera here would invite them to try a different document.
    const out = reviewDocument({ dateOfBirth: '2010-01-01' }, '2010-01-01', NOW);
    expect(out.decision).toBe('reject');
    expect(out).toMatchObject({ action: 'none' });
  });

  it('gives every rejection something the member can read', () => {
    // The whole point of the 2026-08-31 change: no outcome leaves them staring
    // at an unexplained screen.
    const cases = [
      reviewDocument({ notAnIdReason: 'a bank card' }, ADULT, NOW),
      reviewDocument({ legible: false }, ADULT, NOW),
      reviewDocument({ dateOfBirth: null }, ADULT, NOW),
      reviewDocument({ dateOfBirth: ADULT }, '', NOW),
      reviewDocument({ dateOfBirth: '1990-05-21' }, ADULT, NOW),
    ];
    for (const out of cases) {
      expect(out.decision).toBe('reject');
      expect('memberMessage' in out && out.memberMessage.length).toBeGreaterThan(20);
    }
  });

  it('does not refer merely because the model guessed a different document type', () => {
    // It confuses a state ID with a driving licence often enough that enforcing
    // agreement would refer honest submissions for nothing.
    const out = reviewDocument(
      { dateOfBirth: ADULT, documentKind: 'state_id' },
      ADULT,
      NOW,
    );
    expect(out.decision).toBe('approve');
  });
});

describe('parseIsoDate', () => {
  it('refuses a date that does not exist', () => {
    // Date would roll 2001-02-30 forward into March and report success.
    expect(parseIsoDate('2001-02-30')).toBeNull();
    expect(parseIsoDate('2026-02-29')).toBeNull();
  });

  it('accepts a real leap day', () => {
    expect(parseIsoDate('2024-02-29')).not.toBeNull();
  });

  it('refuses anything that is not yyyy-mm-dd', () => {
    for (const bad of ['12/05/1990', '1990-5-12', '', 'yesterday']) {
      expect(parseIsoDate(bad)).toBeNull();
    }
  });
});

describe('ageOn', () => {
  it('does not count a birthday that has not happened yet this year', () => {
    expect(ageOn(new Date(Date.UTC(2000, 11, 31)), NOW)).toBe(25);
    expect(ageOn(new Date(Date.UTC(2000, 0, 1)), NOW)).toBe(26);
  });
});
