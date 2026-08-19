/**
 * Decoding a date of birth off a licence barcode or a passport MRZ.
 *
 * Tested hard because the failure mode is silence. A misparsed AAMVA date field
 * does not throw — it produces a different, entirely plausible date, on some
 * states' cards and not others. The same is true of an MRZ digit misread by OCR.
 * A wrong date that looks right is worse here than no date at all, since the whole
 * point is to give a reviewer something they can rely on.
 */

import {
  compareToDeclared,
  parseAamva,
  parseMrz,
  readDocument,
} from '../idBarcode';

/** A realistic PDF417 payload, of the shape scanners actually return. */
function aamvaPayload(over: Record<string, string> = {}): string {
  const fields: Record<string, string> = {
    DCS: 'PUBLIC',
    DAC: 'JOHN',
    DAD: 'QUINCY',
    DBD: '08242017',
    DBB: '05271988',
    DBA: '02282034',
    DBC: '1',
    DAQ: 'D1234562',
    DAG: '789 E OAK ST',
    DAI: 'ANYTOWN',
    DAJ: 'CA',
    ...over,
  };
  const body = Object.entries(fields)
    .map(([code, value]) => `${code}${value}`)
    .join('\n');
  return `@\n\rANSI 636014090002DL00410288ZC03290015DL${body}\r`;
}

describe('AAMVA (US licences and state IDs)', () => {
  it('reads the date of birth from a US MMDDCCYY field', () => {
    const result = parseAamva(aamvaPayload());
    expect(result?.dateOfBirth).toEqual({ year: 1988, month: 5, day: 27 });
    expect(result?.source).toBe('aamva');
  });

  it('reads names and the document number', () => {
    const result = parseAamva(aamvaPayload());
    expect(result?.familyName).toBe('PUBLIC');
    expect(result?.givenName).toBe('JOHN');
    expect(result?.documentNumber).toBe('D1234562');
  });

  it('reads the first element, which sits glued to the header line', () => {
    // The bug this guards: on a real card the header runs straight into the first
    // element, so a naive split loses it. Whichever element an issuer puts first
    // varies — on some cards that is the date of birth itself.
    const dobFirst = `@\n\rANSI 636014090002DL00410288ZC03290015DLDBB05271988\nDCSPUBLIC\r`;
    expect(parseAamva(dobFirst)?.dateOfBirth).toEqual({ year: 1988, month: 5, day: 27 });
    expect(parseAamva(dobFirst)?.familyName).toBe('PUBLIC');
  });

  it('reads the expiry date', () => {
    expect(parseAamva(aamvaPayload())?.expiryDate).toEqual({ year: 2034, month: 2, day: 28 });
  });

  it('reads a CCYYMMDD field, as version 01 and Canadian issuers emit', () => {
    // The trap this module exists for. Same person, other layout.
    const result = parseAamva(aamvaPayload({ DBB: '19880527' }));
    expect(result?.dateOfBirth).toEqual({ year: 1988, month: 5, day: 27 });
  });

  it('does not confuse a December date for a year', () => {
    // '12' leads a MMDDCCYY December date and could be mistaken for a century.
    const result = parseAamva(aamvaPayload({ DBB: '12251995' }));
    expect(result?.dateOfBirth).toEqual({ year: 1995, month: 12, day: 25 });
  });

  it('handles CR and CRLF separators, not just LF', () => {
    // Real encoders differ; the spec says LF and plenty of them do not.
    const crlf = aamvaPayload().replace(/\n/g, '\r\n');
    expect(parseAamva(crlf)?.dateOfBirth).toEqual({ year: 1988, month: 5, day: 27 });
  });

  it('returns null for a payload that is not AAMVA at all', () => {
    // e.g. the QR code on a receipt that happened to be in frame.
    expect(parseAamva('https://example.com/some-other-barcode')).toBeNull();
  });

  it('returns null when the date of birth element is missing', () => {
    const withoutDob = aamvaPayload();
    expect(parseAamva(withoutDob.replace('DBB05271988\n', ''))).toBeNull();
  });

  it('rejects an impossible date rather than passing it on', () => {
    expect(parseAamva(aamvaPayload({ DBB: '02301988' }))).toBeNull();
    expect(parseAamva(aamvaPayload({ DBB: '13011988' }))).toBeNull();
  });

  it('rejects a truncated date field', () => {
    expect(parseAamva(aamvaPayload({ DBB: '0527' }))).toBeNull();
  });

  it('survives a missing expiry without losing the birth date', () => {
    const noExpiry = aamvaPayload().replace('DBA02282034\n', '');
    const result = parseAamva(noExpiry);
    expect(result?.dateOfBirth).toEqual({ year: 1988, month: 5, day: 27 });
    expect(result?.expiryDate).toBeUndefined();
  });
});

describe('MRZ (passports)', () => {
  const LINE1 = 'P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<';
  const NOW = new Date(2026, 7, 19);

  /**
   * ICAO 9303's own worked example, character for character.
   *
   * Hardcoded rather than generated: it is the one fixture here that verifies the
   * check-digit arithmetic independently. A builder that computes its own check
   * digits would agree with a wrong implementation.
   */
  const ICAO_EXAMPLE = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';

  /** Builds a TD3 line 2, computing the check digits the way a real issuer does. */
  function line2(dobYYMMDD: string, expiryYYMMDD: string): string {
    const check = (field: string) => {
      const weights = [7, 3, 1];
      let sum = 0;
      for (let i = 0; i < field.length; i += 1) {
        const c = field[i];
        const v = c === '<' ? 0 : c >= '0' && c <= '9' ? Number(c) : c.charCodeAt(0) - 55;
        sum += v * weights[i % 3];
      }
      return String(sum % 10);
    };
    const head = `L898902C36UTO${dobYYMMDD}${check(dobYYMMDD)}M${expiryYYMMDD}${check(expiryYYMMDD)}`;
    return `${head}${'<'.repeat(14)}02`;
  }

  const LINE2 = line2('880527', '340526');

  it("decodes ICAO 9303's own worked example", () => {
    expect(parseMrz(ICAO_EXAMPLE, NOW)?.dateOfBirth).toEqual({ year: 1974, month: 8, day: 12 });
  });

  it('reads the date of birth from the second line', () => {
    const result = parseMrz(`${LINE1}\n${LINE2}`, NOW);
    expect(result?.dateOfBirth).toEqual({ year: 1988, month: 5, day: 27 });
    expect(result?.source).toBe('mrz');
  });

  it('finds the line wherever it appears in the OCR output', () => {
    // Text recognition returns a page's lines in no guaranteed order, and usually
    // includes the printed fields above the MRZ too.
    const messy = `PASSPORT\nSURNAME ERIKSSON\n${LINE2}\n${LINE1}\n`;
    expect(parseMrz(messy, NOW)?.dateOfBirth).toEqual({ year: 1988, month: 5, day: 27 });
  });

  it('tolerates spaces the recogniser inserts', () => {
    const spaced = LINE2.replace(/(.{10})/g, '$1 ');
    expect(parseMrz(spaced, NOW)?.dateOfBirth).toEqual({ year: 1988, month: 5, day: 27 });
  });

  it('refuses a date whose check digit does not agree', () => {
    // The property that keeps OCR noise out. One digit changed, check digit stale.
    const corrupted = LINE2.replace('880527', '880528');
    expect(parseMrz(corrupted, NOW)).toBeNull();
  });

  it('reads a 2000s birth year as this century, not the last', () => {
    // '05' is 2005, not 1905 — a 21-year-old in 2026.
    expect(parseMrz(line2('050314', '340526'), NOW)?.dateOfBirth).toEqual({
      year: 2005,
      month: 3,
      day: 14,
    });
  });

  it('reads a 1990s birth year as the last century', () => {
    // '95' cannot be 2095 — that is in the future.
    expect(parseMrz(line2('950602', '340526'), NOW)?.dateOfBirth).toEqual({
      year: 1995,
      month: 6,
      day: 2,
    });
  });

  it('returns null for text with no MRZ in it', () => {
    expect(parseMrz('UNITED STATES OF AMERICA\nPASSPORT', NOW)).toBeNull();
  });

  it('returns null for a line too short to be a TD3', () => {
    expect(parseMrz('L898902C36UTO880527', NOW)).toBeNull();
  });
});

describe('readDocument', () => {
  it('recognises an AAMVA payload without being told', () => {
    expect(readDocument(aamvaPayload())?.source).toBe('aamva');
  });

  it('recognises an MRZ without being told', () => {
    // ICAO's worked example again, so this does not depend on a local builder.
    const line = 'L898902C36UTO7408122F1204159ZE184226B<<<<<10';
    expect(readDocument(line, new Date(2026, 7, 19))?.source).toBe('mrz');
  });

  it('returns null for anything else', () => {
    expect(readDocument('just some text')).toBeNull();
  });
});

describe('compareToDeclared', () => {
  const NOW = new Date(2026, 7, 19);
  const DECLARED = { year: 1988, month: 5, day: 27 };

  it('matches when the document agrees with the sign-up form', () => {
    const result = compareToDeclared(aamvaPayload(), DECLARED, 21, NOW);
    expect(result.kind).toBe('match');
  });

  it('reports a mismatch rather than refusing outright', () => {
    // A transposed digit at sign-up is far commoner than a forged licence, so this
    // has to reach a person who can ask, not end the member's evening.
    const result = compareToDeclared(aamvaPayload(), { year: 1988, month: 5, day: 28 }, 21, NOW);
    expect(result.kind).toBe('mismatch');
    if (result.kind === 'mismatch') {
      expect(result.scanned.dateOfBirth).toEqual(DECLARED);
      expect(result.declared).toEqual({ year: 1988, month: 5, day: 28 });
    }
  });

  it('flags an under-21 holder even when the document agrees', () => {
    const dob = { year: 2010, month: 1, day: 1 };
    const result = compareToDeclared(aamvaPayload({ DBB: '01012010' }), dob, 21, NOW);
    expect(result.kind).toBe('underage');
  });

  it('flags an expired document', () => {
    const result = compareToDeclared(aamvaPayload({ DBA: '02282020' }), DECLARED, 21, NOW);
    expect(result.kind).toBe('expired');
  });

  it('reports a mismatch ahead of an expiry, since expiry is the lesser problem', () => {
    // An expired card that also disagrees on the date must not be filed as merely
    // expired — that would hide the thing a reviewer needs to see.
    const result = compareToDeclared(
      aamvaPayload({ DBA: '02282020' }),
      { year: 1990, month: 1, day: 1 },
      21,
      NOW,
    );
    expect(result.kind).toBe('mismatch');
  });

  it('reports unreadable for a photo nothing could be decoded from', () => {
    expect(compareToDeclared('', DECLARED, 21, NOW).kind).toBe('unreadable');
  });

  it('counts age correctly the day before a birthday', () => {
    // Turns 21 tomorrow, so still refused today.
    const dob = { year: 2005, month: 8, day: 20 };
    const result = compareToDeclared(aamvaPayload({ DBB: '08202005' }), dob, 21, NOW);
    expect(result.kind).toBe('underage');
  });

  it('counts age correctly on the birthday itself', () => {
    const dob = { year: 2005, month: 8, day: 19 };
    const result = compareToDeclared(aamvaPayload({ DBB: '08192005' }), dob, 21, NOW);
    expect(result.kind).toBe('match');
  });
});
