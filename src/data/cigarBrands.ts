/**
 * A curated reference list of real, well-known cigar brands — used for
 * EditProfileScreen's "Favorite Brand" autocomplete (Julian Brinkley's
 * TestFlight feedback, 2026-08-13). Unlike a Firestore-backed list, this
 * isn't sourced from user data — there's no brand field tracked anywhere
 * in this app's schema yet (reviews/humidor items don't capture one) —
 * but every name here is a real, existing cigar manufacturer, same
 * "bundled real-world reference data" approach as src/data/usCities.json.
 * Typing a brand not on this list is still accepted and saved as-is
 * (see AutocompleteField in EditProfileScreen.tsx) — this only supplies
 * suggestions, it never blocks free text.
 */
export const CIGAR_BRANDS: string[] = [
  'Padrón',
  'Arturo Fuente',
  'Cohiba',
  'Davidoff',
  'Montecristo',
  'Romeo y Julieta',
  'My Father Cigars',
  'Liga Privada',
  'Oliva',
  'Rocky Patel',
  'Ashton',
  'La Aurora',
  'Perdomo',
  'CAO',
  'Camacho',
  'Nat Sherman',
  'Macanudo',
  'Punch',
  'Hoyo de Monterrey',
  'Partagás',
  'H. Upmann',
  'Diplomatico',
  'Drew Estate',
  'Alec Bradley',
  'Illusione',
  'Tatuaje',
  'Crowned Heads',
  'E.P. Carrillo',
  'Joya de Nicaragua',
  'Plasencia',
  'Trinidad',
  'Bolivar',
  'Fonseca',
  'Diesel',
  'Gurkha',
  'Foundation Cigar Co.',
  'Room101',
  'Southern Draw',
  'Warped',
  'Espinosa',
];
