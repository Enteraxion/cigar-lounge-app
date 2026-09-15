/**
 * CollectionDetailScreen
 *
 * Matches design-reference/Collection Detail Screen.pdf: a swipeable
 * hero gallery with overlaid header icons (back/heart/share) and
 * pagination dots, Private/Public + lounge-count badges, name, "last
 * updated" row, description, a stylized map preview, and a vertical list
 * of saved lounge rows. Reached by tapping a card on CollectionsGrid.
 *
 * Real Firestore data via userActionsService.ts's getUserCollection()
 * for the collection doc itself, then loungeService.ts's
 * getLoungesByIds() to batch-fetch the actual saved lounges from
 * `collection.loungeIds`. The schema has no `galleryImages` field (that
 * was mock-only) — the gallery instead shows each saved lounge's first
 * photo, falling back to just the cover image for an empty collection.
 * The header heart toggles the collection doc's own `isFavorited` field
 * (favoriting the collection itself, distinct from the lounges inside
 * it) via userActionsService.ts's toggleCollectionFavorite() — optimistic
 * update + rollback-on-error, mirroring FavoriteButton's pattern.
 *
 * The "Saved Lounges" rows use a bespoke SavedLoungeRow rather than the
 * shared LoungeCard/CompactLoungeCard: this design wants a full-width
 * card with a rating badge overlaid on the image and a circular chevron
 * button in the info row, which neither shared card supports.
 */

import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { NavigationProp, RouteProp } from '@react-navigation/native';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Globe,
  Heart,
  Lock,
  MapPin,
  MoreVertical,
  Share2,
  Star,
  Trash2,
} from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth } from '../services/firebaseAuth';
import {
  deleteCollection,
  getUserCollection,
  removeLoungeFromCollection,
  toggleCollectionFavorite,
  updateCollection,
  type UserCollection,
} from '../services/userActionsService';
import { getLoungesByIds, type Lounge } from '../services/loungeService';
import type { SavedStackParamList } from '../navigation/SavedNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { loungeImageUri } from '../utils/loungeImage';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type CollectionDetailNavigationProp = NativeStackNavigationProp<SavedStackParamList>;
type CollectionDetailRouteProp = RouteProp<SavedStackParamList, 'CollectionDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_HEIGHT = 320;

function SavedLoungeRow({
  lounge,
  onPress,
  onRemove,
}: {
  lounge: Lounge;
  onPress: () => void;
  /** Takes the lounge out of this collection — not out of the member's favorites. */
  onRemove: () => void;
}) {
  return (
    <View style={styles.loungeCard}>
      <View style={styles.loungeImageWrapper}>
        <Image source={{ uri: loungeImageUri(lounge) }} style={styles.loungeImage} />
        <View style={styles.loungeRatingBadge}>
          <Star size={11} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
          <Text style={styles.loungeRatingText}>{lounge.ratings.overall}</Text>
        </View>
      </View>
      <View style={styles.loungeInfoRow}>
        <View style={styles.loungeInfoText}>
          <Text style={styles.loungeName} numberOfLines={1}>
            {lounge.name}
          </Text>
          <View style={styles.loungeLocationRow}>
            <MapPin size={12} color={theme.colors.mutedGray} />
            <Text style={styles.loungeLocation} numberOfLines={1}>
              {lounge.address}
            </Text>
          </View>
        </View>
        {/* Remove sits next to the chevron rather than behind a swipe: a
            swipe gesture inside a horizontally-paging gallery screen is easy
            to trigger by accident and impossible to discover on purpose. */}
        <Pressable
          style={styles.loungeRemoveButton}
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${lounge.name} from this collection`}
        >
          <Trash2 size={15} color={theme.colors.mutedGray} />
        </Pressable>
        <Pressable style={styles.loungeChevronButton} onPress={onPress} hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Open"
        >
          <ChevronRight size={18} color={theme.colors.primaryBlack} />
        </Pressable>
      </View>
    </View>
  );
}

export default function CollectionDetailScreen() {
  const navigation = useNavigation<CollectionDetailNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const route = useRoute<CollectionDetailRouteProp>();
  const collectionId = route.params?.collectionId;
  const insets = useSafeAreaInsets();
  const userId = auth.currentUser?.uid;

  const [collection, setCollection] = useState<UserCollection | null | undefined>(undefined);
  const [lounges, setLounges] = useState<Lounge[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [activeSlide, setActiveSlide] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [favoritePending, setFavoritePending] = useState(false);

  // Renaming happens inline in a small dialog rather than by reusing
  // CreateCollectionScreen: that screen is a full-page create flow with a
  // cover-image picker, and pushing it in "edit" mode would make a rename look
  // like starting again.
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const load = useCallback(async () => {
    if (!userId || !collectionId) {
      setError('No collection selected.');
      return;
    }
    setError(null);
    setCollection(undefined);
    try {
      const collectionResult = await getUserCollection(userId, collectionId);
      setCollection(collectionResult);
      if (collectionResult) {
        setFavorited(collectionResult.isFavorited ?? false);
        setLounges(await getLoungesByIds(collectionResult.loungeIds));
      } else {
        setError("This collection couldn't be found.");
      }
    } catch {
      setError("Couldn't load this collection. Check your connection and try again.");
    }
  }, [userId, collectionId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onGalleryScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveSlide(index);
  };

  const onShare = () => {
    if (!collection) return;
    Share.share({ message: collection.name }).catch(() => {});
  };

  const onToggleFavorite = async () => {
    if (!userId || !collectionId || favoritePending) return;
    const optimistic = !favorited;
    setFavorited(optimistic);
    setFavoritePending(true);
    try {
      const confirmed = await toggleCollectionFavorite(userId, collectionId);
      setFavorited(confirmed);
    } catch {
      setFavorited(!optimistic);
      Alert.alert("Couldn't update favorites", 'Check your connection and try again.');
    } finally {
      setFavoritePending(false);
    }
  };

  /** Rename — the single edit QA actually asked for, and the one that matters. */
  const submitRename = async () => {
    const trimmed = draftName.trim();
    if (!userId || !collectionId || !trimmed || savingName) {
      return;
    }
    setSavingName(true);
    try {
      await updateCollection(userId, collectionId, { name: trimmed });
      setCollection(prev => (prev ? { ...prev, name: trimmed } : prev));
      setRenaming(false);
    } catch {
      Alert.alert("Couldn't rename it", 'Check your connection and try again.');
    } finally {
      setSavingName(false);
    }
  };

  const confirmDelete = () => {
    if (!userId || !collectionId || !collection) {
      return;
    }
    Alert.alert(
      `Delete “${collection.name}”?`,
      // Said explicitly, because it is the thing a member is afraid of. A
      // collection is a grouping, not a folder that holds the only copy.
      'The collection is removed. The lounges in it stay saved and stay in your favorites.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCollection(userId, collectionId);
              navigation.goBack();
            } catch {
              Alert.alert("Couldn't delete it", 'Check your connection and try again.');
            }
          },
        },
      ],
    );
  };

  const confirmRemoveLounge = (lounge: Lounge) => {
    if (!userId || !collectionId) {
      return;
    }
    Alert.alert(
      `Remove ${lounge.name}?`,
      'It comes out of this collection only — it stays saved elsewhere.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            // Optimistic, then reconciled by the focus refetch. Removing a row
            // that visibly stays put reads as a broken button.
            setLounges(prev => prev.filter(item => item.id !== lounge.id));
            setCollection(prev =>
              prev
                ? { ...prev, loungeIds: prev.loungeIds.filter(id => id !== lounge.id) }
                : prev,
            );
            try {
              await removeLoungeFromCollection(userId, collectionId, lounge.id);
            } catch {
              Alert.alert("Couldn't remove it", 'Check your connection and try again.');
              load();
            }
          },
        },
      ],
    );
  };

  /**
   * Rename / Delete, in an action sheet off the header.
   *
   * Alert with three buttons rather than a custom sheet component — this app
   * has no shared action-sheet primitive, and inventing one for two options
   * would be more surface than the feature.
   */
  const openManageMenu = () => {
    if (!collection) {
      return;
    }
    Alert.alert(collection.name, undefined, [
      {
        text: 'Rename',
        onPress: () => {
          setDraftName(collection.name);
          setRenaming(true);
        },
      },
      { text: 'Delete collection', style: 'destructive', onPress: confirmDelete },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openLounge = (loungeId: string) => {
    // Cross-tab navigation into the Search stack's LoungeDetail screen.
    // MainTabParamList types "Search" as `undefined` (it doesn't model
    // the nested stack), so a plain typed call can't express this;
    // React Navigation supports it fine at runtime.
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'LoungeDetail',
      params: { loungeId },
    });
  };

  if (!collection) {
    return (
      <View style={[styles.screen, styles.stateScreen, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButtonAlone} onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={22} color={theme.colors.white} />
        </Pressable>
        <View style={styles.stateBox}>
          {error ? (
            <>
              <Text style={styles.errorText}>{error}</Text>
              {collectionId ? (
                <Pressable style={styles.retryButton} onPress={load}>
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </Pressable>
              ) : null}
            </>
          ) : (
            <ActivityIndicator color={theme.colors.secondarySilver} />
          )}
        </View>
      </View>
    );
  }

  const galleryImages = lounges.length > 0 ? lounges.map(l => loungeImageUri(l)) : [collection.coverImage];
  const PrivacyIcon = collection.isPrivate ? Lock : Globe;

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Gallery ---------------- */}
        <View style={styles.galleryWrapper}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={onGalleryScrollEnd}
          >
            {galleryImages.map((uri, index) => (
              <Image key={index} source={{ uri }} style={styles.galleryImage} resizeMode="cover" />
            ))}
          </ScrollView>

          <View style={[styles.headerRow, { paddingTop: insets.top + theme.spacing.sm }]}>
            <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={8}>
              <ChevronLeft size={20} color={theme.colors.white} />
            </Pressable>
            <View style={styles.headerRightButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add to favourites"
                style={styles.headerButton}
                onPress={onToggleFavorite}
                hitSlop={8}
              >
                <Heart
                  size={18}
                  color={theme.colors.white}
                  fill={favorited ? theme.colors.white : 'transparent'}
                />
              </Pressable>
              <Pressable style={styles.headerButton} onPress={onShare} hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Share this lounge"
              >
                <Share2 size={18} color={theme.colors.white} />
              </Pressable>
              <Pressable
                style={styles.headerButton}
                onPress={openManageMenu}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Rename or delete this collection"
              >
                <MoreVertical size={18} color={theme.colors.white} />
              </Pressable>
            </View>
          </View>

          <View style={styles.dotRow}>
            {galleryImages.map((_, index) => (
              <View key={index} style={[styles.dot, index === activeSlide && styles.dotActive]} />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          {/* ---------------- Badges ---------------- */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <PrivacyIcon size={12} color={theme.colors.accentGold} />
              <Text style={styles.badgeText}>
                {collection.isPrivate ? 'Private Folder' : 'Public Folder'}
              </Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{collection.loungeIds.length} Lounges</Text>
            </View>
          </View>

          <Text style={styles.name}>{collection.name}</Text>

          <View style={styles.updatedRow}>
            <Calendar size={13} color={theme.colors.mutedGray} />
            <Text style={styles.updatedText}>
              Last updated {collection.updatedAt.toDate().toLocaleDateString()}
            </Text>
          </View>

          {/* ---------------- Description ---------------- */}
          {collection.description ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Description</Text>
              <Text style={styles.description}>{collection.description}</Text>
            </View>
          ) : null}

          {/* ---------------- Saved Lounges ---------------- */}
          <View style={[styles.section, styles.lastSection]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Saved Lounges</Text>
            </View>
            {lounges.length === 0 ? (
              <Text style={styles.description}>
                No lounges saved yet — add one from a lounge's detail page.
              </Text>
            ) : (
              <View style={styles.loungeList}>
                {lounges.map(lounge => (
                  <SavedLoungeRow
                    key={lounge.id}
                    lounge={lounge}
                    onPress={() => openLounge(lounge.id)}
                    onRemove={() => confirmRemoveLounge(lounge)}
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Rename dialog. A plain absolutely-positioned overlay rather than a
          Modal: this screen is already inside a native-stack screen, and a
          Modal over it fights the header's safe-area insets on iOS. */}
      {renaming && (
        <View style={styles.renameBackdrop}>
          <View style={styles.renameCard}>
            <Text style={styles.renameTitle}>Rename collection</Text>
            <TextInput
              style={styles.renameInput}
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Collection name"
              placeholderTextColor={theme.colors.mutedGray}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={submitRename}
              maxLength={60}
            />
            <View style={styles.renameActions}>
              <Pressable
                style={styles.renameCancel}
                onPress={() => setRenaming(false)}
                disabled={savingName}
              >
                <Text style={styles.renameCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.renameSave,
                  (!draftName.trim() || savingName) && styles.renameSaveDisabled,
                ]}
                onPress={submitRename}
                disabled={!draftName.trim() || savingName}
              >
                <Text style={styles.renameSaveText}>{savingName ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
  },

  // ---- Gallery ----
  galleryWrapper: {
    position: 'relative',
    height: GALLERY_HEIGHT,
    backgroundColor: theme.colors.surface,
  },
  galleryImage: {
    width: SCREEN_WIDTH,
    height: GALLERY_HEIGHT,
  },
  headerRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
  },
  headerRightButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.background, 0.5),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotRow: {
    position: 'absolute',
    bottom: theme.spacing.md,
    left: theme.spacing.lg,
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 18,
    height: 3,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.white, 0.35),
  },
  dotActive: {
    backgroundColor: theme.colors.accentGold,
  },

  // ---- Content ----
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
  },
  badgeText: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.secondarySilver,
  },
  name: {
    ...theme.typography.headingLarge,
    fontSize: 32,
    lineHeight: 38,
    color: theme.colors.white,
    marginTop: theme.spacing.sm,
  },
  updatedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  updatedText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },

  // ---- Sections ----
  section: {
    marginTop: theme.spacing.xl,
  },
  lastSection: {
    marginBottom: theme.spacing.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: theme.colors.white,
    marginBottom: theme.spacing.md,
  },
  description: {
    ...theme.typography.medium,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.secondarySilver,
  },

  // ---- Loading / error state ----
  stateScreen: {
    paddingHorizontal: theme.spacing.lg,
  },
  backButtonAlone: {
    alignSelf: 'flex-start',
  },
  stateBox: {
    flex: 1,
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

  // ---- Saved lounges ----
  loungeList: {
    gap: theme.spacing.lg,
  },
  loungeCard: {
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
    ...theme.shadows.soft,
  },
  loungeImageWrapper: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 10,
  },
  loungeImage: {
    ...StyleSheet.absoluteFill,
  },
  loungeRatingBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: withAlpha(theme.colors.background, 0.7),
  },
  loungeRatingText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 12,
    color: theme.colors.white,
  },
  loungeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  loungeInfoText: {
    flex: 1,
    gap: 2,
  },
  loungeName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
  },
  loungeLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  loungeLocation: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  loungeChevronButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loungeRemoveButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.xs,
  },

  renameBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: withAlpha(theme.colors.primaryBlack, 0.75),
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  renameCard: {
    width: '100%',
    padding: theme.spacing.lg,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.md,
  },
  renameTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 16,
    color: theme.colors.white,
  },
  renameInput: {
    ...theme.typography.medium,
    fontSize: 15,
    color: theme.colors.white,
    height: 46,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  renameActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  renameCancel: {
    paddingHorizontal: theme.spacing.md,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  renameCancelText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  renameSave: {
    paddingHorizontal: theme.spacing.lg,
    height: 40,
    borderRadius: theme.radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentGold,
  },
  renameSaveDisabled: {
    opacity: 0.4,
  },
  renameSaveText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.primaryBlack,
  },
});
