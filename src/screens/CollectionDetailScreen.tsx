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
  Share2,
  Star,
} from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth } from '../services/firebaseAuth';
import {
  getUserCollection,
  toggleCollectionFavorite,
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

function SavedLoungeRow({ lounge, onPress }: { lounge: Lounge; onPress: () => void }) {
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
        <Pressable style={styles.loungeChevronButton} onPress={onPress} hitSlop={8}>
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
              <Pressable style={styles.headerButton} onPress={onShare} hitSlop={8}>
                <Share2 size={18} color={theme.colors.white} />
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
                  />
                ))}
              </View>
            )}
          </View>
        </View>
      </ScrollView>
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
    backgroundColor: theme.colors.white,
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
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
