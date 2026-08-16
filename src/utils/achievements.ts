/**
 * Real achievement computation — replaces src/data/mockPassport.ts's
 * hardcoded achievementCategories/achievementsPercent (Julian Brinkley's
 * TestFlight feedback, 2026-08-13: "Is this functional?" on Achievements,
 * then "make that page real" for ProfileScreen as a whole).
 *
 * Thresholds below are a first real pass, not a confirmed product
 * decision — nothing anywhere previously defined what each badge should
 * actually require. Revisit if the product team wants different criteria;
 * the shape (Badge/AchievementCategory) is unchanged from the old mock
 * data, so AchievementsScreen/BadgeTile/ProfileScreen don't need to change
 * how they render it, only where it comes from.
 *
 * 2026-08-16: re-based on real travel. These badges are all named for
 * going places — Explorer, Globetrotter, Road Warrior, Nomad, Voyager —
 * but the first pass had to compute them from favorites saved and a
 * generic engagement score, because nothing tracked where a member had
 * actually been. The Cigar Passport now does (src/utils/passport.ts), so
 * Explorer and Traveler key off lounges visited, cities, states, miles and
 * the week streak, and "Globetrotter" finally means what it says. Social
 * Member stays on the contribution signals — reviews and photos — since
 * that category is about what you give other members, not where you went.
 *
 * `passport` is nullable: a caller that hasn't loaded one (or a member
 * with no visits) simply leaves the travel badges locked rather than
 * unlocking them off an unrelated proxy. Note that mileage badges need a
 * recognised home city on the member's profile — without one every
 * distance is unknown, so the two mileage badges stay locked while the
 * other six Traveler badges remain reachable on counts alone.
 */

import type { UserStats } from '../services/userActionsService';
import type { PassportSummary } from './passport';

export type Badge = {
  id: string;
  label: string;
  icon:
    | 'compass'
    | 'map'
    | 'globe'
    | 'users'
    | 'messageCircle'
    | 'crown'
    | 'plane'
    | 'car'
    | 'ship'
    | 'mountain'
    | 'send'
    | 'award'
    | 'box';
  unlocked: boolean;
};

export type AchievementCategory = {
  id: string;
  name: string;
  unlockedCount: number;
  totalCount: number;
  badges: Badge[];
};

function badge(id: string, label: string, icon: Badge['icon'], value: number, threshold: number): Badge {
  return { id, label, icon, unlocked: value >= threshold };
}

export function computeAchievementCategories(
  stats: UserStats,
  passport: PassportSummary | null = null,
): AchievementCategory[] {
  const { reviewsWritten, photosUploaded } = stats;
  const loungesVisited = passport?.loungesVisited ?? 0;
  const citiesExplored = passport?.citiesExplored ?? 0;
  const statesExplored = passport?.statesExplored ?? 0;
  const milesTraveled = passport?.milesTraveled ?? 0;
  const weekStreak = passport?.weekStreak ?? 0;

  const categories: Omit<AchievementCategory, 'unlockedCount' | 'totalCount'>[] = [
    {
      id: 'explorer',
      name: 'Explorer',
      badges: [
        badge('pathfinder', 'Pathfinder', 'compass', loungesVisited, 1),
        badge('wayfarer', 'Wayfarer', 'map', loungesVisited, 5),
        badge('globetrotter', 'Globetrotter', 'globe', citiesExplored, 3),
        badge('trailblazer', 'Trailblazer', 'send', statesExplored, 3),
      ],
    },
    {
      id: 'social-member',
      name: 'Social Member',
      badges: [
        badge('mixer', 'Mixer', 'users', reviewsWritten, 1),
        badge('networker', 'Networker', 'messageCircle', reviewsWritten, 5),
        badge('host', 'Host', 'crown', photosUploaded, 10),
        badge('ambassador', 'Ambassador', 'award', reviewsWritten, 15),
      ],
    },
    {
      // Eight badges, so the ladder deliberately alternates between counts
      // and distance — a member with no home city set can still reach six
      // of them, since their mileage is unknown rather than zero.
      id: 'traveler',
      name: 'Traveler',
      badges: [
        badge('frequent-flyer', 'Frequent Flyer', 'plane', loungesVisited, 2),
        badge('road-warrior', 'Road Warrior', 'car', citiesExplored, 2),
        badge('diplomat', 'Diplomat', 'award', loungesVisited, 5),
        badge('globehopper', 'Globehopper', 'globe', citiesExplored, 4),
        badge('jetsetter', 'Jetsetter', 'send', milesTraveled, 250),
        badge('nomad', 'Nomad', 'mountain', weekStreak, 3),
        badge('voyager', 'Voyager', 'ship', milesTraveled, 1000),
        badge('elite-explorer', 'Elite Explorer', 'compass', loungesVisited, 15),
      ],
    },
  ];

  return categories.map(category => ({
    ...category,
    unlockedCount: category.badges.filter(b => b.unlocked).length,
    totalCount: category.badges.length,
  }));
}

export function overallAchievementProgress(categories: AchievementCategory[]): {
  unlocked: number;
  total: number;
  percent: number;
} {
  const unlocked = categories.reduce((sum, category) => sum + category.unlockedCount, 0);
  const total = categories.reduce((sum, category) => sum + category.totalCount, 0);
  return { unlocked, total, percent: total === 0 ? 0 : Math.round((unlocked / total) * 100) };
}

/** First still-locked badge across all categories, in display order — used for a "what's next" prompt. */
export function nextLockedBadge(categories: AchievementCategory[]): Badge | null {
  for (const category of categories) {
    const locked = category.badges.find(b => !b.unlocked);
    if (locked) return locked;
  }
  return null;
}
