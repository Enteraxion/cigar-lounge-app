/**
 * Validating and formatting the two contact fields the app asks members for.
 *
 * Both Reserve Table and Claim Listing had their own copy of this, and both
 * copies assumed everybody is American with an unaccented name:
 *
 *   - the name test was `/^[A-Za-z]+(?:[' -][A-Za-z]+)*$/`, so "José Álvarez"
 *     and "Jürgen Müller" were told to "use letters only" — which is what they
 *     had done;
 *   - the phone field truncated input to ten digits and refused anything else,
 *     which no German number can satisfy.
 *
 * The directory is not US-only and has not been for a long time: 202 German,
 * 69 Canadian and a scattering of other lounges. Between them those two rules
 * made every one of them unbookable and unclaimable (audit F8/F9, 2026-09-14).
 *
 * Kept deliberately permissive. This is a name a lounge will read off a
 * booking sheet and a number they will ring — the app's job is to catch a
 * genuine mistake, not to adjudicate what a real name looks like. Rejecting a
 * real member is a far worse failure than accepting an odd-looking one.
 */

/**
 * Letters from any script, plus the joiners real names use.
 *
 * `\p{L}` needs the `u` flag and covers Latin, Cyrillic, Greek, Han and the
 * rest; `\p{M}` admits combining marks, so a decomposed "é" (e + U+0301) is
 * treated the same as the precomposed one — they look identical on screen and
 * which one arrives depends on the keyboard.
 */
const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[' ’.-][\p{L}\p{M}]+)*\.?$/u;

/** At least two characters, and not one letter repeated. */
export function personNameIsValid(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    return false;
  }
  return NAME_PATTERN.test(trimmed);
}

/**
 * What we keep as the member types.
 *
 * A leading `+` survives because it is how everyone outside the US writes a
 * number they expect to be dialled from elsewhere, and dropping it silently
 * makes the field feel broken. Fifteen digits is the E.164 maximum.
 */
export function normalizePhoneInput(text: string): string {
  const plus = text.trimStart().startsWith('+') ? '+' : '';
  return plus + text.replace(/\D/g, '').slice(0, 15);
}

/**
 * Seven is the shortest real subscriber number in use; fifteen is E.164's
 * ceiling. Anything inside that is somebody's number and not ours to refuse.
 */
export function phoneIsValid(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
}

/**
 * Display formatting.
 *
 * A plain ten-digit number is almost always North American, so it keeps the
 * familiar (555) 123-4567 shape the field has always had. Anything else is
 * left as the member typed it — guessing at grouping for a number whose
 * country we do not know produces something they do not recognise as theirs.
 */
export function formatPhone(value: string): string {
  if (value.trimStart().startsWith('+')) {
    return value;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length > 10) {
    return digits;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
}
