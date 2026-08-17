/**
 * CollectionsGridScreen
 *
 * Matches design-reference/Collections Grid Screen.pdf: header, a
 * Favorites/Collections segmented switcher (see FavoritesScreen for the
 * matching entry point), "Collections" title + folder count, and a
 * 2-column grid of collection cards (cover image, Private/Public badge,
 * name, item count) with a dashed "+ New Folder" card as the last item.
 * Real Firestore data for the signed-in user via
 * src/services/userActionsService.ts's getUserCollections() — refetches
 * every time the screen regains focus (via useFocusEffect) so a
 * collection just created on CreateCollectionScreen shows up immediately
 * on the way back, without needing a full reload.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Dimensions, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, Globe, Lock, Plus, User } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth } from '../services/firebaseAuth';
import { getUserCollections, type UserCollection } from '../services/userActionsService';
import { useUserProfile } from '../hooks/useUserProfile';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import NotificationBadge from '../components/NotificationBadge';
import type { SavedStackParamList } from '../navigation/SavedNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type CollectionsGridNavigationProp = NativeStackNavigationProp<SavedStackParamList>;

const TILE_SIZE = (Dimensions.get('window').width - theme.spacing.lg * 2 - theme.spacing.md) / 2;

function CollectionCard({
  collection,
  onPress,
}: {
  collection: UserCollection;
  onPress: () => void;
}) {
  const PrivacyIcon = collection.isPrivate ? Lock : Globe;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Image source={{ uri: collection.coverImage }} style={styles.cardImage} />
      <View style={styles.privacyBadge}>
        <PrivacyIcon size={11} color={theme.colors.white} />
        <Text style={styles.privacyBadgeText}>{collection.isPrivate ? 'Private' : 'Public'}</Text>
      </View>
      <Text style={styles.cardName} numberOfLines={1}>
        {collection.name}
      </Text>
      <Text style={styles.cardCount}>{collection.loungeIds.length} Lounges</Text>
    </Pressable>
  );
}

export default function CollectionsGridScreen() {
  const navigation = useNavigation<CollectionsGridNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const userId = auth.currentUser?.uid;
  const { profile } = useUserProfile();
  const { count: unreadNotificationCount } = useUnreadNotificationCount();

  const [collections, setCollections] = useState<UserCollection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setCollections([]);
      return;
    }
    setError(null);
    setCollections(null);
    try {
      setCollections(await getUserCollections(userId));
    } catch {
      setError("Couldn't load your collections. Check your connection and try again.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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
          <Pressable style={styles.segment} onPress={() => navigation.navigate('FavoritesHome')}>
            <Text style={styles.segmentText}>Favorites</Text>
          </Pressable>
          <Pressable style={[styles.segment, styles.segmentActive]}>
            <Text style={[styles.segmentText, styles.segmentTextActive]}>Collections</Text>
          </Pressable>
          <Pressable style={styles.segment} onPress={() => navigation.navigate('TravelWishlist')}>
            <Text style={styles.segmentText}>Wishlist</Text>
          </Pressable>
        </View>

        <View style={styles.titleRow}>
          <Text style={styles.title}>Collections</Text>
          <Text style={styles.folderCount}>{collections?.length ?? 0} Folders</Text>
        </View>

        {error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={load}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : collections === null ? (
          <View style={styles.stateBox}>
            <ActivityIndicator color={theme.colors.secondarySilver} />
          </View>
        ) : (
          <View style={styles.grid}>
            {collections.map(collection => (
              <CollectionCard
                key={collection.id}
                collection={collection}
                onPress={() =>
                  navigation.navigate('CollectionDetail', { collectionId: collection.id })
                }
              />
            ))}

            <Pressable
              style={styles.newFolderCard}
              onPress={() => navigation.navigate('CreateCollection')}
            >
              <View style={styles.newFolderIcon}>
                <Plus size={20} color={theme.colors.secondarySilver} />
              </View>
              <Text style={styles.newFolderLabel}>New Folder</Text>
            </Pressable>
          </View>
        )}
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
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.lg,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderColor: withAlpha(theme.colors.accentGold, 0.3),
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCaption: {
    ...theme.typography.caption,
    color: theme.colors.accentGold,
  },
  welcomeName: {
    ...theme.typography.headingSmall,
    color: theme.colors.white,
    marginTop: 2,
  },
  bellButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Segmented switcher ----
  segmentRow: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
  },
  segment: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.small,
  },
  segmentActive: {
    backgroundColor: theme.colors.accentGold,
  },
  segmentText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  segmentTextActive: {
    color: theme.colors.primaryBlack,
  },

  // ---- Title row ----
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.white,
  },
  folderCount: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },

  // ---- Loading / error state ----
  stateBox: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
  },
  errorText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },

  // ---- Grid ----
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
  },
  card: {
    width: TILE_SIZE,
    gap: 2,
  },
  cardImage: {
    width: '100%',
    height: TILE_SIZE,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.xs,
  },
  privacyBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.background, 0.6),
  },
  privacyBadgeText: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.white,
  },
  cardName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  cardCount: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  newFolderCard: {
    width: TILE_SIZE,
    height: TILE_SIZE + 40,
    borderRadius: theme.radius.large,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: withAlpha(theme.colors.accentGold, 0.35),
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  newFolderIcon: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  newFolderLabel: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
});
