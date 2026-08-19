/**
 * Reading the date of birth straight off an identity document.
 *
 * Rohith, 2026-08-19, after weighing the automated-verification options: do the
 * free one. Every US driving licence and state ID carries a PDF417 barcode on the
 * back encoding the holder's details in the AAMVA standard, and every passport
 * carries a machine-readable zone on its photo page. Both can be read on-device,
 * so the app can know the date of birth rather than asking a person to read it
 * off a photograph.
 *
 * WHAT THIS IS FOR, AND WHAT IT IS NOT
 *
 * It replaces *transcription*, not *judgement*. A barcode is trivially printable,
 * so a decoded date proves only that the document says so — not that the document
 * is genuine. And because this runs on the phone, its output must never be what
 * grants verification: a modified client could simply assert a date. The result is
 * evidence put in front of the reviewer (and a way to catch an unreadable photo
 * before it is uploaded), not a decision. Auto-approval needs the same decode
 * performed server-side, where the client cannot forge it.
 *
 * THE TRAP IN AAMVA
 *
 * `DBB` holds the date of birth, but its layout changed between revisions of the
 * standard: version 01 used CCYYMMDD, US versions 02 and later use MMDDCCYY, and
 * Canadian issuers stayed on CCYYMMDD. Reading the wrong one does not error — it
 * silently yields a different, plausible date, on some states only. Rather than
 * trusting the version header (which is wrong or missing on real cards), this
 * disambiguates on the value: no month can be 19 or 20, so a field beginning with
 * either is unambiguously CCYYMMDD.
 *
 * THE TRAP IN MRZ
 *
 * The MRZ gives a two-digit year with no century, so 05 is either 1905 or 2005.
 * It is resolved against today: a birth date cannot be in the future. Each date
 * also carries a check digit, and it is verified — without that, OCR noise ("8"
 * read as "B") produces a wrong date instead of no date.
 */

import type { BirthDate } from './ageCheck';

export type ScanSource = 'aamva' | 'mrz';

export type ScannedDocument = {
  dateOfBirth: BirthDate;
  /** Present on both formats; used to spot a document that has expired. */
  expiryDate?: BirthDate;
  familyName?: string;
  givenName?: string;
  documentNumber?: string;
  source: ScanSource;
};

// ---------------------------------------------------------------------------
// AAMVA (PDF417 on the back of US/Canadian cards)
// ---------------------------------------------------------------------------

/**
 * Data element identifiers we read. The payload carries dozens; these are the
 * only ones an age check has any business looking at.
 */
const AAMVA_DOB = 'DBB';
const AAMVA_EXPIRY = 'DBA';
const AAMVA_FAMILY_NAME = 'DCS';
const AAMVA_GIVEN_NAME = 'DAC';
const AAMVA_DOCUMENT_NUMBER = 'DAQ';

/**
 * Splits the payload into its three-letter data elements.
 *
 * Elements are separated by LF in the spec, but real scanners return CR, CRLF or
 * the record separator depending on the encoder, so all of them are treated as
 * breaks. The subfile header is skipped rather than parsed: its offsets are
 * frequently wrong on issued cards, and the elements are self-describing.
 */
/**
 * Strips the header so the first data element is not lost with it.
 *
 * On a real card the header runs straight into the first element on the same
 * line — `...ZC03290015DL` `DCSPUBLIC` — so splitting on separators alone drops
 * whichever element happens to come first. Which element that is varies by
 * issuer, so on some states' cards the casualty is the date of birth.
 *
 * Offsets in the header are not used to find the data: they are frequently wrong
 * on issued cards, and the layout itself differs between version 01 and later
 * revisions. Instead this finds the subfile designators — a two-letter type plus
 * eight digits, e.g. `DL00410288` — and cuts after the last one, then skips the
 * two-character subfile type that opens the subfile proper. That holds for every
 * revision, because the designators are the one part whose shape never changed.
 */
function stripAamvaHeader(raw: string): string {
  // Anchored at the start, and it must be. Searching the payload for designators
  // finds false ones in the data: an eight-digit date element like `DBD08242017`
  // contains `BD` followed by exactly eight digits, which is indistinguishable
  // from a designator in isolation. Only position tells them apart.
  //
  // The digit run after the six-digit IIN is the version and entry-count fields,
  // whose width differs between revision 01 and later ones — matched loosely and
  // left to backtracking rather than pinned to a version this cannot trust.
  const header = /^[\s\S]{0,12}?(?:ANSI|AAMVA)\s?\d{6}\d{2,6}(?:[A-Z]{2}\d{8})+/.exec(raw);
  if (!header) {
    return raw;
  }
  // The subfile opens by repeating its own two-character type before the first
  // element, so skip it — otherwise `DL` + `DCS...` parses as the bogus code `DLD`.
  return raw.slice(header[0].length + 2);
}

function aamvaElements(raw: string): Map<string, string> {
  const elements = new Map<string, string>();
  for (const line of stripAamvaHeader(raw).split(/[\r\n\x1e\x1f]+/)) {
    const trimmed = line.trim();
    // A data element is a three-character uppercase code plus its value. The
    // header line ("ANSI 636014090002DL...") is longer but starts with "ANSI" or
    // "AAMVA", so it is excluded by the code pattern below.
    const match = /^([A-Z]{3})(.*)$/.exec(trimmed);
    if (!match) {
      continue;
    }
    const [, code, value] = match;
    if (code === 'ANS' || code === 'AAM') {
      continue;
    }
    if (!elements.has(code)) {
      elements.set(code, value.trim());
    }
  }
  return elements;
}

/**
 * Reads an 8-digit AAMVA date, deciding its layout from the value itself.
 *
 * See the header: the standard's own version field cannot be relied on, but the
 * value disambiguates itself because no month is 19 or 20.
 */
function parseAamvaDate(value: string | undefined): BirthDate | null {
  if (!value || !/^\d{8}$/.test(value)) {
    return null;
  }
  const leading = value.slice(0, 2);
  if (leading === '19' || leading === '20') {
    // CCYYMMDD — version 01, and all Canadian issuers.
    return validated({
      year: Number(value.slice(0, 4)),
      month: Number(value.slice(4, 6)),
      day: Number(value.slice(6, 8)),
    });
  }
  // MMDDCCYY — US, version 02 onwards.
  return validated({
    year: Number(value.slice(4, 8)),
    month: Number(value.slice(0, 2)),
    day: Number(value.slice(2, 4)),
  });
}

/** Rejects a structurally impossible date rather than passing it on. */
function validated(date: BirthDate): BirthDate | null {
  const { year, month, day } = date;
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  if (year < 1900 || year > 2100) {
    return null;
  }
  // Catches 31 February and the like: the Date constructor rolls those over, so a
  // round trip that changes the day means the input was not a real date.
  const probe = new Date(year, month - 1, day);
  if (probe.getFullYear() !== year || probe.getMonth() !== month - 1 || probe.getDate() !== day) {
    return null;
  }
  return date;
}

export function parseAamva(raw: string): ScannedDocument | null {
  // The compliance indicator is the one reliable marker that this is an AAMVA
  // payload at all, rather than some other barcode that happened to scan.
  if (!/(ANSI|AAMVA)\s?\d{6}/.test(raw)) {
    return null;
  }
  const elements = aamvaElements(raw);
  const dateOfBirth = parseAamvaDate(elements.get(AAMVA_DOB));
  if (!dateOfBirth) {
    return null;
  }
  const expiryDate = parseAamvaDate(elements.get(AAMVA_EXPIRY));
  return {
    dateOfBirth,
    ...(expiryDate ? { expiryDate } : {}),
    ...(elements.get(AAMVA_FAMILY_NAME) ? { familyName: elements.get(AAMVA_FAMILY_NAME) } : {}),
    ...(elements.get(AAMVA_GIVEN_NAME) ? { givenName: elements.get(AAMVA_GIVEN_NAME) } : {}),
    ...(elements.get(AAMVA_DOCUMENT_NUMBER)
      ? { documentNumber: elements.get(AAMVA_DOCUMENT_NUMBER) }
      : {}),
    source: 'aamva',
  };
}

// ---------------------------------------------------------------------------
// MRZ (the two machine-readable lines on a passport's photo page)
// ---------------------------------------------------------------------------

/** Weights cycle 7-3-1 across the field, per ICAO 9303. */
const MRZ_WEIGHTS = [7, 3, 1];

/**
 * The ICAO check-digit calculation.
 *
 * Digits count as themselves, letters as A=10 through Z=35, and the filler '<'
 * as zero.
 */
function mrzCheckDigit(field: string): number {
  let sum = 0;
  for (let index = 0; index < field.length; index += 1) {
    const character = field[index];
    let value: number;
    if (character >= '0' && character <= '9') {
      value = Number(character);
    } else if (character >= 'A' && character <= 'Z') {
      value = character.charCodeAt(0) - 55;
    } else if (character === '<') {
      value = 0;
    } else {
      return -1;
    }
    sum += value * MRZ_WEIGHTS[index % 3];
  }
  return sum % 10;
}

/**
 * Resolves a two-digit MRZ year to a full one.
 *
 * A date of birth cannot be in the future, which settles every case: '05' read in
 * 2026 is 2005, while '95' is 1995. `reference` is injected so the rule can be
 * tested without waiting for a century to turn.
 */
function mrzBirthYear(twoDigit: number, reference: Date): number {
  const currentTwoDigit = reference.getFullYear() % 100;
  const century = Math.floor(reference.getFullYear() / 100) * 100;
  return twoDigit <= currentTwoDigit ? century + twoDigit : century - 100 + twoDigit;
}

function parseMrzDate(field: string, year: number): BirthDate | null {
  return validated({
    year,
    month: Number(field.slice(2, 4)),
    day: Number(field.slice(4, 6)),
  });
}

/**
 * Reads a TD3 passport MRZ.
 *
 * Only the second line is needed for an age check; the first carries names. Both
 * are located by shape rather than by position in the OCR output, because text
 * recognition returns the page's lines in no guaranteed order and often includes
 * surrounding print.
 */
export function parseMrz(text: string, now: Date = new Date()): ScannedDocument | null {
  const candidates = text
    .toUpperCase()
    .split(/[\r\n]+/)
    .map(line => line.replace(/\s+/g, ''))
    .filter(line => line.length >= 44);

  for (const line of candidates) {
    const second = line.slice(0, 44);
    // Line 2 of a TD3: 9-character document number, its check digit, a 3-letter
    // nationality, then the date of birth and its own check digit.
    const match = /^([A-Z0-9<]{9})([0-9<])([A-Z<]{3})(\d{6})(\d)([MF<])(\d{6})(\d)/.exec(second);
    if (!match) {
      continue;
    }
    const [, documentNumber, , , dobField, dobCheck, , expiryField, expiryCheck] = match;
    // Verified rather than assumed: without this a misread digit yields a
    // confident wrong date, which is worse than no date at all.
    if (mrzCheckDigit(dobField) !== Number(dobCheck)) {
      continue;
    }
    const dateOfBirth = parseMrzDate(dobField, mrzBirthYear(Number(dobField.slice(0, 2)), now));
    if (!dateOfBirth) {
      continue;
    }

    // An expiry is in the future, so its century resolves the opposite way to a
    // birth date. Treated as optional: a failed expiry must not discard a
    // perfectly good date of birth.
    let expiryDate: BirthDate | null = null;
    if (mrzCheckDigit(expiryField) === Number(expiryCheck)) {
      const twoDigit = Number(expiryField.slice(0, 2));
      const century = Math.floor(now.getFullYear() / 100) * 100;
      expiryDate = parseMrzDate(expiryField, century + twoDigit);
    }

    return {
      dateOfBirth,
      ...(expiryDate ? { expiryDate } : {}),
      ...(documentNumber.replace(/</g, '') ? { documentNumber: documentNumber.replace(/</g, '') } : {}),
      source: 'mrz',
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// What the capture screen and the admin screen actually call
// ---------------------------------------------------------------------------

/** Tries both formats, so a caller does not have to know what it scanned. */
export function readDocument(raw: string, now: Date = new Date()): ScannedDocument | null {
  return parseAamva(raw) ?? parseMrz(raw, now);
}

export type ScanComparison =
  /** The document agrees with what the member typed at sign-up. */
  | { kind: 'match'; scanned: ScannedDocument }
  /**
   * The document is readable but says a different date. Never auto-rejected —
   * a transposed digit at sign-up is far commoner than a forged licence, and
   * refusing outright would strand an honest member with no way to explain.
   */
  | { kind: 'mismatch'; scanned: ScannedDocument; declared: BirthDate }
  /** Readable, agrees, and the holder is under age. */
  | { kind: 'underage'; scanned: ScannedDocument }
  /** The document has expired. Worth flagging; not grounds to refuse by itself. */
  | { kind: 'expired'; scanned: ScannedDocument }
  /** Nothing decodable. The commonest cause is a photo too blurry or too dark. */
  | { kind: 'unreadable' };

function sameDate(a: BirthDate, b: BirthDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * Compares a scan against the date the member declared at sign-up.
 *
 * Ordering is deliberate. An expired document is reported only when the dates
 * otherwise agree, because "expired" is the least actionable of these and would
 * mask a mismatch that a reviewer needs to see.
 */
export function compareToDeclared(
  raw: string,
  declared: BirthDate,
  minimumAge: number,
  now: Date = new Date(),
): ScanComparison {
  const scanned = readDocument(raw, now);
  if (!scanned) {
    return { kind: 'unreadable' };
  }
  if (!sameDate(scanned.dateOfBirth, declared)) {
    return { kind: 'mismatch', scanned, declared };
  }
  const { year, month, day } = scanned.dateOfBirth;
  let age = now.getFullYear() - year;
  const beforeBirthday =
    now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day);
  if (beforeBirthday) {
    age -= 1;
  }
  if (age < minimumAge) {
    return { kind: 'underage', scanned };
  }
  if (scanned.expiryDate) {
    const expiry = new Date(
      scanned.expiryDate.year,
      scanned.expiryDate.month - 1,
      scanned.expiryDate.day,
    );
    if (expiry.getTime() < now.getTime()) {
      return { kind: 'expired', scanned };
    }
  }
  return { kind: 'match', scanned };
}
