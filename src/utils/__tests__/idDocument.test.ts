/**
 * The rules that decide when an ID submission is finished.
 *
 * Worth testing directly because `isSubmissionComplete` is what the app gate
 * reads: get it wrong one way and a member with half a licence photographed
 * reaches the app, get it wrong the other way and members who verified before
 * the document picker existed are locked out of an app they already use.
 */

import type { AgeVerification } from '../../types/firestore';
import {
  ID_DOCUMENT_OPTIONS,
  documentLabel,
  documentSpec,
  imageForSide,
  isSubmissionComplete,
  missingSides,
  requiredSides,
  sideHint,
  sideLabel,
} from '../idDocument';

const stamp = { seconds: 0, nanoseconds: 0, toDate: () => new Date(0) };

function record(over: Partial<AgeVerification> = {}): AgeVerification {
  return { dateOfBirth: '1990-01-01', status: 'pending', submittedAt: stamp, ...over };
}

describe('the option list', () => {
  it('offers exactly the documents US venues accept at the door', () => {
    expect(ID_DOCUMENT_OPTIONS.map(o => o.id)).toEqual([
      'drivers_license',
      'state_id',
      'passport',
      'military_id',
    ]);
  });

  it('gives every option a label and a hint, since a bare id reads as a bug', () => {
    for (const option of ID_DOCUMENT_OPTIONS) {
      expect(option.label.length).toBeGreaterThan(0);
      expect(option.hint.length).toBeGreaterThan(0);
    }
  });

  it('asks for both sides of every card and one page of a passport', () => {
    expect(requiredSides('drivers_license')).toEqual(['front', 'back']);
    expect(requiredSides('state_id')).toEqual(['front', 'back']);
    expect(requiredSides('military_id')).toEqual(['front', 'back']);
    expect(requiredSides('passport')).toEqual(['front']);
  });

  it('always puts the front first, so capture order matches the tiles', () => {
    for (const option of ID_DOCUMENT_OPTIONS) {
      expect(option.sides[0]).toBe('front');
    }
  });
});

describe('unknown document types', () => {
  it('treats a record with no documentType as single-sided', () => {
    // The whole point: accounts that verified before the picker existed carry a
    // lone idImageUrl. Asking them for a back would re-wall people who are done.
    expect(requiredSides(undefined)).toEqual(['front']);
  });

  it('has no spec and a generic label', () => {
    expect(documentSpec(undefined)).toBeNull();
    expect(documentLabel(undefined)).toBe('Photo ID');
  });
});

describe('isSubmissionComplete', () => {
  it('is false for a record with no images at all', () => {
    expect(isSubmissionComplete(record())).toBe(false);
    expect(missingSides(record())).toEqual(['front']);
  });

  it('is false for a licence with only the front photographed', () => {
    const partial = record({ documentType: 'drivers_license', idImageUrl: 'front.jpg' });
    expect(isSubmissionComplete(partial)).toBe(false);
    expect(missingSides(partial)).toEqual(['back']);
  });

  it('is true once both sides of a licence are in', () => {
    expect(
      isSubmissionComplete(
        record({
          documentType: 'drivers_license',
          idImageUrl: 'front.jpg',
          idBackImageUrl: 'back.jpg',
        }),
      ),
    ).toBe(true);
  });

  it('is true for a passport with only its photo page', () => {
    expect(
      isSubmissionComplete(record({ documentType: 'passport', idImageUrl: 'page.jpg' })),
    ).toBe(true);
  });

  it('grandfathers a legacy single-image record with no documentType', () => {
    expect(isSubmissionComplete(record({ idImageUrl: 'legacy.jpg' }))).toBe(true);
  });

  it('is false for a missing record rather than throwing', () => {
    expect(isSubmissionComplete(null)).toBe(false);
    expect(isSubmissionComplete(undefined)).toBe(false);
  });

  it('ignores a stray back image on a passport instead of demanding one', () => {
    // A member who switched from a licence to a passport; attachIdDocument clears
    // the old back, but a stale value must not change the verdict either way.
    expect(
      isSubmissionComplete(
        record({ documentType: 'passport', idImageUrl: 'page.jpg', idBackImageUrl: 'stale.jpg' }),
      ),
    ).toBe(true);
  });
});

describe('imageForSide', () => {
  it('maps front to idImageUrl and back to idBackImageUrl', () => {
    const full = record({ idImageUrl: 'f.jpg', idBackImageUrl: 'b.jpg' });
    expect(imageForSide(full, 'front')).toBe('f.jpg');
    expect(imageForSide(full, 'back')).toBe('b.jpg');
  });

  it('is undefined for a missing record', () => {
    expect(imageForSide(null, 'front')).toBeUndefined();
  });
});

describe('on-screen wording', () => {
  it('names the passport page rather than calling it a front', () => {
    // "Front of your passport" makes a member stop and wonder which part of the
    // booklet is meant.
    expect(sideLabel('passport', 'front')).toBe('Photo page');
    expect(sideHint('passport', 'front')).toContain('photo and date of birth');
  });

  it('says Front and Back for a two-sided card', () => {
    expect(sideLabel('drivers_license', 'front')).toBe('Front');
    expect(sideLabel('drivers_license', 'back')).toBe('Back');
  });

  it('points at the date of birth on the front and the barcode on the back', () => {
    expect(sideHint('state_id', 'front')).toContain('date of birth');
    expect(sideHint('state_id', 'back')).toContain('barcode');
  });

  it('falls back to a neutral label for an unknown single-sided document', () => {
    expect(sideLabel(undefined, 'front')).toBe('Photo of your ID');
  });
});
