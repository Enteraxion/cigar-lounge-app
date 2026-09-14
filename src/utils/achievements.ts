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
  /**
   * What this badge asks of a member, in their words — "Upload 10 photos",
   * not "photosUploaded >= 10".
   *
   * It lives here, beside the threshold it describes, for one reason: the
   * screen used to tell everyone to "keep exploring", whatever the badge
   * actually wanted. Host needs ten photographs; no amount of exploring
   * unlocks it, and a prompt that names the wrong action is worse than no
   * prompt (Rohith spotted this on his own 75% screen, 2026-09-13). Kept as
   * a separate string rather than generated from the number so a badge can
   * phrase itself naturally, and kept adjacent so the two cannot drift.
   */
  requirement: string;
};

export type AchievementCategory = {
  id: string;
  name: string;
  unlockedCount: number;
  totalCount: number;
  badges: Badge[];
};

function badge(
  id: string,
  label: string,
  icon: Badge['icon'],
  value: number,
  threshold: number,
  requirement: string,
): Badge {
  return { id, label, icon, unlocked: value >= threshold, requirement };
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
        badge('pathfinder', 'Pathfinder', 'compass', loungesVisited, 1, 'Visit your first lounge'),
        badge('wayfarer', 'Wayfarer', 'map', loungesVisited, 5, 'Visit 5 lounges'),
        badge('globetrotter', 'Globetrotter', 'globe', citiesExplored, 3, 'Visit lounges in 3 cities'),
        badge('trailblazer', 'Trailblazer', 'send', statesExplored, 3, 'Visit lounges in 3 states'),
      ],
    },
    {
      id: 'social-member',
      name: 'Social Member',
      badges: [
        badge('mixer', 'Mixer', 'users', reviewsWritten, 1, 'Write your first review'),
        badge('networker', 'Networker', 'messageCircle', reviewsWritten, 5, 'Write 5 reviews'),
        badge('host', 'Host', 'crown', photosUploaded, 10, 'Upload 10 photos'),
        badge('ambassador', 'Ambassador', 'award', reviewsWritten, 15, 'Write 15 reviews'),
      ],
    },
    {
      // Eight badges, so the ladder deliberately alternates between counts
      // and distance — a member with no home city set can still reach six
      // of them, since their mileage is unknown rather than zero.
      id: 'traveler',
      name: 'Traveler',
      badges: [
        badge('frequent-flyer', 'Frequent Flyer', 'plane', loungesVisited, 2, 'Visit 2 lounges'),
        badge('road-warrior', 'Road Warrior', 'car', citiesExplored, 2, 'Visit lounges in 2 cities'),
        badge('diplomat', 'Diplomat', 'award', loungesVisited, 5, 'Visit 5 lounges'),
        badge('globehopper', 'Globehopper', 'globe', citiesExplored, 4, 'Visit lounges in 4 cities'),
        badge('jetsetter', 'Jetsetter', 'send', milesTraveled, 250, 'Travel 250 miles to a lounge'),
        badge('nomad', 'Nomad', 'mountain', weekStreak, 3, 'Visit a lounge 3 weeks running'),
        badge('voyager', 'Voyager', 'ship', milesTraveled, 1000, 'Travel 1,000 miles to lounges'),
        badge('elite-explorer', 'Elite Explorer', 'compass', loungesVisited, 15, 'Visit 15 lounges'),
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
