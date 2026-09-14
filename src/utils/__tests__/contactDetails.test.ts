import {
  formatPhone,
  normalizePhoneInput,
  personNameIsValid,
  phoneIsValid,
} from '../contactDetails';

describe('personNameIsValid', () => {
  it('accepts the names the old regex rejected', () => {
    // The exact failure: 202 German and 69 Canadian lounges in the directory,
    // and anyone whose name carries an accent was told to "use letters only".
    for (const name of ['José Álvarez', 'Jürgen Müller', 'Renée Ó Súilleabháin', 'Łukasz Nowak']) {
      expect(personNameIsValid(name)).toBe(true);
    }
  });

  it('still accepts everything it accepted before', () => {
    for (const name of ["O'Brien", 'Jean-Luc Picard', 'Rohith Akepati', 'Mary Jane Watson']) {
      expect(personNameIsValid(name)).toBe(true);
    }
  });

  it('accepts non-Latin scripts', () => {
    for (const name of ['Даниил Медведев', '山田太郎', 'Γιώργος Παπαδόπουλος']) {
      expect(personNameIsValid(name)).toBe(true);
    }
  });

  it('treats a decomposed accent the same as a precomposed one', () => {
    // Which one arrives depends on the keyboard; they render identically.
    expect(personNameIsValid('José Álvarez')).toBe(true);
  });

  it('rejects what is plainly not a name', () => {
    for (const name of ['', ' ', 'J', '12345', 'name@example.com', '<script>', '555-1234']) {
      expect(personNameIsValid(name)).toBe(false);
    }
  });
});

describe('phone numbers', () => {
  it('accepts a German number, which the ten-digit rule could not', () => {
    expect(phoneIsValid('+49 30 12345678')).toBe(true);
    expect(phoneIsValid('4930123456')).toBe(true);
  });

  it('still accepts a US number', () => {
    expect(phoneIsValid('(832) 977-8964')).toBe(true);
  });

  it('rejects too short and too long', () => {
    expect(phoneIsValid('12345')).toBe(false);
    expect(phoneIsValid('1234567890123456')).toBe(false);
  });

  it('keeps a leading plus while typing', () => {
    expect(normalizePhoneInput('+49 30 1234')).toBe('+49301234');
    expect(normalizePhoneInput('(832) 977-8964')).toBe('8329778964');
  });

  it('caps at the E.164 maximum of fifteen digits', () => {
    expect(normalizePhoneInput('1'.repeat(30)).replace('+', '')).toHaveLength(15);
  });

  it('formats a ten-digit number the way it always did', () => {
    expect(formatPhone('8329778964')).toBe('(832) 977-8964');
    expect(formatPhone('832')).toBe('832');
    expect(formatPhone('832977')).toBe('(832) 977');
  });

  it('leaves an international number alone rather than guessing its grouping', () => {
    expect(formatPhone('+49301234567')).toBe('+49301234567');
    expect(formatPhone('49301234567')).toBe('49301234567');
  });
});
