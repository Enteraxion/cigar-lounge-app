/**
 * buildCityStats.ts — materializes the per-city lounge rankings that
 * SearchScreen ranks its sections by, into a single Firestore document.
 *
 * Why this exists: "which cities do we cover, ranked by how many lounges
 * each has, with a real photo from each" is an aggregation over the whole
 * `lounges` collection. Firestore has no GROUP BY, so the client did the
 * only thing it could — download all 8,294 documents (~6.8 MB, over 7
 * seconds on a wired connection) and count them in JS. SearchScreen's focus
 * effect asked for it through four separate loaders, so opening the Search
 * tab was several full-collection downloads.
 *
 * Counting once here and writing the answer to `aggregates/cityStats` turns
 * that into a single-document read. The client keeps its original
 * derivation as a fallback (see loungeService.getCityHighlights), so a
 * missing or unreadable aggregate degrades to "slow but correct" rather
 * than "no cities".
 *
 * STALENESS: this is a snapshot, not a live view. Re-run it after any import
 * that adds lounges (`npm run import:lounges`) or the counts will drift
 * behind reality. `generatedAt` in the document records when it was built.
 *
 * SETUP: same serviceAccountKey.json as seedFirestore.ts.
 * RUN: npm run build:city-stats
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import type { LoungeDocument } from '../src/types/firestore';

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(KEY_PATH)) {
  console.error(
    'Missing serviceAccountKey.json at the project root.\n' +
      'Download it from Firebase Console → Project settings → Service accounts.',
  );
  process.exit(1);
}

initializeApp({
  credential: cert(JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')) as ServiceAccount),
});

const db = getFirestore();

/**
 * Mirrors src/utils/loungeImage.ts's preference order for a display photo.
 * Only the "lounge has its own photo" branch matters here — a city whose
 * lounges have no photos is one the image-led rails should skip, so a
 * synthesized fallback would defeat the point of recording the photo at all.
 */
function firstRealImage(lounge: LoungeDocument): string | undefined {
  const image = lounge.images?.find(uri => typeof uri === 'string' && uri.length > 0);
  return image ?? undefined;
}

async function main(): Promise<void> {
  console.log('Reading lounges…');
  const snapshot = await db.collection('lounges').get();
  console.log(`  ${snapshot.size} lounge documents`);

  const byCity = new Map<string, { count: number; imageUri?: string }>();
  let withoutCity = 0;

  snapshot.forEach(document => {
    const lounge = document.data() as LoungeDocument;
    if (!lounge.city) {
      withoutCity += 1;
      return;
    }
    const existing = byCity.get(lounge.city);
    byCity.set(lounge.city, {
      count: (existing?.count ?? 0) + 1,
      imageUri: existing?.imageUri ?? firstRealImage(lounge),
    });
  });

  const cities = Array.from(byCity.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .map(([city, data]) => ({
      id: city.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: city,
      count: data.count,
      // Firestore rejects undefined values, and an absent photo is
      // meaningful here (it's what excludes a city from the image-led
      // rails), so it is stored as null rather than omitted.
      imageUri: data.imageUri ?? null,
    }));

  console.log(`  ${cities.length} distinct cities`);
  console.log(`  ${withoutCity} lounges have no city field and were skipped`);
  console.log('  top 5:', cities.slice(0, 5).map(c => `${c.name} (${c.count})`).join(', '));

  await db.doc('aggregates/cityStats').set({
    cities,
    loungeCount: snapshot.size,
    generatedAt: new Date().toISOString(),
  });

  console.log('\nWrote aggregates/cityStats.');
  console.log('Re-run this after any import that adds lounges.');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
