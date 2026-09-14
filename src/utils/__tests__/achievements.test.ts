/**
 * The achievements screen told every member to "keep exploring", whatever
 * the badge in front of them actually wanted — Host asks for ten uploaded
 * photographs, and no amount of exploring produces one. These tests pin the
 * property that fixes it: a badge's requirement is stored beside its
 * threshold, so the sentence a member reads and the number they are measured
 * against cannot describe different things.
 */

import {
  computeAchievementCategories,
  nextLockedBadge,
  overallAchievementProgress,
} from '../achievements';
import type { UserStats } from '../../services/userActionsService';
import type { PassportSummary } from '../passport';

const noStats: UserStats = {
  reviewsWritten: 0,
  photosUploaded: 0,
} as UserStats;

function passport(overrides: Partial<PassportSummary>): PassportSummary {
  return {
    visits: [],
    loungesVisited: 0,
    citiesExplored: 0,
    statesExplored: 0,
    milesTraveled: 0,
    furthestTripMiles: 0,
    weekStreak: 0,
    firstVisit: null,
    ...overrides,
  } as PassportSummary;
}

describe('badge requirements', () => {
  it('gives every badge a requirement a member can act on', () => {
    const badges = computeAchievementCategories(noStats, null).flatMap(c => c.badges);

    expect(badges).toHaveLength(16);
    for (const badge of badges) {
      expect(badge.requirement.length).toBeGreaterThan(0);
      // A requirement is an instruction, not a restatement of the label.
      expect(badge.requirement).not.toBe(badge.label);
    }
  });

  it("names the photo badge's real requirement, not exploration", () => {
    // The exact bug: Host was the next locked badge on a member with every
    // travel badge unlocked, and the screen sent them out to more lounges.
    const badges = computeAchievementCategories(noStats, null).flatMap(c => c.badges);
    const host = badges.find(b => b.id === 'host');

    expect(host?.requirement).toBe('Upload 10 photos');
    expect(host?.requirement.toLowerCase()).not.toContain('explor');
  });

  it('carries the requirement through to the prompt the member reads', () => {
    const categories = computeAchievementCategories(
      { reviewsWritten: 5, photosUploaded: 0 } as UserStats,
      passport({ loungesVisited: 15, citiesExplored: 4, statesExplored: 3, milesTraveled: 1200 }),
    );

    const next = nextLockedBadge(categories);

    expect(next?.id).toBe('host');
    expect(next?.requirement).toBe('Upload 10 photos');
  });
});

describe('unlocking', () => {
  it('locks every travel badge when there is no passport', () => {
    const categories = computeAchievementCategories(noStats, null);
    const travel = categories.filter(c => c.id !== 'social-member');

    expect(travel.every(c => c.unlockedCount === 0)).toBe(true);
  });

  it('leaves the mileage badges locked when the home city is unknown', () => {
    // milesTraveled is 0 for a member with no recognised home city — the
    // distance is unknown, not zero, so the other six Traveler badges must
    // still be reachable on counts alone.
    const categories = computeAchievementCategories(
      { reviewsWritten: 0, photosUploaded: 0 } as UserStats,
      passport({ loungesVisited: 5, citiesExplored: 4, milesTraveled: 0 }),
    );
    const traveler = categories.find(c => c.id === 'traveler');
    const locked = traveler?.badges.filter(b => !b.unlocked).map(b => b.id);

    expect(locked).toEqual(['jetsetter', 'nomad', 'voyager', 'elite-explorer']);
  });

  it('reports progress as a share of all sixteen badges', () => {
    const categories = computeAchievementCategories(
      { reviewsWritten: 5, photosUploaded: 0 } as UserStats,
      passport({
        loungesVisited: 5,
        citiesExplored: 4,
        statesExplored: 3,
        milesTraveled: 1200,
      }),
    );

    // Rohith's own screen: Explorer 4/4, Social 2/4, Traveler 6/8 — the two
    // he cannot reach being the week streak and fifteen lounges.
    expect(overallAchievementProgress(categories)).toEqual({
      unlocked: 12,
      total: 16,
      percent: 75,
    });
  });
});
