/**
 * The city list the Yelp sweep runs over.
 *
 * Extracted from importYelpLounges.ts so more than one script can use it.
 * Importing that script to reach the list would *run the import* — it checks
 * env vars and initialises Firebase at module scope — which is not something a
 * backfill should trigger as a side effect of reading a constant.
 *
 * This is a fixed list, which caps coverage at cities someone thought to add
 * ahead of time. Real "any city" coverage needs the live per-search refresh
 * (functions/src/index.ts's refreshCityLounges).
 */

export const CITIES = [
  'New York, NY',
  'Los Angeles, CA',
  'Chicago, IL',
  'Houston, TX',
  'Phoenix, AZ',
  'Philadelphia, PA',
  'San Antonio, TX',
  'San Diego, CA',
  'Dallas, TX',
  'Austin, TX',
  'Jacksonville, FL',
  'Fort Worth, TX',
  'San Jose, CA',
  'Columbus, OH',
  'Charlotte, NC',
  'Indianapolis, IN',
  'San Francisco, CA',
  'Seattle, WA',
  'Denver, CO',
  'Oklahoma City, OK',
  'Nashville, TN',
  'Washington, DC',
  'El Paso, TX',
  'Las Vegas, NV',
  'Boston, MA',
  'Detroit, MI',
  'Portland, OR',
  'Memphis, TN',
  'Louisville, KY',
  'Baltimore, MD',
  'Milwaukee, WI',
  'Albuquerque, NM',
  'Tucson, AZ',
  'Fresno, CA',
  'Sacramento, CA',
  'Kansas City, MO',
  'Atlanta, GA',
  'Miami, FL',
  'Raleigh, NC',
  'Omaha, NE',
  'Colorado Springs, CO',
  'Long Beach, CA',
  'Virginia Beach, VA',
  'Oakland, CA',
  'Minneapolis, MN',
  'Tulsa, OK',
  'Tampa, FL',
  'New Orleans, LA',
  'Wichita, KS',
  'Cleveland, OH',
  'Bakersfield, CA',
  'Honolulu, HI',
  'Greenville, SC',
  'Charleston, SC',
  'Richmond, VA',
  'Salt Lake City, UT',
  'Cincinnati, OH',
  'Pittsburgh, PA',
  'St. Louis, MO',
  'Orlando, FL',
  'London, UK',
];
