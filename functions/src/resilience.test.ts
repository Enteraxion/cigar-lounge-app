/**
 * Source-failure resilience for the city refresh.
 *
 * These pin the behaviour that mattered when the Yelp key was days from
 * expiring: one source going away must degrade the refresh, not kill it.
 *
 * The real refreshCityLounges is a Cloud Function and can't be imported here
 * without booting firebase-functions, so these test the exact settle-and-
 * fall-back shape it uses. That is a deliberate trade: it verifies the
 * pattern rather than the wiring, and the wiring is covered by the endpoint
 * integration suite.
 */

type Business = { id: string };

/** Mirrors the refresh's fetch step: both sources independent, both catchable. */
async function fetchBothSources(
  yelp: () => Promise<Business[]>,
  google: () => Promise<Business[]>,
): Promise<{ businesses: Business[]; googlePlaces: Business[]; usable: boolean }> {
  const [businesses, googlePlaces] = await Promise.all([
    yelp().catch(() => [] as Business[]),
    google().catch(() => [] as Business[]),
  ]);
  return { businesses, googlePlaces, usable: businesses.length > 0 || googlePlaces.length > 0 };
}

const ok = (ids: string[]) => () => Promise.resolve(ids.map(id => ({ id })));
const fails = (message: string) => () => Promise.reject(new Error(message));

describe('city refresh source handling', () => {
  it('uses both sources when both answer', async () => {
    const result = await fetchBothSources(ok(['y1']), ok(['g1']));
    expect(result.usable).toBe(true);
    expect(result.businesses).toHaveLength(1);
    expect(result.googlePlaces).toHaveLength(1);
  });

  it('still refreshes from Google when Yelp fails — the expiring-key case', async () => {
    // Before the fix this rejected the whole Promise.all, so no city could be
    // refreshed at all even though Google was answering fine.
    const result = await fetchBothSources(fails('401 Unauthorized'), ok(['g1', 'g2']));
    expect(result.usable).toBe(true);
    expect(result.businesses).toEqual([]);
    expect(result.googlePlaces).toHaveLength(2);
  });

  it('still refreshes from Yelp when Google fails', async () => {
    const result = await fetchBothSources(ok(['y1']), fails('429 quota exceeded'));
    expect(result.usable).toBe(true);
    expect(result.businesses).toHaveLength(1);
  });

  it('reports unusable when both fail, rather than throwing', async () => {
    // The caller must be able to skip stamping its 30-day cache marker, or a
    // transient outage locks the city out of retrying for a month.
    const result = await fetchBothSources(fails('down'), fails('down'));
    expect(result.usable).toBe(false);
  });

  it('reports unusable when both answer with nothing', async () => {
    // An empty answer is not an error, but it is equally not worth caching.
    const result = await fetchBothSources(ok([]), ok([]));
    expect(result.usable).toBe(false);
  });

  it('never rejects, whatever the sources do', async () => {
    await expect(fetchBothSources(fails('a'), fails('b'))).resolves.toBeDefined();
  });
});
