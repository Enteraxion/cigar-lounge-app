/**
 * ProfileScreen
 *
 * Matches design-reference/User Profile Screen.pdf: centered profile
 * photo + name/tier, an Edit Profile button, a 4-stat row, the Cigar
 * Passport entry card, an Achievements preview, a Collections rail, a
 * Travel History card, and a Recent Activity timeline.
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
 * into the Saved tab's FavoritesHome/CollectionsGrid.
 *
 * Every other section is now real too (2026-08-13, Julian Brinkley's
 * TestFlight feedback: "Is this page functional?" / "make that page
 * real") — none of these had a real data source before, so each one
 * reuses/derives from data that already exists elsewhere rather than
 * inventing new schema or writes:
 *  - Achievements: src/utils/achievements.ts computes real badge
 *    unlock state from getUserStats (see that file's header comment on
 *    the thresholds being a first real pass, not confirmed criteria).
 *  - Collections (was "Favorite Cigars", which had no real per-cigar
 *    favoriting concept anywhere in the schema): now shows the user's
 *    real collections (getUserCollections) — also fixes a real bug
 *    found alongside this: "View Collection" already linked to the real
 *    Collections screen, but the cards above it were fake, so tapping
 *    through led somewhere unrelated to what was shown.
 *  - Travel History: "Regions"/"Lounges" derive from the user's real
 *    favorited lounges (distinct `city` values / count); the map reuses
 *    the same real JourneyMap component built for PassportScreen; "Last
 *    Destination" is the most recently *viewed* lounge (getRecentlyViewedLounges)
 *    since there's no real visit-history/check-in feature to source an
 *    actual "last destination" from.
 *  - Recent Activity: the user's real most recent reviews
 *    (getUserReviews) — "Reviewed X" or "Added N photos to X" depending
 *    on whether that review included photos, with the real review text
 *    as the quote. The old mock's "Checked in at X" / XP numbers are
 *    gone entirely — there's no check-in feature to source them from.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  BookMarked,
  Camera,
  ChevronRight,
  Crown,
  MessageSquare,
  Pencil,
  Plane,
  Settings,
  IdCard,
  ShieldCheck,
  Store,
  User,
} from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { isAdminEmail } from '../config/admins';
import { auth } from '../services/firebaseAuth';
import { getLoungesForOwner } from '../services/ownerService';
import { getAgeVerification } from '../services/ageVerificationService';
import type { AgeVerificationStatus } from '../types/firestore';
import {
  getUserCollections,
  getUserReviews,
  getUserStats,
  getRecentlyViewedLounges,
  type UserCollection,
  type UserReviewEntry,
  type UserStats,
} from '../services/userActionsService';
import { getLoungesByIds, type Lounge } from '../services/loungeService';
import { formatRelativeTime } from '../utils/formatRelativeTime';
import { computeAchievementCategories } from '../utils/achievements';
import { getPassport } from '../services/passportService';
import type { PassportSummary } from '../utils/passport';
import { NOT_SET, useUserProfile } from '../hooks/useUserProfile';
import BadgeTile from '../components/BadgeTile';
import JourneyMap from '../components/JourneyMap';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type ProfileNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

/** A recent review, resolved with its lounge's real name for display. */
type RecentActivityEntry = UserReviewEntry & { loungeName: string };

function profileStatCards(stats: UserStats | null) {
  return [
    { label: 'Reviews', value: stats ? String(stats.reviewsWritten) : '—' },
    { label: 'Photos', value: stats ? String(stats.photosUploaded) : '—' },
    { label: 'Favorites', value: stats ? String(stats.favoritesSaved) : '—' },
    { label: 'Collections', value: stats ? String(stats.collectionsCount) : '—' },
  ];
}

function CollectionCard({ collection, onPress }: { collection: UserCollection; onPress: () => void }) {
  return (
    <Pressable style={styles.cigarCard} onPress={onPress}>
      {collection.coverImage ? (
        <Image source={{ uri: collection.coverImage }} style={styles.cigarImage} />
      ) : (
        <View style={[styles.cigarImage, styles.cigarImagePlaceholder]}>
          <BookMarked size={20} color={theme.colors.mutedGray} />
        </View>
      )}
      <Text style={styles.cigarName} numberOfLines={1}>
        {collection.name}
      </Text>
      <Text style={styles.cigarSubtitle} numberOfLines={1}>
        {collection.loungeIds.length} {collection.loungeIds.length === 1 ? 'lounge' : 'lounges'}
      </Text>
    </Pressable>
  );
}

function ActivityRow({ entry, isLast }: { entry: RecentActivityEntry; isLast: boolean }) {
  const hasPhotos = entry.photos.length > 0;

  return (
    <View style={styles.activityRow}>
      <View style={styles.activityRail}>
        <View style={styles.activityIconBox}>
          {hasPhotos ? (
            <Camera size={15} color={theme.colors.accentGold} />
          ) : (
            <MessageSquare size={15} color={theme.colors.accentGold} />
          )}
        </View>
        {!isLast ? <View style={styles.activityLine} /> : null}
      </View>

      <View style={styles.activityContent}>
        <View style={styles.activityHeaderRow}>
          <Text style={styles.activityText}>
            {hasPhotos ? `Added ${entry.photos.length} photo${entry.photos.length > 1 ? 's' : ''} to` : 'Reviewed'}{' '}
            <Text style={styles.activityHighlight}>{entry.loungeName}</Text>
          </Text>
        </View>
        <Text style={styles.activityMeta}>{formatRelativeTime(entry.createdAt.toDate())}</Text>

        {entry.text ? (
          <View style={styles.quoteCard}>
            <Text style={styles.quoteText} numberOfLines={3}>
              &quot;{entry.text}&quot;
            </Text>
          </View>
        ) : null}

        {hasPhotos ? (
          <View style={styles.activityPhotoRow}>
            {entry.photos.slice(0, 3).map((uri, index) => (
              <Image key={index} source={{ uri }} style={styles.activityPhotoThumb} />
            ))}
            {entry.photos.length > 3 ? (
              <View style={styles.activityPhotoOverflow}>
                <Text style={styles.activityPhotoOverflowText}>+{entry.photos.length - 3}</Text>
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
  const [collections, setCollections] = useState<UserCollection[]>([]);
  const [lastViewedLounge, setLastViewedLounge] = useState<Lounge | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivityEntry[]>([]);
  const [passport, setPassport] = useState<PassportSummary | null>(null);
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

  // Whether to show the My Shops card at all. Most members own nothing, and
  // an owner-facing entry point on every member's profile would be noise —
  // so this is driven by real ownership rather than shown-and-empty.
  const [ownsShops, setOwnsShops] = useState(false);
  // Only surfaced while there is something to do. A verified member has no
  // reason to be shown a card about verification.
  const [ageStatus, setAgeStatus] = useState<AgeVerificationStatus | null>(null);

  const loadProfileSections = useCallback(async () => {
    if (!userId) return;
    try {
      // Favorites are no longer fetched here: the Travel History card was
      // their only reader and now counts real visits instead, and the
      // headline "Favorites Saved" figure comes from getUserStats.
      const [userCollections, recentlyViewed, reviews, passportBundle, shops, ageVerification] =
        await Promise.all([
        getUserCollections(userId),
        getRecentlyViewedLounges(userId, 1),
        getUserReviews(userId),
        getPassport(userId),
        // Never fails the profile over it: a member who owns nothing is the
        // common case and looks identical to a failed lookup here.
        getLoungesForOwner(userId).catch(() => []),
        // Never fails the profile over it — an unreadable status just means the
        // card stays hidden, which is the same as being verified from the
        // screen's point of view.
        getAgeVerification(userId).catch(() => null),
      ]);
      setCollections(userCollections);
      setOwnsShops(shops.length > 0);
      setAgeStatus(ageVerification?.status ?? null);
      setLastViewedLounge(recentlyViewed[0] ?? null);
      setPassport(passportBundle.passport);

      const recent = reviews.slice(0, 5);
      const lounges = await getLoungesByIds([...new Set(recent.map(r => r.loungeId))]);
      const loungeNameById = new Map(lounges.map(l => [l.id, l.name]));
      setRecentActivity(
        recent.map(review => ({
          ...review,
          loungeName: loungeNameById.get(review.loungeId) ?? 'a lounge',
        })),
      );
    } catch {
      // Each section already has its own empty-state copy below — not
      // worth a full-screen error for these secondary sections.
    }
  }, [userId]);

  useEffect(() => {
    loadStats();
    loadProfileSections();
  }, [loadStats, loadProfileSections]);

  // Refetch on focus (not just mount) so a save on EditProfileScreen, a
  // new review, a new collection, etc. shows up immediately on the way
  // back, without an app restart.
  useFocusEffect(
    useCallback(() => {
      reloadProfile();
      loadProfileSections();
    }, [reloadProfile, loadProfileSections]),
  );

  // Travel History counts places actually visited, matching the JourneyMap
  // directly above it — these used to count favorites, so the card claimed
  // travel to lounges the member had only saved.
  const regionsExplored = passport?.statesExplored ?? 0;
  const loungesVisited = passport?.loungesVisited ?? 0;

  // First badge from each category as the 3-tile preview (Explorer,
  // Social Member, Traveler) — same category set every time, unlike the
  // old mock's mismatched preview (it even showed a "Humidor Hunter"
  // badge that didn't exist anywhere in the full Achievements screen).
  const achievementCategories = stats ? computeAchievementCategories(stats, passport) : [];
  const achievementPreviewBadges = achievementCategories.map(category => category.badges[0]);
  const achievementProgress = {
    unlocked: achievementCategories.reduce((sum, c) => sum + c.unlockedCount, 0),
    total: achievementCategories.reduce((sum, c) => sum + c.totalCount, 0),
  };

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
              <Crown size={16} color={theme.colors.primaryBlack} fill={theme.colors.primaryBlack} />
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
            <Pencil size={14} color={theme.colors.primaryBlack} />
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

        {/* ---------------- 21+ verification ---------------- */}
        {/* Shown only while unresolved: pending needs an ID, rejected needs a
            better one. A verified member sees nothing, and a member with no
            record at all predates the feature — also nothing, because nagging
            them is a product decision nobody has made. */}
        {ageStatus === 'pending' || ageStatus === 'rejected' ? (
          <Pressable style={styles.passportCard} onPress={() => navigation.navigate('AgeVerification')}>
            <View style={styles.passportIconBox}>
              <IdCard size={20} color={theme.colors.accentGold} />
            </View>
            <View style={styles.passportTextGroup}>
              <Text style={styles.passportTitle}>Age Verification</Text>
              <Text style={styles.passportSubtitle}>
                {ageStatus === 'rejected'
                  ? 'We couldn’t verify your ID — send another'
                  : 'Upload an ID to confirm you’re 21+'}
              </Text>
            </View>
            <ChevronRight size={18} color={theme.colors.secondarySilver} />
          </Pressable>
        ) : null}

        {/* ---------------- Admin: Review Age Verification ---------------- */}
        {isAdminEmail(auth.currentUser?.email) && (
          <Pressable style={styles.passportCard} onPress={() => navigation.navigate('AdminAgeReview')}>
            <View style={styles.passportIconBox}>
              <IdCard size={20} color={theme.colors.accentGold} />
            </View>
            <View style={styles.passportTextGroup}>
              <Text style={styles.passportTitle}>Review Age Verification</Text>
              <Text style={styles.passportSubtitle}>Check member IDs against declared age</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.secondarySilver} />
          </Pressable>
        )}

        {/* ---------------- Owner: My Shops ---------------- */}
        {/* Shown only to owners/claimants — see ownsShops above. This is the
            only route in the app to EditListingScreen, which owners were
            granted permission to use long before anything linked to it. */}
        {ownsShops && (
          <Pressable style={styles.passportCard} onPress={() => navigation.navigate('MyShops')}>
            <View style={styles.passportIconBox}>
              <Store size={20} color={theme.colors.accentGold} />
            </View>
            <View style={styles.passportTextGroup}>
              <Text style={styles.passportTitle}>My Shops</Text>
              <Text style={styles.passportSubtitle}>Edit your listing & open the Owner Portal</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.secondarySilver} />
          </Pressable>
        )}

        {/* ---------------- Admin: Review Claims ---------------- */}
        {isAdminEmail(auth.currentUser?.email) && (
          <Pressable style={styles.passportCard} onPress={() => navigation.navigate('AdminClaimReview')}>
            <View style={styles.passportIconBox}>
              <ShieldCheck size={20} color={theme.colors.accentGold} />
            </View>
            <View style={styles.passportTextGroup}>
              <Text style={styles.passportTitle}>Review Business Claims</Text>
              <Text style={styles.passportSubtitle}>Approve or reject pending listing claims</Text>
            </View>
            <ChevronRight size={18} color={theme.colors.secondarySilver} />
          </Pressable>
        )}

        {/* ---------------- Achievements ---------------- */}
        <View style={styles.field}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Achievements</Text>
            <Pressable onPress={() => navigation.navigate('Achievements')} hitSlop={8}>
              <Text style={styles.sectionLink}>
                {achievementProgress.unlocked} / {achievementProgress.total} Unlocked
              </Text>
            </Pressable>
          </View>
          <View style={styles.badgeRow}>
            {achievementPreviewBadges.map(badge => (
              <BadgeTile key={badge.id} badge={badge} />
            ))}
          </View>
        </View>

        {/* ---------------- Collections ---------------- */}
        <View style={styles.field}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Collections</Text>
            <Pressable onPress={openCollections} hitSlop={8}>
              <Text style={styles.sectionLink}>View All</Text>
            </Pressable>
          </View>
          {collections.length === 0 ? (
            <Pressable style={styles.emptyCard} onPress={openCollections}>
              <Text style={styles.emptyCardText}>
                Create a collection to see it here.
              </Text>
            </Pressable>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.cigarRow}
            >
              {collections.map(collection => (
                <CollectionCard
                  key={collection.id}
                  collection={collection}
                  onPress={() =>
                    (tabNavigation.navigate as (name: string, params?: object) => void)('Saved', {
                      screen: 'CollectionDetail',
                      params: { collectionId: collection.id },
                    })
                  }
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* ---------------- Travel History ---------------- */}
        <View style={styles.field}>
          <Text style={styles.sectionTitle}>Travel History</Text>
          <View style={styles.travelCard}>
            <JourneyMap />

            <View style={styles.travelStatRow}>
              <View style={styles.travelStat}>
                <Text style={styles.travelStatValue}>{regionsExplored}</Text>
                <Text style={styles.travelStatLabel}>Regions</Text>
              </View>
              <View style={styles.travelStat}>
                <Text style={styles.travelStatValue}>{loungesVisited}</Text>
                <Text style={styles.travelStatLabel}>Lounges</Text>
              </View>
            </View>

            {lastViewedLounge && (
              <Pressable
                style={styles.destinationRow}
                onPress={() =>
                  (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
                    screen: 'LoungeDetail',
                    params: { loungeId: lastViewedLounge.id },
                  })
                }
              >
                <View style={styles.destinationIconBox}>
                  <Plane size={16} color={theme.colors.accentGold} />
                </View>
                <View style={styles.destinationTextGroup}>
                  <Text style={styles.destinationTitle}>Last Viewed</Text>
                  <Text style={styles.destinationSubtitle}>
                    {lastViewedLounge.name}
                    {lastViewedLounge.city ? ` • ${lastViewedLounge.city}` : ''}
                  </Text>
                </View>
                <ChevronRight size={18} color={theme.colors.secondarySilver} />
              </Pressable>
            )}
          </View>
        </View>

        {/* ---------------- Recent Activity ---------------- */}
        <View style={[styles.field, styles.lastField]}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                Write your first review to see your activity here.
              </Text>
            </View>
          ) : (
            <View>
              {recentActivity.map((entry, index) => (
                <ActivityRow
                  key={entry.id}
                  entry={entry}
                  isLast={index === recentActivity.length - 1}
                />
              ))}
            </View>
          )}
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
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
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
    backgroundColor: theme.colors.surface,
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
    borderColor: withAlpha(theme.colors.accentGold, 0.3),
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surface,
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
    color: theme.colors.accentGold,
    marginBottom: theme.spacing.md,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },
  editButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryBlack,
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
    backgroundColor: theme.colors.surface,
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
    color: theme.colors.accentGold,
  },

  // ---- Cigar Passport ----
  passportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.soft,
  },
  passportIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
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
    backgroundColor: theme.colors.surface,
    marginBottom: 4,
  },
  cigarImagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyCard: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
  },
  emptyCardText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },

  // ---- Travel History ----
  travelCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md,
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
    color: theme.colors.accentGold,
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
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
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
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityLine: {
    flex: 1,
    width: 2,
    marginVertical: theme.spacing.xs,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.15),
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
  activityMeta: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  quoteCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.surface,
  },
  activityPhotoOverflow: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.12),
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
