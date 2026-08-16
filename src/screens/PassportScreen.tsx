/**
 * PassportScreen
 *
 * Matches design-reference/Passport Home & Journey Map.pdf: header,
 * profile card, a 2x2 info grid, "Passport Stats" (2x4 grid, now a 9th
 * "Collections" card), a Journey Map section + highlight rows +
 * "Exploration Stats" (2x3 grid), and links into the Travel Timeline and
 * Achievements screens.
 *
 * Profile photo/name/tier + the Member Since/Home City/Fav Brand/Fav
 * Lounge info grid are the real signed-in user via
 * src/hooks/useUserProfile.ts — same hook ProfileScreen uses, so both
 * screens agree and "Edit Profile" (on ProfileScreen) updates both.
 *
 * Every figure on this screen is now real. Reviews Written / Photos
 * Uploaded / Favorites Saved / Collections come from userActionsService's
 * getUserStats() (see that function's doc comment for the collectionGroup
 * query it runs); Lounges Visited / States Explored / Cities Explored /
 * Miles Traveled, the whole "Exploration Stats" section and the Journey
 * Highlights rows are derived from the member's own visit history via
 * src/utils/passport.ts — see that file for why a review counts as a
 * visit. All of these previously read "Soon" or were hardcoded, because
 * nothing tracked where a member had actually been.
 *
 * The Journey Map is a real embedded MapView (src/components/JourneyMap.tsx)
 * pinning lounges actually visited — it replaced a stylized fake
 * dot-scatter graphic per a TestFlight bug report from Julian Brinkley
 * ("The Journey map should have an actual map").
 *
 * Distances depend on the member having a recognisable home city on their
 * profile; without one they read "—" rather than 0, since claiming zero
 * miles travelled would be a statement, and a false one.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  ChevronLeft,
  Clock3,
  Compass,
  Crown,
  Flame,
  MapPin,
  SlidersHorizontal,
  Trophy,
  User,
} from 'lucide-react-native';
import { theme } from '../theme';

import JourneyMap from '../components/JourneyMap';
import { auth } from '../services/firebaseAuth';
import { getUserStats, type UserStats } from '../services/userActionsService';
import { getPassport, type PassportBundle } from '../services/passportService';
import type { PassportSummary, StatCard } from '../utils/passport';
import { computeAchievementCategories, overallAchievementProgress } from '../utils/achievements';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import NotificationBadge from '../components/NotificationBadge';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';

type PassportNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

/** Placeholder while the underlying fetch is still in flight. */
const PENDING = '—';

function formatVisitDate(date: Date): string {
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Distances read as "unknown" rather than 0 when the member's profile has
 * no recognisable home city — showing 0 mi would state, falsely, that
 * they've travelled nowhere.
 */
function formatMiles(miles: number, hasHomeCity: boolean): string {
  if (!hasHomeCity) return '—';
  return miles >= 1000 ? `${(miles / 1000).toFixed(1)}k` : String(miles);
}

function passportStatCards(
  stats: UserStats | null,
  passport: PassportSummary | null,
  hasHomeCity: boolean,
  achievementsUnlocked: number | null,
): StatCard[] {
  return [
    { label: 'Lounges Visited', value: passport ? String(passport.loungesVisited) : PENDING },
    { label: 'States Explored', value: passport ? String(passport.statesExplored) : PENDING },
    { label: 'Reviews Written', value: stats ? String(stats.reviewsWritten) : PENDING },
    { label: 'Photos Uploaded', value: stats ? String(stats.photosUploaded) : PENDING },
    { label: 'Favorites Saved', value: stats ? String(stats.favoritesSaved) : PENDING },
    {
      label: 'Miles Traveled',
      value: passport ? formatMiles(passport.milesTraveled, hasHomeCity) : PENDING,
    },
    { label: 'Cities Explored', value: passport ? String(passport.citiesExplored) : PENDING },
    {
      label: 'Achievements',
      value: achievementsUnlocked !== null ? String(achievementsUnlocked) : PENDING,
    },
    { label: 'Collections', value: stats ? String(stats.collectionsCount) : PENDING },
  ];
}

/**
 * Deliberately different metrics from the Passport Stats grid above rather
 * than a second helping of the same numbers — this section is about the
 * shape of the journey (how far, how consistently, over what span), where
 * the grid above is about totals. The old tiles this replaces (Road Trips,
 * Business Trips, Vacation Visits) all needed a "visit type" concept that
 * doesn't exist anywhere in the app, so they could only ever have said
 * "Soon".
 */
function explorationStatCards(
  passport: PassportSummary | null,
  hasHomeCity: boolean,
): StatCard[] {
  if (!passport) {
    return [
      { label: 'Furthest Trip', value: PENDING },
      { label: 'Longest Streak', value: PENDING },
      { label: 'Avg. Rating', value: PENDING },
      { label: 'First Visit', value: PENDING },
      { label: 'Latest Visit', value: PENDING },
      { label: 'Total Visits', value: PENDING },
    ];
  }
  return [
    {
      label: 'Furthest Trip',
      value: hasHomeCity ? `${formatMiles(passport.furthestTripMiles, true)} mi` : '—',
    },
    {
      label: 'Longest Streak',
      value: passport.weekStreak > 0 ? `${passport.weekStreak} wk` : '0',
    },
    {
      label: 'Avg. Rating',
      value: passport.averageRating !== null ? passport.averageRating.toFixed(1) : '—',
    },
    {
      label: 'First Visit',
      value: passport.firstVisit ? formatVisitDate(passport.firstVisit.visitedAt) : '—',
    },
    {
      label: 'Latest Visit',
      value: passport.latestVisit ? formatVisitDate(passport.latestVisit.visitedAt) : '—',
    },
    { label: 'Total Visits', value: String(passport.visits.length) },
  ];
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoCard}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function StatCardTile({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function chunkPairs<T>(items: T[]): T[][] {
  const pairs: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    pairs.push(items.slice(i, i + 2));
  }
  return pairs;
}

export default function PassportScreen() {
  const navigation = useNavigation<PassportNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const userId = auth.currentUser?.uid;
  const { profile } = useUserProfile();
  const { count: unreadNotificationCount } = useUnreadNotificationCount();

  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [bundle, setBundle] = useState<PassportBundle | null>(null);

  const loadStats = useCallback(async () => {
    if (!userId) return;
    setStatsError(null);
    setStats(null);
    setBundle(null);
    try {
      const [statsResult, passportResult] = await Promise.all([
        getUserStats(userId),
        getPassport(userId),
      ]);
      setStats(statsResult);
      setBundle(passportResult);
    } catch {
      setStatsError("Couldn't load your passport.");
    }
  }, [userId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const passport: PassportSummary | null = bundle?.passport ?? null;
  const hasHomeCity = bundle?.hasHomeCity ?? false;
  const achievementsUnlocked = stats
    ? overallAchievementProgress(computeAchievementCategories(stats, passport)).unlocked
    : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          {/* Grouped with the title so the header's space-between still puts
              the bell on the right once a back button is in the row. */}
          <View style={styles.headerLeft}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
              <ChevronLeft size={24} color={theme.colors.white} />
            </Pressable>
            <View>
              <Text style={styles.headerCaption}>Cigar Experience</Text>
              <Text style={styles.headerTitle}>Cigar Passport</Text>
            </View>
          </View>
          <Pressable
            style={styles.bellButton}
            hitSlop={8}
            onPress={() => (tabNavigation.navigate as (name: string, params?: object) => void)('Notifications')}
          >
            <Bell size={18} color={theme.colors.secondarySilver} />
            <NotificationBadge count={unreadNotificationCount} />
          </Pressable>
        </View>

        {/* ---------------- Profile ---------------- */}
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            {profile?.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <User size={36} color={theme.colors.secondarySilver} />
              </View>
            )}
            <View style={styles.crownBadge}>
              <Crown size={14} color={theme.colors.primaryNavy} fill={theme.colors.primaryNavy} />
            </View>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? 'Member'}</Text>
          <Text style={styles.profileTier}>{profile?.memberTier ?? '—'}</Text>
        </View>

        {/* ---------------- Info Grid ---------------- */}
        <View style={styles.grid}>
          <InfoCard label="Member Since" value={profile?.memberSince ?? '—'} />
          <InfoCard label="Home City" value={profile?.homeCity ?? '—'} />
          <InfoCard label="Fav Brand" value={profile?.favoriteBrand ?? '—'} />
          <InfoCard label="Fav Lounge" value={profile?.favoriteLounge ?? '—'} />
        </View>

        {/* ---------------- Quick Links ---------------- */}
        <View style={styles.linkRow}>
          <Pressable
            style={styles.linkButton}
            onPress={() => navigation.navigate('TravelTimeline')}
          >
            <Clock3 size={15} color={theme.colors.white} />
            <Text style={styles.linkButtonText}>View Timeline</Text>
          </Pressable>
          <Pressable
            style={styles.linkButton}
            onPress={() => navigation.navigate('Achievements')}
          >
            <Trophy size={15} color={theme.colors.white} />
            <Text style={styles.linkButtonText}>Achievements</Text>
          </Pressable>
        </View>

        {/* ---------------- Passport Stats ---------------- */}
        <View style={styles.field}>
          <Text style={styles.sectionLabel}>Passport Stats</Text>
          {statsError ? (
            <View style={styles.statsErrorRow}>
              <Text style={styles.statsErrorText}>{statsError}</Text>
              <Pressable onPress={loadStats} hitSlop={8}>
                <Text style={styles.statsRetryText}>Try Again</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.statGrid}>
            {chunkPairs(passportStatCards(stats, passport, hasHomeCity, achievementsUnlocked)).map((pair, index) => (
              <View key={index} style={styles.statRow}>
                {pair.map(stat => (
                  <StatCardTile key={stat.label} label={stat.label} value={stat.value} />
                ))}
              </View>
            ))}
          </View>
        </View>

        {/* ---------------- Journey Map ---------------- */}
        <View style={styles.field}>
          <View style={styles.journeyHeaderRow}>
            <View>
              <Text style={styles.headerCaption}>Journey Map</Text>
              <Text style={styles.journeyTitle}>World Exploration</Text>
            </View>
            <Pressable
              style={styles.journeyFilterButton}
              hitSlop={8}
              onPress={() => Alert.alert('Coming Soon', 'Journey map filters are coming soon.')}
            >
              <SlidersHorizontal size={16} color={theme.colors.secondarySilver} />
            </Pressable>
          </View>

          <JourneyMap />

          {/* Derived from the member's real visit history — a row is simply
              omitted when there's nothing true to put in it, rather than
              padding the section out with a placeholder. */}
          <View style={styles.highlightList}>
            {passport && passport.weekStreak > 0 ? (
              <View style={styles.highlightRow}>
                <View style={styles.highlightIconBox}>
                  <Flame size={16} color={theme.colors.accentGold} />
                </View>
                <View style={styles.highlightTextGroup}>
                  <Text style={styles.highlightTitle}>
                    {passport.weekStreak} Week Streak
                  </Text>
                  <Text style={styles.highlightSubtitle}>Consistent lounge discovery</Text>
                </View>
              </View>
            ) : null}

            {passport?.latestVisit ? (
              <View style={styles.highlightRow}>
                <View style={styles.highlightIconBox}>
                  <MapPin size={16} color={theme.colors.accentGold} />
                </View>
                <View style={styles.highlightTextGroup}>
                  <Text style={styles.highlightTitle} numberOfLines={1}>
                    Newest: {passport.latestVisit.loungeName}
                  </Text>
                  <Text style={styles.highlightSubtitle}>
                    {passport.latestVisit.city ?? passport.latestVisit.address} •{' '}
                    {formatVisitDate(passport.latestVisit.visitedAt)}
                  </Text>
                </View>
              </View>
            ) : null}

            {bundle?.suggestion ? (
              <Pressable
                style={styles.highlightRow}
                onPress={() =>
                  (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
                    screen: 'LoungeDetail',
                    params: { loungeId: bundle.suggestion!.id },
                  })
                }
              >
                <View style={styles.highlightIconBox}>
                  <Compass size={16} color={theme.colors.accentGold} />
                </View>
                <View style={styles.highlightTextGroup}>
                  <Text style={styles.highlightTitle} numberOfLines={1}>
                    Next Suggestion
                  </Text>
                  <Text style={styles.highlightSubtitle} numberOfLines={1}>
                    {bundle.suggestion.name}
                    {bundle.suggestion.city ? ` • ${bundle.suggestion.city}` : ''}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {passport && passport.visits.length === 0 ? (
              <View style={styles.highlightRow}>
                <View style={styles.highlightIconBox}>
                  <Compass size={16} color={theme.colors.accentGold} />
                </View>
                <View style={styles.highlightTextGroup}>
                  <Text style={styles.highlightTitle}>Start your passport</Text>
                  <Text style={styles.highlightSubtitle}>
                    Review a lounge you've visited to begin your journey
                  </Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* ---------------- Exploration Stats ---------------- */}
        <View style={[styles.field, styles.lastField]}>
          <Text style={styles.sectionLabel}>Exploration Stats</Text>
          <View style={styles.statGrid}>
            {chunkPairs(explorationStatCards(passport, hasHomeCity)).map((pair, index) => (
              <View key={index} style={styles.statRow}>
                {pair.map(stat => (
                  <StatCardTile key={stat.label} label={stat.label} value={stat.value} />
                ))}
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
    gap: theme.spacing.xl,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerCaption: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  headerTitle: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 22,
    color: theme.colors.white,
    marginTop: 2,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Profile ----
  profileSection: {
    alignItems: 'center',
    gap: 2,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crownBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  profileName: {
    ...theme.typography.headingSmall,
    color: theme.colors.white,
  },
  profileTier: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.accentGold,
  },

  // ---- Info grid ----
  grid: {
    gap: theme.spacing.sm,
  },
  infoCard: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: 4,
  },
  infoLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  infoValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },

  // ---- Quick links ----
  linkRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  linkButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    height: 44,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  linkButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },

  // ---- Fields / sections ----
  field: {
    gap: theme.spacing.md,
  },
  lastField: {
    marginBottom: theme.spacing.lg,
  },
  sectionLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 14,
    letterSpacing: 0.5,
    color: theme.colors.white,
  },

  // ---- Stats loading / error ----
  statsErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  statsErrorText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    flex: 1,
  },
  statsRetryText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.accentGold,
  },

  // ---- Stat grid ----
  statGrid: {
    gap: theme.spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: 4,
  },
  statValue: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 24,
    color: theme.colors.white,
  },
  statLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },

  // ---- Journey map ----
  journeyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  journeyTitle: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 22,
    color: theme.colors.white,
    marginTop: 2,
  },
  journeyFilterButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Journey highlights ----
  highlightList: {
    gap: theme.spacing.sm,
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  highlightIconBox: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  highlightTextGroup: {
    flex: 1,
    gap: 2,
  },
  highlightTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  highlightSubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
});
