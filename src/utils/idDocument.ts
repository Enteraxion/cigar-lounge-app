/**
 * Which identity documents the 21+ check accepts, and what has to be
 * photographed for each.
 *
 * Dr. Brinkley's ask on 2026-08-19 was to stop asking for "a photo of your ID"
 * and ask for a specific document, front and back. That distinction is the whole
 * point of this module: **"upload your ID" is not one job, it is four**, and the
 * number of photos depends on which one the member picked.
 *
 * A card (licence, state ID, military ID) carries the date of birth on the front
 * and the security features — barcode, magnetic stripe, issuing text — on the
 * back. A reviewer who only ever sees the front can read a date but cannot tell
 * a real card from a colour printout, so both sides are required. A passport is
 * the opposite: everything a reviewer needs is on the single photo page, and
 * asking for "the back of your passport" is asking for a blank cover. Encoding
 * that here rather than in the screen is what lets the gate, the capture UI and
 * the admin review all agree on when a submission is actually finished.
 *
 * The four options are the documents US venues actually accept at the door for
 * alcohol and tobacco. Deliberately not offered: student IDs and work badges
 * (not government-issued, trivially faked) and birth certificates (no
 * photograph, so they prove a date but not that it is *this* member's date).
 *
 * Back-compatibility is load-bearing. Records written before the picker existed
 * have a single `idImageUrl` and no `documentType` at all, and
 * `requiredSides(undefined)` returns just the front so those members are counted
 * as done. Anything else would re-wall people who already sent us an ID —
 * including the accounts the team is testing with.
 */

import type { AgeVerification, IdDocumentType } from '../types/firestore';

export type IdDocumentSide = 'front' | 'back';

export type IdDocumentSpec = {
  id: IdDocumentType;
  label: string;
  /** The one line under the label in the picker: how to know this is your row. */
  hint: string;
  /** Every side that must be photographed before the submission is complete. */
  sides: IdDocumentSide[];
};

export const ID_DOCUMENT_OPTIONS: IdDocumentSpec[] = [
  {
    id: 'drivers_license',
    label: "Driver's License",
    hint: 'US state-issued. Front and back.',
    sides: ['front', 'back'],
  },
  {
    id: 'state_id',
    label: 'State ID Card',
    hint: 'Non-driver photo ID. Front and back.',
    sides: ['front', 'back'],
  },
  {
    id: 'passport',
    label: 'Passport',
    hint: 'Any country. Just the photo page.',
    sides: ['front'],
  },
  {
    id: 'military_id',
    label: 'Military ID',
    hint: 'Common Access Card or dependant ID. Front and back.',
    sides: ['front', 'back'],
  },
];

/**
 * The single side assumed for a record whose document type is unknown.
 *
 * Not a guess about what the member sent — a deliberate decision about what to
 * do with the records that predate this module. See the header.
 */
const LEGACY_SIDES: IdDocumentSide[] = ['front'];

export function documentSpec(type: IdDocumentType | undefined | null): IdDocumentSpec | null {
  return ID_DOCUMENT_OPTIONS.find(option => option.id === type) ?? null;
}

export function requiredSides(type: IdDocumentType | undefined | null): IdDocumentSide[] {
  return documentSpec(type)?.sides ?? LEGACY_SIDES;
}

/** For prose — the admin card, notification copy. */
export function documentLabel(type: IdDocumentType | undefined | null): string {
  return documentSpec(type)?.label ?? 'Photo ID';
}

/**
 * What to call a side on screen.
 *
 * "Front of your passport" is a phrase that makes a member hesitate over which
 * part of the booklet is meant, so a single-sided document names the page
 * instead of a face.
 */
export function sideLabel(type: IdDocumentType | undefined | null, side: IdDocumentSide): string {
  if (requiredSides(type).length === 1) {
    return type === 'passport' ? 'Photo page' : 'Photo of your ID';
  }
  return side === 'front' ? 'Front' : 'Back';
}

/** The instruction under a capture tile — what makes this photo usable. */
export function sideHint(type: IdDocumentType | undefined | null, side: IdDocumentSide): string {
  if (type === 'passport') {
    return 'The page with your photo and date of birth';
  }
  return side === 'front'
    ? 'The side with your photo and date of birth'
    : 'The side with the barcode';
}

/** The stored URL for one side, or undefined when it has not been sent. */
export function imageForSide(
  verification: Pick<AgeVerification, 'idImageUrl' | 'idBackImageUrl'> | null | undefined,
  side: IdDocumentSide,
): string | undefined {
  if (!verification) {
    return undefined;
  }
  return side === 'front' ? verification.idImageUrl : verification.idBackImageUrl;
}

/** Sides still owed for this record, in capture order. */
export function missingSides(
  verification:
    | Pick<AgeVerification, 'documentType' | 'idImageUrl' | 'idBackImageUrl'>
    | null
    | undefined,
): IdDocumentSide[] {
  return requiredSides(verification?.documentType).filter(
    side => !imageForSide(verification, side),
  );
}

/**
 * Whether everything this document needs has been supplied.
 *
 * This is what the app gate reads, so it is the difference between reaching the
 * app and being held at the upload screen.
 */
export function isSubmissionComplete(
  verification:
    | Pick<AgeVerification, 'documentType' | 'idImageUrl' | 'idBackImageUrl'>
    | null
    | undefined,
): boolean {
  return !!verification && missingSides(verification).length === 0;
}
