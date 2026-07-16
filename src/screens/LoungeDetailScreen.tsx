/**
 * LoungeDetailScreen
 *
 * Matches design-reference/Lounge Detail Screen.pdf: swipeable image
 * gallery with overlaid header icons, rating/name/address, a reserve
 * button, "The Experience" description + status row, an amenities grid,
 * a "Humidor Highlights" rail, "The Verdict" score card, and a recent
 * review preview. Reads the lounge (by route param `loungeId`) and its
 * most recent review from Firestore via src/services/loungeService.ts —
 * see src/types/firestore.ts for the schema. "The Verdict" reuses the
 * lounge's own rating breakdown rather than a separate mock scoring set.
 */

import React, { useCallback, useEffect, useState } from 'react';
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
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  Bookmark,
  CalendarCheck,
  ChevronLeft,
  Clock,
  MapPin,
  MessageCircle,
  Pencil,
  Share2,
  Star,
  ThumbsUp,
  Trash2,
} from 'lucide-react-native';
import { theme } from '../theme';
import AmenityCard from '../components/AmenityCard';
import ProgressRatingBar from '../components/ProgressRatingBar';
import AddToCollectionSheet from '../components/AddToCollectionSheet';
import FavoriteButton from '../components/FavoriteButton';
import { getAmenityIcon } from '../utils/amenityIcon';
import { getLoungeById, getReviewsForLounge, type Lounge, type Review } from '../services/loungeService';
import { deleteReview, isFavorited } from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

type LoungeDetailNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type LoungeDetailRouteProp = RouteProp<SearchStackParamList, 'LoungeDetail'>;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GALLERY_HEIGHT = 380;

const VERDICT_CATEGORIES: Array<{ key: keyof Lounge['ratings']; label: string }> = [
  { key: 'atmosphere', label: 'Atmosphere' },
  { key: 'humidorVariety', label: 'Humidor Variety' },
  { key: 'service', label: 'Service' },
  { key: 'comfort', label: 'Comfort' },
];

export default function LoungeDetailScreen() {
  const navigation = useNavigation<LoungeDetailNavigationProp>();
  const route = useRoute<LoungeDetailRouteProp>();
  const insets = useSafeAreaInsets();
  const loungeId = route.params?.loungeId;

  const [lounge, setLounge] = useState<Lounge | null | undefined>(undefined);
  const [latestReview, setLatestReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favorited, setFavorited] = useState<boolean | null>(null);

  const [activeSlide, setActiveSlide] = useState(0);
  const [collectionSheetVisible, setCollectionSheetVisible] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);

  const userId = auth.currentUser?.uid;

  const load = useCallback(async () => {
    if (!loungeId) {
      setError('No lounge selected.');
      return;
    }
    setError(null);
    setLounge(undefined);
    try {
      const [loungeResult, reviews, favoritedResult] = await Promise.all([
        getLoungeById(loungeId),
        getReviewsForLounge(loungeId),
        userId ? isFavorited(userId, loungeId) : Promise.resolve(false),
      ]);
      setLounge(loungeResult);
      setLatestReview(reviews[0] ?? null);
      setFavorited(favoritedResult);
      if (!loungeResult) {
        setError("This lounge couldn't be found.");
      }
    } catch {
      setError("Couldn't load this lounge. Check your connection and try again.");
    }
  }, [loungeId, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const onGalleryScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveSlide(index);
  };

  const onShare = () => {
    if (!lounge) return;
    Share.share({ message: `${lounge.name} — ${lounge.address}` }).catch(() => {});
  };

  // Edit/delete are only offered on latestReview when it belongs to the
  // signed-in member (checked at render time via review.userId ===
  // auth.currentUser?.uid) — this preview card is the only place in the
  // app that currently renders a real (non-mock) review with its Firestore
  // id, so it's where edit/delete for the member's own review lives.
  const onEditReview = () => {
    if (!latestReview || !loungeId) return;
    navigation.navigate('WriteReview', {
      loungeId,
      reviewId: latestReview.id,
      initialReview: {
        rating: latestReview.rating,
        text: latestReview.text,
        categoryRatings: latestReview.categoryRatings,
        wouldReturn: latestReview.wouldReturn,
        recommend: latestReview.recommend,
        photos: latestReview.photos,
      },
    });
  };

  const onDeleteReview = () => {
    if (!latestReview || !loungeId || deletingReview) return;
    Alert.alert('Delete Review', 'Are you sure you want to delete this review?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeletingReview(true);
          try {
            await deleteReview(loungeId, latestReview.id);
            setLatestReview(null);
          } catch {
            Alert.alert("Couldn't delete review", 'Check your connection and try again.');
          } finally {
            setDeletingReview(false);
          }
        },
      },
    ]);
  };

  if (!lounge) {
    return (
      <View style={[styles.screen, styles.stateScreen, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButtonAlone} onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={22} color={theme.colors.white} />
        </Pressable>
        <View style={styles.stateBox}>
          {error ? (
            <>
              <Text style={styles.errorText}>{error}</Text>
              {loungeId ? (
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
            {lounge.images.map((uri, index) => (
              <Image
                key={index}
                source={{ uri }}
                style={styles.galleryImage}
                resizeMode="cover"
              />
            ))}
          </ScrollView>

          <View style={[styles.headerRow, { paddingTop: insets.top + theme.spacing.sm }]}>
            <Pressable style={styles.headerButton} onPress={() => navigation.goBack()} hitSlop={8}>
              <ChevronLeft size={20} color={theme.colors.white} />
            </Pressable>
            <View style={styles.headerRightButtons}>
              {userId && favorited !== null ? (
                <FavoriteButton
                  style={styles.headerButton}
                  userId={userId}
                  loungeId={lounge.id}
                  initialFavorited={favorited}
                />
              ) : null}
              <Pressable
                style={styles.headerButton}
                onPress={() => setCollectionSheetVisible(true)}
                hitSlop={8}
              >
                <Bookmark size={18} color={theme.colors.white} fill="transparent" />
              </Pressable>
              <Pressable style={styles.headerButton} onPress={onShare} hitSlop={8}>
                <Share2 size={18} color={theme.colors.white} />
              </Pressable>
            </View>
          </View>

          <View style={styles.dotRow}>
            {lounge.images.map((_, index) => (
              <View
                key={index}
                style={[styles.dot, index === activeSlide && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <View style={styles.content}>
          {/* ---------------- Rating / Name / Address ---------------- */}
          <View style={styles.ratingRow}>
            <Star size={14} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
            <Text style={styles.ratingValue}>{lounge.ratings.overall}</Text>
            <Text style={styles.reviewCount}>· {lounge.reviewCount} Reviews</Text>
          </View>
          <Text style={styles.name}>{lounge.name}</Text>
          <View style={styles.addressRow}>
            <MapPin size={14} color={theme.colors.mutedGray} />
            <Text style={styles.address}>{lounge.address}</Text>
          </View>

          {/* ---------------- Reserve Button ---------------- */}
          <Pressable
            style={styles.reserveButton}
            onPress={() => Alert.alert('Coming Soon', 'Table reservations are not available yet.')}
          >
            <Text style={styles.reserveButtonText}>Reserve a Table</Text>
            <CalendarCheck size={18} color={theme.colors.primaryNavy} />
          </Pressable>

          {/* ---------------- The Experience ---------------- */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>The Experience</Text>
            <Text style={styles.description}>{lounge.description}</Text>

            <View style={styles.statusRow}>
              <Clock size={16} color={theme.colors.secondarySilver} />
              <View style={styles.statusTextGroup}>
                <Text style={styles.statusLabel}>
                  {lounge.status === 'open' ? 'Open' : 'Closed'}
                </Text>
                <Text style={styles.statusValue}>{lounge.hours}</Text>
              </View>
            </View>
          </View>

          {/* ---------------- Amenities ---------------- */}
          {lounge.amenities.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Amenities</Text>
              <View style={styles.amenityGrid}>
                {lounge.amenities.map(amenity => {
                  const Icon = getAmenityIcon(amenity);
                  return (
                    <AmenityCard
                      key={amenity}
                      icon={<Icon size={18} color={theme.colors.secondarySilver} />}
                      label={amenity}
                    />
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* ---------------- Humidor Highlights ---------------- */}
          {lounge.humidorItems.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Humidor Highlights</Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.humidorRow}
              >
                {lounge.humidorItems.map(item => (
                  <View key={item.name} style={styles.humidorCard}>
                    <View style={styles.humidorImageWrapper}>
                      <Image
                        source={{ uri: item.image }}
                        style={styles.humidorImage}
                        resizeMode="cover"
                      />
                      <View
                        style={[
                          styles.stockBadge,
                          item.stockStatus !== 'in-stock' && styles.stockBadgeLow,
                        ]}
                      >
                        <Text style={styles.stockBadgeText}>
                          {item.stockStatus === 'in-stock' ? 'IN STOCK' : item.stockStatus.replace('-', ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.humidorName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.humidorSubtitle}>
                      {item.strength} • {item.origin}
                    </Text>
                    <Text style={styles.humidorPrice}>{item.price}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {/* ---------------- The Verdict ---------------- */}
          <View style={styles.verdictCard}>
            <Text style={styles.verdictTitle}>The Verdict</Text>
            <View style={styles.verdictScores}>
              {VERDICT_CATEGORIES.map(item => (
                <ProgressRatingBar
                  key={item.key}
                  label={item.label}
                  score={lounge.ratings[item.key]}
                />
              ))}
            </View>
          </View>

          {/* ---------------- Recent Reviews ---------------- */}
          <View style={[styles.section, styles.lastSection]}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Recent Reviews</Text>
              <Pressable
                hitSlop={8}
                onPress={() => navigation.navigate('WriteReview', { loungeId })}
              >
                <Text style={styles.fullMenuLink}>Write Review</Text>
              </Pressable>
            </View>

            {latestReview ? (
              <Pressable
                style={styles.reviewCard}
                onPress={() => navigation.navigate('LoungeReviews', { loungeId })}
              >
                <View style={styles.reviewHeaderRow}>
                  <Image
                    source={{ uri: latestReview.userAvatar }}
                    style={styles.reviewAvatar}
                  />
                  <View style={styles.reviewAuthorGroup}>
                    <Text style={styles.reviewAuthorName}>{latestReview.userName}</Text>
                    <Text style={styles.reviewMemberTier}>{latestReview.memberTier}</Text>
                  </View>
                  <View style={styles.reviewStars}>
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star
                        key={index}
                        size={11}
                        color={theme.colors.accentGold}
                        fill={
                          index < Math.round(latestReview.rating)
                            ? theme.colors.accentGold
                            : 'transparent'
                        }
                      />
                    ))}
                  </View>
                </View>

                <Text style={styles.reviewText}>"{latestReview.text}"</Text>

                {latestReview.photos.length > 0 ? (
                  <View style={styles.reviewPhotoRow}>
                    {latestReview.photos.map((uri, index) => (
                      <Image key={index} source={{ uri }} style={styles.reviewPhoto} />
                    ))}
                  </View>
                ) : null}

                <View style={styles.reviewFooterRow}>
                  <View style={styles.reviewStat}>
                    <ThumbsUp size={13} color={theme.colors.mutedGray} />
                    <Text style={styles.reviewStatText}>{latestReview.helpfulCount}</Text>
                  </View>
                  <View style={styles.reviewStat}>
                    <MessageCircle size={13} color={theme.colors.mutedGray} />
                  </View>
                  {userId && latestReview.userId === userId ? (
                    <View style={styles.reviewOwnerActions}>
                      <Pressable onPress={onEditReview} hitSlop={8} disabled={deletingReview}>
                        <Pencil size={15} color={theme.colors.mutedGray} />
                      </Pressable>
                      <Pressable onPress={onDeleteReview} hitSlop={8} disabled={deletingReview}>
                        {deletingReview ? (
                          <ActivityIndicator size="small" color={theme.colors.danger} />
                        ) : (
                          <Trash2 size={15} color={theme.colors.danger} />
                        )}
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            ) : (
              <Text style={styles.description}>No reviews yet — be the first to write one.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <AddToCollectionSheet
        visible={collectionSheetVisible}
        loungeId={lounge.id}
        lounge={{
          name: lounge.name,
          location: lounge.address,
          imageUri: lounge.images[0],
        }}
        onClose={() => setCollectionSheetVisible(false)}
        onCreateNew={() => {
          setCollectionSheetVisible(false);
          navigation.navigate('CreateCollection');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingBottom: 140,
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

  // ---- Gallery ----
  galleryWrapper: {
    position: 'relative',
    height: GALLERY_HEIGHT,
    backgroundColor: theme.colors.surfaceNavy,
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
    backgroundColor: 'rgba(5, 10, 24, 0.5)',
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
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
  },
  dotActive: {
    backgroundColor: theme.colors.white,
  },

  // ---- Content ----
  content: {
    paddingHorizontal: theme.spacing.lg,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: theme.spacing.lg,
  },
  ratingValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  reviewCount: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },
  name: {
    ...theme.typography.headingLarge,
    fontSize: 32,
    lineHeight: 38,
    color: theme.colors.white,
    marginTop: theme.spacing.xs,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.sm,
  },
  address: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
    flexShrink: 1,
  },

  // ---- Reserve button ----
  reserveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    marginTop: theme.spacing.lg,
  },
  reserveButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
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
  fullMenuLink: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 12,
    color: theme.colors.secondarySilver,
    textAlign: 'right',
  },
  description: {
    ...theme.typography.medium,
    fontSize: 14,
    lineHeight: 21,
    color: theme.colors.secondarySilver,
  },

  // ---- Status / hours ----
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
  },
  statusTextGroup: {
    flex: 1,
    gap: 2,
  },
  statusLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  statusValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  // ---- Amenities ----
  amenityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },

  // ---- Humidor Highlights ----
  humidorRow: {
    gap: theme.spacing.md,
  },
  humidorCard: {
    width: 150,
    gap: 2,
  },
  humidorImageWrapper: {
    position: 'relative',
    aspectRatio: 1,
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceNavy,
    marginBottom: theme.spacing.xs,
  },
  humidorImage: {
    ...StyleSheet.absoluteFill,
  },
  stockBadge: {
    position: 'absolute',
    top: theme.spacing.xs,
    left: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.success,
  },
  stockBadgeLow: {
    backgroundColor: theme.colors.danger,
  },
  stockBadgeText: {
    ...theme.typography.caption,
    fontSize: 8,
    color: theme.colors.white,
  },
  humidorName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },
  humidorSubtitle: {
    ...theme.typography.medium,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  humidorPrice: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.accentGold,
    marginTop: 2,
  },

  // ---- The Verdict ----
  verdictCard: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    ...theme.shadows.soft,
  },
  verdictTitle: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.regular,
    fontSize: 22,
    color: theme.colors.white,
    marginBottom: theme.spacing.lg,
  },
  verdictScores: {
    gap: theme.spacing.md,
  },

  // ---- Review card ----
  reviewCard: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: theme.spacing.sm,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
  },
  reviewAuthorGroup: {
    flex: 1,
    gap: 1,
  },
  reviewAuthorName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  reviewMemberTier: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.accentGold,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    ...theme.typography.medium,
    fontSize: 13,
    lineHeight: 20,
    color: theme.colors.secondarySilver,
  },
  reviewPhotoRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  reviewPhoto: {
    width: 72,
    height: 72,
    borderRadius: theme.radius.small,
    backgroundColor: theme.colors.background,
  },
  reviewFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  reviewTimeAgo: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
    flex: 1,
  },
  reviewStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reviewStatText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  reviewOwnerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginLeft: 'auto',
  },
});
