/**
 * backfillPhones.ts — fills in `phone` on lounges that already exist.
 *
 * Why this is separate from the import, and why it is urgent:
 *
 * Dr. Brinkley asked for phone numbers in the 2026-08-17 demo. Neither import
 * captured one — Yelp's `display_phone` was never mapped and Google's field
 * mask never requested it — so a sample of 400 existing lounges had **zero**
 * phone fields. Both mappings are fixed now, but that only helps documents
 * imported from here on. The ~4,900 Yelp lounges already in Firestore need
 * this.
 *
 * The Yelp key expires 2026-08-19. `display_phone` comes free on Yelp's
 * *search* endpoint, so this re-runs the same city sweep the import uses and
 * updates only the phone field. Once the key lapses that data is no longer
 * reachable at any price we've agreed to, so this wants running before then.
 *
 * Deliberately narrow: it writes `phone` and nothing else. It will not create
 * documents, will not touch names, hours, ratings or ownership, and skips any
 * lounge that already has a phone — so it is safe to re-run and cannot undo
 * an owner's edits.
 *
 * SETUP: serviceAccountKey.json at the project root, as the other scripts use.
 * RUN:   YELP_API_KEY=xxxxx npm run backfill:phones
 *        YELP_API_KEY=xxxxx npm run backfill:phones -- --dry-run
 */

import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

import { CITIES } from './cities';

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('Missing serviceAccountKey.json at the project root.');
  process.exit(1);
}

const YELP_API_KEY = process.env.YELP_API_KEY;
if (!YELP_API_KEY) {
  console.error('\nMissing YELP_API_KEY env var.\n');
  console.error('  YELP_API_KEY=xxxxx npm run backfill:phones\n');
  process.exit(1);
}

const DRY_RUN = process.argv.includes('--dry-run');

initializeApp({
  credential: cert(JSON.parse(fs.readFileSync(KEY_PATH, 'utf8')) as ServiceAccount),
});
const db = getFirestore();

type YelpCategory = { alias: string; title: string };
type YelpBusiness = {
  id: string;
  display_phone?: string;
  phone?: string;
  /** e.g. [{alias:'cigarbars',title:'Cigar Bars'}]. Free on the search
   *  endpoint and the only real source of lounge *type* we have — neither
   *  import ever persisted it, so 40% of lounges cannot be classified by
   *  name alone. */
  categories?: YelpCategory[];
};

/**
 * One page of Yelp search results for a location. Only the fields this script
 * needs are typed; Yelp returns far more.
 */
async function searchYelp(location: string, offset: number): Promise<YelpBusiness[]> {
  const url =
    'https://api.yelp.com/v3/businesses/search' +
    `?location=${encodeURIComponent(location)}` +
    '&categories=cigarbars,tobaccoshops,hookah_bars&limit=50' +
    `&offset=${offset}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${YELP_API_KEY}` },
  });
  if (!response.ok) {
    // A 429 or an expired key should stop the sweep loudly, not silently
    // produce a run that "succeeded" having updated nothing.
    throw new Error(`Yelp ${response.status} for ${location}: ${await response.text()}`);
  }
  const body = (await response.json()) as { businesses?: YelpBusiness[] };
  return body.businesses ?? [];
}

/** Reads the doc id off a work item — keeps the update call legible. */
function docId(target: { docId: string }): string {
  return target.docId;
}

async function main(): Promise<void> {
  // Which lounges actually need a phone. Reading this first means the number of
  // Yelp calls is justified by real gaps rather than swept blindly.
  const snapshot = await db.collection('lounges').get();
  // Two things are captured in one sweep, because they come from the same free
  // search response and the key expires today: the phone number and the Yelp
  // categories. A lounge is included if it is missing EITHER.
  const wanted = new Map<string, { docId: string; needsPhone: boolean; needsCategories: boolean }>();
  let complete = 0;
  let notYelp = 0;

  snapshot.forEach(document => {
    const data = document.data() as { phone?: string; yelpCategories?: string[] };
    if (!document.id.startsWith('yelp-')) {
      notYelp += 1;
      return;
    }
    const needsPhone = !data.phone;
    const needsCategories = !data.yelpCategories?.length;
    if (!needsPhone && !needsCategories) {
      complete += 1;
      return;
    }
    wanted.set(document.id.slice('yelp-'.length), {
      docId: document.id,
      needsPhone,
      needsCategories,
    });
  });

  console.log(`lounges total            : ${snapshot.size}`);
  console.log(`Yelp lounges already done: ${complete}`);
  console.log(`Google-sourced (skipped) : ${notYelp}`);
  console.log(`Yelp lounges to fill     : ${wanted.size}`);
  if (wanted.size === 0) {
    console.log('\nNothing to do.');
    return;
  }

  // The same cities the import sweeps, from the shared module — importing the
  // import script itself would run it.
  console.log(`sweeping ${CITIES.length} cities for phone numbers…\n`);

  let matched = 0;
  let written = 0;
  let calls = 0;

  for (const city of CITIES) {
    for (let offset = 0; offset < 200; offset += 50) {
      let businesses: YelpBusiness[];
      try {
        businesses = await searchYelp(city, offset);
        calls += 1;
      } catch (error) {
        console.error(`  ${city} @${offset}: ${String(error)}`);
        break;
      }
      if (businesses.length === 0) {
        break;
      }
      for (const business of businesses) {
        const target = wanted.get(business.id);
        if (!target) {
          continue;
        }
        const phone = business.display_phone || business.phone;
        const categories = (business.categories ?? []).map(c => c.alias).filter(Boolean);

        const update: Record<string, unknown> = {};
        if (target.needsPhone && phone) {
          update.phone = phone;
        }
        if (target.needsCategories && categories.length) {
          // Stored as Yelp's aliases rather than titles: aliases are stable
          // identifiers ('cigarbars'), titles are display text Yelp can reword.
          update.yelpCategories = categories;
        }
        if (Object.keys(update).length === 0) {
          continue;
        }
        matched += 1;
        if (!DRY_RUN) {
          await db.collection('lounges').doc(docId(target)).update(update);
          written += 1;
        }
        wanted.delete(business.id);
      }
    }
    process.stdout.write(`  ${city}: matched ${matched} so far\n`);
  }

  console.log(`\nYelp search calls : ${calls}`);
  console.log(`phones matched    : ${matched}`);
  console.log(DRY_RUN ? 'DRY RUN — nothing written.' : `documents updated : ${written}`);
  console.log(`still incomplete  : ${wanted.size} (not returned by any city sweep)`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
