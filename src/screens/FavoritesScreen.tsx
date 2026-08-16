/**
 * FavoritesScreen
 *
 * Matches design-reference/Favorites Home Screen.pdf (populated state)
 * and design-reference/Empty States Screen.pdf (empty state): a header,
 * a 2x2 stat grid, and a vertical list of favorited lounge cards, or —
 * when there are no favorites yet — a centered illustration and
 * discovery prompt.
 *
 * Real Firestore data for the signed-in user via
 * src/services/userActionsService.ts's getUserFavorites()/
 * getUserCollections() — NOT the demo-alexander-rossi seed user, so a
 * freshly signed-up member correctly sees the empty state (they have no
 * favorites of their own yet, even though the seed data has some for the
 * demo user). "Visited" / "States Visited" stay at 0 — there's no
 * check-in/travel-history tracking in the schema yet (see
 * UserDocument.stats in src/types/firestore.ts, which starts all-zero
 * for every new user too).
 *
 * The lounge cards here use a bespoke FavoriteLoungeCard (not the shared
 * LoungeCard component): LoungeCard is a bare horizontal-scroll tile with
 * the distance as a badge overlaid on the image, while this design wants
 * a full-width card with its own background/shadow — different enough to
 * warrant its own layout rather than bending LoungeCard's props. (The
 * "distance" text this design shows next to the name is dropped — there's
 * no real geolocation/distance data yet, see MapScreen/HomeScreen.)
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Plus, User } from 'lucide-react-native';
import { theme } from '../theme';
import StarRating from '../components/StarRating';
import NotificationBadge from '../components/NotificationBadge';
import { auth } from '../services/firebaseAuth';
import { getUserCollections, getUserFavorites } from '../services/userActionsService';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import type { Lounge } from '../services/loungeService';
import type { MainTabParamList } from '../navigation/MainNavigator';
import type { SavedStackParamList } from '../navigation/SavedNavigator';
import { displayTags } from '../utils/displayTags';

type FavoritesNavigationProp = NativeStackNavigationProp<SavedStackParamList>;

function FavoriteLoungeCard({ lounge, onPress }: { lounge: Lounge; onPress: () => void }) {
  return (
    <Pressable style={styles.loungeCard} onPress={onPress}>
      <Image source={{ uri: lounge.images[0] }} style={styles.loungeImage} />
      <View style={styles.loungeBody}>
        <Text style={styles.loungeName}>{lounge.name}</Text>
        <Text style={styles.loungeTags}>{displayTags(lounge.tags).join(' • ')}</Text>
        <StarRating rating={lounge.ratings.overall} size={13} />
      </View>
    </Pressable>
  );
}

export default function FavoritesScreen() {
  const navigation = useNavigation<FavoritesNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const userId = auth.currentUser?.uid;
  const { profile } = useUserProfile();
  const { count: unreadNotificationCount } = useUnreadNotificationCount();

  const [favorites, setFavorites] = useState<Lounge[] | null>(null);
  const [collectionsCount, setCollectionsCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setFavorites([]);
      return;
    }
    setError(null);
    setFavorites(null);
    try {
      const [favoriteLounges, collections] = await Promise.all([
        getUserFavorites(userId),
        getUserCollections(userId),
      ]);
      setFavorites(favoriteLounges);
      setCollectionsCount(collections.length);
    } catch {
      setError("Couldn't load your favorites. Check your connection and try again.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openLounge = (loungeId: string) => {
    // Cross-tab navigation into the Search stack's LoungeDetail screen —
    // see the same pattern/comment in MapScreen.
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'LoungeDetail',
      params: { loungeId },
    });
  };

  if (error) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (favorites === null) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      </SafeAreaView>
    );
  }

  if (favorites.length === 0) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {profile?.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <User size={20} color={theme.colors.secondarySilver} />
              </View>
            )}
            <View>
              <Text style={styles.welcomeCaption}>Activity History</Text>
              <Text style={styles.emptyHeaderTitle}>Favorites</Text>
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

        <View style={styles.segmentRowWrapper}>
          <View style={styles.segmentRow}>
            <Pressable style={[styles.segment, styles.segmentActive]}>
              <Text style={[styles.segmentText, styles.segmentTextActive]}>Favorites</Text>
            </Pressable>
            <Pressable
              style={styles.segment}
              onPress={() => navigation.navigate('CollectionsGrid')}
            >
              <Text style={styles.segmentText}>Collections</Text>
            </Pressable>
            <Pressable
              style={styles.segment}
              onPress={() => navigation.navigate('TravelWishlist')}
            >
              <Text style={styles.segmentText}>Wishlist</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.emptyContent}>
          <View style={styles.emptyImageWrap}>
            {profile?.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.emptyImage} />
            ) : (
              <View style={[styles.emptyImage, styles.avatarPlaceholder]}>
                <User size={64} color={theme.colors.secondarySilver} />
              </View>
            )}
          </View>
          <Text style={styles.emptyImageLabel}>Private Collection</Text>

          <Text style={styles.emptyTitle}>No Favorites Yet</Text>
          <Text style={styles.emptyDescription}>
            Your curated list of lounges and premium selections will appear here once you
            start exploring.
          </Text>

          <Pressable
            style={styles.primaryButton}
            onPress={() => tabNavigation.navigate('Search')}
          >
            <Text style={styles.primaryButtonText}>Discover Lounges</Text>
          </Pressable>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('CollectionsGrid')}
          >
            <Text style={styles.secondaryButtonText}>Browse Collections</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {profile?.avatarUri ? (
              <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <User size={20} color={theme.colors.secondarySilver} />
              </View>
            )}
            <View>
              <Text style={styles.welcomeCaption}>Welcome back</Text>
              <Text style={styles.welcomeName}>{profile?.name ?? 'Member'}</Text>
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

        <View style={styles.segmentRow}>
          <Pressable style={[styles.segment, styles.segmentActive]}>
            <Text style={[styles.segmentText, styles.segmentTextActive]}>Favorites</Text>
          </Pressable>
          <Pressable
            style={styles.segment}
            onPress={() => navigation.navigate('CollectionsGrid')}
          >
            <Text style={styles.segmentText}>Collections</Text>
          </Pressable>
          <Pressable
            style={styles.segment}
            onPress={() => navigation.navigate('TravelWishlist')}
          >
            <Text style={styles.segmentText}>Wishlist</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Favorites</Text>

        <View style={styles.statGrid}>
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Favorite Lounges</Text>
              <Text style={styles.statValue}>{favorites.length}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Visited</Text>
              <Text style={styles.statValue}>0</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>Collections</Text>
              <Text style={styles.statValue}>{collectionsCount}</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statLabel}>States Visited</Text>
              <Text style={styles.statValue}>0</Text>
            </View>
          </View>
        </View>

        <View style={styles.loungeList}>
          {favorites.map(lounge => (
            <FavoriteLoungeCard key={lounge.id} lounge={lounge} onPress={() => openLounge(lounge.id)} />
          ))}
        </View>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => navigation.navigate('CreateCollection')}>
        <Plus size={22} color={theme.colors.primaryNavy} />
      </Pressable>
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
    gap: theme.spacing.lg,
  },

  // ---- Loading / error state ----
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },

  // ---- Header (shared between states) ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCaption: {
    ...theme.typography.caption,
    color: theme.colors.mutedGray,
  },
  welcomeName: {
    ...theme.typography.headingSmall,
    color: theme.colors.white,
    marginTop: 2,
  },
  emptyHeaderTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 16,
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

  // ---- Segmented switcher ----
  segmentRowWrapper: {
    paddingHorizontal: theme.spacing.lg,
    marginTop: theme.spacing.lg,
  },
  segmentRow: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
  },
  segment: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.small,
  },
  segmentActive: {
    backgroundColor: theme.colors.white,
  },
  segmentText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  segmentTextActive: {
    color: theme.colors.primaryNavy,
  },

  // ---- Populated state ----
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.white,
  },
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
  statLabel: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },
  statValue: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 28,
    color: theme.colors.white,
  },

  // ---- Lounge cards ----
  loungeList: {
    gap: theme.spacing.lg,
  },
  loungeCard: {
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    overflow: 'hidden',
    ...theme.shadows.soft,
  },
  loungeImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: theme.colors.background,
  },
  loungeBody: {
    padding: theme.spacing.md,
    gap: 4,
  },
  loungeName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 17,
    color: theme.colors.white,
  },
  loungeTags: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },

  // ---- FAB ----
  fab: {
    position: 'absolute',
    right: theme.spacing.lg,
    bottom: 96,
    width: 56,
    height: 56,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.deep,
  },

  // ---- Empty state ----
  emptyContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  emptyImageWrap: {
    width: 220,
    height: 220,
    borderRadius: theme.radius.full,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceNavy,
  },
  emptyImage: {
    width: '100%',
    height: '100%',
    opacity: 0.35,
  },
  emptyImageLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  emptyTitle: {
    ...theme.typography.headingLarge,
    color: theme.colors.white,
  },
  emptyDescription: {
    ...theme.typography.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: theme.colors.mutedGray,
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  primaryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  secondaryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.secondarySilver,
  },
});
