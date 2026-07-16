/**
 * PassportScreen
 *
 * Matches design-reference/Passport Home & Journey Map.pdf: header,
 * profile card, a 2x2 info grid, "Passport Stats" (2x4 grid, now a 9th
 * "Collections" card), a Journey Map section with a stylized dot-marker
 * map + highlight rows + "Exploration Stats" (2x3 grid), and links into
 * the Travel Timeline and Achievements screens.
 *
 * Profile photo/name/tier + the Member Since/Home City/Fav Brand/Fav
 * Lounge info grid are the real signed-in user via
 * src/hooks/useUserProfile.ts — same hook ProfileScreen uses, so both
 * screens agree and "Edit Profile" (on ProfileScreen) updates both.
 *
 * "Passport Stats"' Reviews Written / Photos Uploaded / Favorites Saved
 * / Collections are real, computed client-side via
 * userActionsService.ts's getUserStats() for the signed-in user (see
 * that function's doc comment for the collectionGroup query it runs).
 * Lounges Visited / States Explored / Miles Traveled / Check-ins, and
 * the entire "Exploration Stats" section, show "Soon" instead of a
 * number — there's no check-in/travel-history feature yet, so these
 * would otherwise just be plausible-looking fake data. Achievements
 * stays mock (a separate, not-yet-real feature — see mockPassport.ts).
 * Journey Map / Journey Highlights are still local mock data too, same
 * reason.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {
  Bell,
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
import {
  journeyHighlights,
  journeyMapPoints,
  type JourneyHighlight,
  type StatCard,
} from '../data/mockPassport';
import { auth } from '../services/firebaseAuth';
import { getUserStats, type UserStats } from '../services/userActionsService';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import NotificationBadge from '../components/NotificationBadge';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';

type PassportNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

const COMING_SOON = 'Soon';

// Purely mock/unreleased — see the header comment above.
const ACHIEVEMENTS_COUNT = '8';

const EXPLORATION_STATS: StatCard[] = [
  { label: 'Total States', value: COMING_SOON },
  { label: 'Total Lounges', value: COMING_SOON },
  { label: 'Dist. Traveled', value: COMING_SOON },
  { label: 'Road Trips', value: COMING_SOON },
  { label: 'Business Trips', value: COMING_SOON },
  { label: 'Vacation Visits', value: COMING_SOON },
];

function passportStatCards(stats: UserStats | null): StatCard[] {
  return [
    { label: 'Lounges Visited', value: COMING_SOON },
    { label: 'States Explored', value: COMING_SOON },
    { label: 'Reviews Written', value: stats ? String(stats.reviewsWritten) : '—' },
    { label: 'Photos Uploaded', value: stats ? String(stats.photosUploaded) : '—' },
    { label: 'Favorites Saved', value: stats ? String(stats.favoritesSaved) : '—' },
    { label: 'Miles Traveled', value: COMING_SOON },
    { label: 'Check-ins', value: COMING_SOON },
    { label: 'Achievements', value: ACHIEVEMENTS_COUNT },
    { label: 'Collections', value: stats ? String(stats.collectionsCount) : '—' },
  ];
}

const HIGHLIGHT_ICON: Record<JourneyHighlight['icon'], React.ComponentType<{ size?: number; color?: string }>> = {
  flame: Flame,
  mapPin: MapPin,
  compass: Compass,
};

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

  const loadStats = useCallback(async () => {
    if (!userId) return;
    setStatsError(null);
    setStats(null);
    try {
      setStats(await getUserStats(userId));
    } catch {
      setStatsError("Couldn't load stats.");
    }
  }, [userId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerCaption}>Cigar Experience</Text>
            <Text style={styles.headerTitle}>Cigar Passport</Text>
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
            {chunkPairs(passportStatCards(stats)).map((pair, index) => (
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

          <View style={styles.mapArea}>
            <LinearGradient
              colors={[theme.colors.surfaceNavy, theme.colors.primaryNavy]}
              style={StyleSheet.absoluteFill}
            />
            {journeyMapPoints.map((point, index) => (
              <View
                key={index}
                style={[
                  styles.mapDot,
                  point.visited ? styles.mapDotVisited : styles.mapDotUnvisited,
                  { left: `${point.x}%`, top: `${point.y}%` },
                ]}
              />
            ))}
          </View>

          <View style={styles.highlightList}>
            {journeyHighlights.map(highlight => {
              const Icon = HIGHLIGHT_ICON[highlight.icon];
              return (
                <View key={highlight.id} style={styles.highlightRow}>
                  <View style={styles.highlightIconBox}>
                    <Icon size={16} color={theme.colors.accentGold} />
                  </View>
                  <View style={styles.highlightTextGroup}>
                    <Text style={styles.highlightTitle}>{highlight.title}</Text>
                    <Text style={styles.highlightSubtitle}>{highlight.subtitle}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* ---------------- Exploration Stats ---------------- */}
        <View style={[styles.field, styles.lastField]}>
          <Text style={styles.sectionLabel}>Exploration Stats</Text>
          <View style={styles.statGrid}>
            {chunkPairs(EXPLORATION_STATS).map((pair, index) => (
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
  mapArea: {
    position: 'relative',
    height: 180,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.12)',
  },
  mapDot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: theme.radius.full,
  },
  mapDotVisited: {
    backgroundColor: theme.colors.accentGold,
  },
  mapDotUnvisited: {
    backgroundColor: theme.colors.mutedGray,
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
