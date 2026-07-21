/**
 * ProfileScreen
 *
 * Matches design-reference/User Profile Screen.pdf: centered profile
 * photo + name/tier, an Edit Profile button, a 4-stat row, the Cigar
 * Passport entry card, an Achievements preview, a Favorite Cigars rail,
 * a Travel History card, and a Recent Activity timeline.
 *
 * Profile photo/name/tier/member-since are the real signed-in user via
 * src/hooks/useUserProfile.ts (Firebase Auth + the Firestore
 * users/{userId} doc) — see that hook for how missing Firestore fields
 * fall back to "Not set" rather than fake data. "Edit Profile" opens
 * EditProfileScreen, which writes back to both.
 *
 * The 4-stat row was originally Reviews/Photos/Followers/Following —
 * Followers/Following implied a social-follow graph that was never
 * actually built (no such collection in the schema), so rather than
 * keep shipping two more fake numbers next to now-real ones, it's
 * Reviews/Photos/Favorites/Collections instead — all four real, via
 * userActionsService.ts's getUserStats() for the signed-in user (see
 * that function's doc comment for the collectionGroup query behind
 * Reviews/Photos), and all four tiles are tappable (STAT_ACTIONS below):
 * Reviews/Photos open MyReviewsScreen, Favorites/Collections cross-navigate
 * into the Saved tab's FavoritesHome/CollectionsGrid. Everything else on
 * this screen (Achievements,
 * Favorite Cigars, Travel History, Recent Activity) is still local mock
 * data — those are separate, larger features with no real data source
 * yet (no check-in/travel-history/cigar-rating-aggregation tracking).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import LinearGradient from 'react-native-linear-gradient';
import {
  BookMarked,
  Camera,
  ChevronRight,
  Crown,
  LogIn,
  Pencil,
  Plane,
  Settings,
  User,
} from 'lucide-react-native';
import { theme } from '../theme';
import {
  favoriteCigars,
  profileAchievementsPreview,
  profileAchievementsTotal,
  profileAchievementsUnlocked,
  recentActivity,
  travelHistory,
  type ActivityEntry,
  type FavoriteCigar,
} from '../data/mockProfile';
import { auth } from '../services/firebaseAuth';
import { getUserStats, type UserStats } from '../services/userActionsService';
import { NOT_SET, useUserProfile } from '../hooks/useUserProfile';
import BadgeTile from '../components/BadgeTile';
import StarRating from '../components/StarRating';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';

type ProfileNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

function profileStatCards(stats: UserStats | null) {
  return [
    { label: 'Reviews', value: stats ? String(stats.reviewsWritten) : '—' },
    { label: 'Photos', value: stats ? String(stats.photosUploaded) : '—' },
    { label: 'Favorites', value: stats ? String(stats.favoritesSaved) : '—' },
    { label: 'Collections', value: stats ? String(stats.collectionsCount) : '—' },
  ];
}

const ACTIVITY_ICON: Record<ActivityEntry['icon'], React.ComponentType<{ size?: number; color?: string }>> = {
  logIn: LogIn,
  camera: Camera,
};

function CigarCard({ cigar }: { cigar: FavoriteCigar }) {
  return (
    <View style={styles.cigarCard}>
      <Image source={{ uri: cigar.image }} style={styles.cigarImage} />
      <Text style={styles.cigarName} numberOfLines={1}>
        {cigar.name}
      </Text>
      <Text style={styles.cigarSubtitle} numberOfLines={1}>
        {cigar.subtitle}
      </Text>
      <StarRating rating={cigar.rating} size={12} />
    </View>
  );
}

function ActivityRow({ entry, isLast }: { entry: ActivityEntry; isLast: boolean }) {
  const Icon = ACTIVITY_ICON[entry.icon];

  return (
    <View style={styles.activityRow}>
      <View style={styles.activityRail}>
        <View style={styles.activityIconBox}>
          <Icon size={15} color={theme.colors.accentGold} />
        </View>
        {!isLast ? <View style={styles.activityLine} /> : null}
      </View>

      <View style={styles.activityContent}>
        <View style={styles.activityHeaderRow}>
          <Text style={styles.activityText}>
            {entry.description} <Text style={styles.activityHighlight}>{entry.highlight}</Text>
          </Text>
          {entry.xp ? (
            <View style={styles.xpBadge}>
              <Text style={styles.xpBadgeText}>+{entry.xp} XP</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.activityMeta}>{entry.meta}</Text>

        {entry.quote ? (
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText}>{entry.quote}</Text>
          </View>
        ) : null}

        {entry.photos && entry.photos.length > 0 ? (
          <View style={styles.activityPhotoRow}>
            {entry.photos.map((uri, index) => (
              <Image key={index} source={{ uri }} style={styles.activityPhotoThumb} />
            ))}
            {entry.overflowCount ? (
              <View style={styles.activityPhotoOverflow}>
                <Text style={styles.activityPhotoOverflowText}>+{entry.overflowCount}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<ProfileNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const userId = auth.currentUser?.uid;

  const [stats, setStats] = useState<UserStats | null>(null);
  const { profile, reload: reloadProfile } = useUserProfile();

  const loadStats = useCallback(async () => {
    if (!userId) return;
    try {
      setStats(await getUserStats(userId));
    } catch {
      // Stat cards fall back to '—' below — not worth a full-screen
      // error for a secondary summary row.
    }
  }, [userId]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // Refetch on focus (not just mount) so a save on EditProfileScreen
  // shows up immediately on the way back, without an app restart.
  useFocusEffect(
    useCallback(() => {
      reloadProfile();
    }, [reloadProfile]),
  );

  const openCollections = () => {
    // Cross-tab navigation into the Saved stack's CollectionsGrid screen.
    // MainTabParamList types "Saved" as `undefined` (it doesn't model the
    // nested stack), so a plain typed call can't express this; React
    // Navigation supports it fine at runtime.
    (tabNavigation.navigate as (name: string, params?: object) => void)('Saved', {
      screen: 'CollectionsGrid',
    });
  };

  const openFavorites = () => {
    (tabNavigation.navigate as (name: string, params?: object) => void)('Saved', {
      screen: 'FavoritesHome',
    });
  };

  // Reviews and Photos both route to MyReviewsScreen — photos aren't a
  // separate collection, they're attached to reviews, so there's no
  // distinct "my photos" destination to send that tile to instead.
  const STAT_ACTIONS: Record<string, () => void> = {
    Reviews: () => navigation.navigate('MyReviews'),
    Photos: () => navigation.navigate('MyReviews'),
    Favorites: openFavorites,
    Collections: openCollections,
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Profile ---------------- */}
        <View style={styles.profileSection}>
          <Pressable
            style={styles.settingsButton}
            onPress={() => navigation.navigate('AISettings')}
            hitSlop={8}
          >
            <Settings size={18} color={theme.colors.secondarySilver} />
          </Pressable>

          <View style={styles.avatarWrap}>
            {profile?.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <User size={44} color={theme.colors.secondarySilver} />
              </View>
            )}
            <View style={styles.crownBadge}>
              <Crown size={16} color={theme.colors.primaryNavy} fill={theme.colors.primaryNavy} />
            </View>
          </View>
          <Text style={styles.profileName}>{profile?.name ?? 'Member'}</Text>
          <Text style={styles.profileTier}>{profile?.memberTier ?? NOT_SET}</Text>

          <Pressable
            style={styles.editButton}
            hitSlop={4}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <Text style={styles.editButtonText}>Edit Profile</Text>
            <Pencil size={14} color={theme.colors.primaryNavy} />
          </Pressable>
        </View>

        {/* ---------------- Stats ---------------- */}
        <View style={styles.statRow}>
          {profileStatCards(stats).map(stat => (
            <Pressable
              key={stat.label}
              style={styles.statCard}
              onPress={STAT_ACTIONS[stat.label]}
            >
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ---------------- Cigar Passport ---------------- */}
        <Pressable style={styles.passportCard} onPress={() => navigation.navigate('Passport')}>
          <View style={styles.passportIconBox}>
            <BookMarked size={20} color={theme.colors.accentGold} />
          </View>
          <View style={styles.passportTextGroup}>
            <Text style={styles.passportTitle}>Cigar Passport</Text>
            <Text style={styles.passportSubtitle}>Stats, journey map & achievements</Text>
          </View>
          <ChevronRight size={18} color={theme.colors.secondarySilver} />
        </Pressable>

        {/* ---------------- Achievements ---------------- */}
        <View style={styles.field}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <Pressable onPress={() => navigation.navigate('Achievements')} hitSlop={8}>
              <Text style={styles.sectionLink}>
                {profileAchievementsUnlocked} / {profileAchievementsTotal} Unlocked
              </Text>
            </Pressable>
          </View>
          <View style={styles.badgeRow}>
            {profileAchievementsPreview.map(badge => (
              <BadgeTile key={badge.id} badge={badge} />
            ))}
          </View>
        </View>

        {/* ---------------- Favorite Cigars ---------------- */}
        <View style={styles.field}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Favorite Cigars</Text>
            <Pressable onPress={openCollections} hitSlop={8}>
              <Text style={styles.sectionLink}>View Collection</Text>
            </Pressable>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cigarRow}
          >
            {favoriteCigars.map(cigar => (
              <CigarCard key={cigar.id} cigar={cigar} />
            ))}
          </ScrollView>
        </View>

        {/* ---------------- Travel History ---------------- */}
        <View style={styles.field}>
          <Text style={styles.sectionTitle}>Travel History</Text>
          <View style={styles.travelCard}>
            <View style={styles.travelMap}>
              <LinearGradient
                colors={[theme.colors.surfaceNavy, theme.colors.primaryNavy]}
                style={StyleSheet.absoluteFill}
              />
              {travelHistory.mapPoints.map((point, index) => (
                <View
                  key={index}
                  style={[styles.travelMapDot, { left: `${point.x}%`, top: `${point.y}%` }]}
                />
              ))}
            </View>

            <View style={styles.travelStatRow}>
              <View style={styles.travelStat}>
                <Text style={styles.travelStatValue}>{travelHistory.regions}</Text>
                <Text style={styles.travelStatLabel}>Regions</Text>
              </View>
              <View style={styles.travelStat}>
                <Text style={styles.travelStatValue}>{travelHistory.lounges}</Text>
                <Text style={styles.travelStatLabel}>Lounges</Text>
              </View>
            </View>

            <Pressable
              style={styles.destinationRow}
              onPress={() => navigation.navigate('TravelTimeline')}
            >
              <View style={styles.destinationIconBox}>
                <Plane size={16} color={theme.colors.accentGold} />
              </View>
              <View style={styles.destinationTextGroup}>
                <Text style={styles.destinationTitle}>Last Destination</Text>
                <Text style={styles.destinationSubtitle}>
                  {travelHistory.lastDestination.city} • {travelHistory.lastDestination.date}
                </Text>
              </View>
              <ChevronRight size={18} color={theme.colors.secondarySilver} />
            </Pressable>
          </View>
        </View>

        {/* ---------------- Recent Activity ---------------- */}
        <View style={[styles.field, styles.lastField]}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          <View>
            {recentActivity.map((entry, index) => (
              <ActivityRow
                key={entry.id}
                entry={entry}
                isLast={index === recentActivity.length - 1}
              />
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
    paddingTop: theme.spacing.lg,
    paddingBottom: 120,
    gap: theme.spacing.xl,
  },

  // ---- Profile ----
  profileSection: {
    alignItems: 'center',
    gap: 2,
  },
  settingsButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  avatarWrap: {
    position: 'relative',
    marginBottom: theme.spacing.sm,
  },
  avatar: {
    width: 120,
    height: 120,
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
    right: 4,
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.background,
  },
  profileName: {
    ...theme.typography.headingMedium,
    fontSize: 26,
    color: theme.colors.white,
    marginTop: theme.spacing.sm,
  },
  profileTier: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
    marginBottom: theme.spacing.md,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
  },
  editButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryNavy,
  },

  // ---- Stats ----
  statRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: 4,
  },
  statValue: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 20,
    color: theme.colors.white,
  },
  statLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },

  // ---- Cigar Passport ----
  passportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    ...theme.shadows.soft,
  },
  passportIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  passportTextGroup: {
    flex: 1,
    gap: 2,
  },
  passportTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  passportSubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Sections ----
  field: {
    gap: theme.spacing.md,
  },
  lastField: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...theme.typography.headingSmall,
    fontSize: 18,
    color: theme.colors.white,
  },
  sectionLink: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.accentGold,
  },

  // ---- Achievements ----
  badgeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },

  // ---- Favorite Cigars ----
  cigarRow: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
  cigarCard: {
    width: 132,
    gap: 4,
  },
  cigarImage: {
    width: 132,
    height: 110,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    marginBottom: 4,
  },
  cigarName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  cigarSubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
    marginBottom: 2,
  },

  // ---- Travel History ----
  travelCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: theme.spacing.md,
  },
  travelMap: {
    position: 'relative',
    height: 110,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.12)',
  },
  travelMapDot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },
  travelStatRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  travelStat: {
    gap: 2,
  },
  travelStatValue: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 20,
    color: theme.colors.white,
  },
  travelStatLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  destinationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  destinationIconBox: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  destinationTextGroup: {
    flex: 1,
    gap: 2,
  },
  destinationTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },
  destinationSubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Recent Activity ----
  activityRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  activityRail: {
    alignItems: 'center',
    width: 32,
  },
  activityIconBox: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLine: {
    flex: 1,
    width: 2,
    marginVertical: theme.spacing.xs,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
  },
  activityContent: {
    flex: 1,
    gap: theme.spacing.xs,
    paddingBottom: theme.spacing.lg,
  },
  activityHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  activityText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.white,
    flex: 1,
  },
  activityHighlight: {
    color: theme.colors.accentGold,
    textDecorationLine: 'underline',
  },
  xpBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
  },
  xpBadgeText: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.accentGold,
  },
  activityMeta: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  quoteCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.accentGold,
  },
  quoteText: {
    ...theme.typography.medium,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    color: theme.colors.secondarySilver,
  },
  activityPhotoRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  activityPhotoThumb: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
  },
  activityPhotoOverflow: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(192, 192, 192, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityPhotoOverflowText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
});
