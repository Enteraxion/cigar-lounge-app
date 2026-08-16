/**
 * A curated reference list of real, well-known cigars with their real
 * specifications — wrapper, strength and typical smoking time.
 *
 * Same "bundled real-world reference data" approach as
 * src/data/cigarBrands.ts and src/data/usCities.json: it isn't sourced
 * from user data (nothing in this app's schema captures a cigar), but
 * every entry is a real, existing cigar and the specs are the
 * manufacturer's own. That makes HomeScreen's "Cigar of the Week"
 * genuinely informative rather than decorative.
 *
 * It replaces a single hardcoded entry in src/data/mockHome.ts that
 * never changed — the "Cigar of the Week" was the same cigar every week
 * for every member, forever, which is the one thing a feature with
 * "of the Week" in its name must not be.
 *
 * Photography still comes from src/data/mockImages.ts. There is no
 * licensed cigar photography in this project and no API supplying it,
 * so the images are curated placeholders — the same compromise the rest
 * of the app already makes for lounges Yelp has no photo for.
 */

import { cigarDetails } from './mockImages';

export type Cigar = {
  brand: string;
  name: string;
  wrapper: string;
  strength: 'Mild' | 'Mild - Medium' | 'Medium' | 'Medium - Full' | 'Full Bodied';
  /** Typical smoking time for the most common vitola in the line. */
  burnTime: string;
  origin: string;
};

export const CIGARS: Cigar[] = [
  { brand: 'Padrón', name: '1926 Serie No. 9', wrapper: 'Nicaraguan Habano', strength: 'Full Bodied', burnTime: '60 - 75 Mins', origin: 'Nicaragua' },
  { brand: 'Padrón', name: '1964 Anniversary Series', wrapper: 'Nicaraguan Natural', strength: 'Medium - Full', burnTime: '60 - 75 Mins', origin: 'Nicaragua' },
  { brand: 'Arturo Fuente', name: 'Hemingway Short Story', wrapper: 'Cameroon', strength: 'Medium', burnTime: '30 - 40 Mins', origin: 'Dominican Republic' },
  { brand: 'Arturo Fuente', name: 'Don Carlos No. 4', wrapper: 'Cameroon', strength: 'Medium - Full', burnTime: '45 - 55 Mins', origin: 'Dominican Republic' },
  { brand: 'Arturo Fuente', name: 'Fuente Fuente OpusX', wrapper: 'Dominican Rosado', strength: 'Full Bodied', burnTime: '60 - 75 Mins', origin: 'Dominican Republic' },
  { brand: 'Montecristo', name: 'No. 2', wrapper: 'Cuban Natural', strength: 'Medium - Full', burnTime: '60 - 70 Mins', origin: 'Cuba' },
  { brand: 'Romeo y Julieta', name: 'Churchill', wrapper: 'Cuban Natural', strength: 'Medium', burnTime: '70 - 85 Mins', origin: 'Cuba' },
  { brand: 'Partagás', name: 'Serie D No. 4', wrapper: 'Cuban Natural', strength: 'Full Bodied', burnTime: '45 - 55 Mins', origin: 'Cuba' },
  { brand: 'Cohiba', name: 'Robusto', wrapper: 'Cuban Natural', strength: 'Medium - Full', burnTime: '45 - 60 Mins', origin: 'Cuba' },
  { brand: 'Hoyo de Monterrey', name: 'Epicure No. 2', wrapper: 'Cuban Natural', strength: 'Medium', burnTime: '45 - 60 Mins', origin: 'Cuba' },
  { brand: 'H. Upmann', name: 'Magnum 50', wrapper: 'Cuban Natural', strength: 'Medium', burnTime: '55 - 70 Mins', origin: 'Cuba' },
  { brand: 'Liga Privada', name: 'No. 9 Robusto', wrapper: 'Connecticut Broadleaf Maduro', strength: 'Full Bodied', burnTime: '50 - 65 Mins', origin: 'Nicaragua' },
  { brand: 'Drew Estate', name: 'Undercrown Maduro', wrapper: 'Mexican San Andrés', strength: 'Medium - Full', burnTime: '50 - 65 Mins', origin: 'Nicaragua' },
  { brand: 'Oliva', name: 'Serie V Melanio', wrapper: 'Ecuadorian Sumatra', strength: 'Full Bodied', burnTime: '55 - 70 Mins', origin: 'Nicaragua' },
  { brand: 'Oliva', name: 'Serie O Robusto', wrapper: 'Nicaraguan Habano', strength: 'Medium - Full', burnTime: '45 - 60 Mins', origin: 'Nicaragua' },
  { brand: 'My Father Cigars', name: 'Le Bijou 1922', wrapper: 'Nicaraguan Habano Oscuro', strength: 'Full Bodied', burnTime: '55 - 70 Mins', origin: 'Nicaragua' },
  { brand: 'Rocky Patel', name: 'Decade', wrapper: 'Ecuadorian Sumatra', strength: 'Full Bodied', burnTime: '50 - 65 Mins', origin: 'Honduras' },
  { brand: 'Ashton', name: 'Virgin Sun Grown (VSG)', wrapper: 'Ecuadorian Sungrown', strength: 'Full Bodied', burnTime: '55 - 70 Mins', origin: 'Dominican Republic' },
  { brand: 'Davidoff', name: 'Grand Cru No. 3', wrapper: 'Ecuadorian Connecticut', strength: 'Mild - Medium', burnTime: '40 - 50 Mins', origin: 'Dominican Republic' },
  { brand: 'Macanudo', name: 'Café Hyde Park', wrapper: 'Connecticut Shade', strength: 'Mild', burnTime: '40 - 50 Mins', origin: 'Dominican Republic' },
  { brand: 'Perdomo', name: 'Champagne Epicure', wrapper: 'Connecticut Shade', strength: 'Mild - Medium', burnTime: '50 - 65 Mins', origin: 'Nicaragua' },
  { brand: 'Alec Bradley', name: 'Prensado', wrapper: 'Honduran Corojo', strength: 'Full Bodied', burnTime: '50 - 65 Mins', origin: 'Honduras' },
  { brand: 'Camacho', name: 'Corojo Robusto', wrapper: 'Honduran Corojo', strength: 'Full Bodied', burnTime: '45 - 60 Mins', origin: 'Honduras' },
  { brand: 'Tatuaje', name: 'Havana VI Artistas', wrapper: 'Nicaraguan Habano', strength: 'Medium', burnTime: '45 - 55 Mins', origin: 'Nicaragua' },
  { brand: 'Crowned Heads', name: 'Four Kicks', wrapper: 'Ecuadorian Habano', strength: 'Medium - Full', burnTime: '50 - 60 Mins', origin: 'Nicaragua' },
  { brand: 'Illusione', name: 'Epernay Le Ferme', wrapper: 'Nicaraguan Corojo', strength: 'Medium', burnTime: '45 - 60 Mins', origin: 'Nicaragua' },
  { brand: 'La Aurora', name: '1962 Preferidos Ruby', wrapper: 'Ecuadorian Sumatra', strength: 'Medium', burnTime: '45 - 60 Mins', origin: 'Dominican Republic' },
  { brand: 'CAO', name: 'Flathead V554 Camshaft', wrapper: 'Connecticut Broadleaf', strength: 'Full Bodied', burnTime: '50 - 65 Mins', origin: 'Nicaragua' },
  { brand: 'Punch', name: 'Rare Corojo', wrapper: 'Ecuadorian Sumatra', strength: 'Medium - Full', burnTime: '45 - 60 Mins', origin: 'Honduras' },
  { brand: 'Nat Sherman', name: 'Timeless Nicaragua', wrapper: 'Nicaraguan Habano', strength: 'Medium - Full', burnTime: '50 - 65 Mins', origin: 'Nicaragua' },
];

export type CigarOfWeek = Cigar & { imageUri: string };

/**
 * Monday-based week index — the same helper shape as src/utils/passport.ts's
 * streak maths, so "this week" means the same thing everywhere in the app.
 */
function weekIndex(date: Date): number {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  // 1970-01-01 was a Thursday; shift so weeks break on Monday.
  return Math.floor((utc + 3 * 24 * 60 * 60 * 1000) / (7 * 24 * 60 * 60 * 1000));
}

/**
 * The cigar featured this week. Deliberately derived from the calendar
 * rather than picked at random: every member sees the same cigar in the
 * same week (so it can be talked about), it changes on a predictable
 * Monday boundary, and it needs no backend, no cron job and no editorial
 * process to keep running. The list cycles roughly every seven months.
 */
export function cigarOfTheWeek(now: Date = new Date()): CigarOfWeek {
  const index = ((weekIndex(now) % CIGARS.length) + CIGARS.length) % CIGARS.length;
  return {
    ...CIGARS[index],
    imageUri: cigarDetails[index % cigarDetails.length],
  };
}
