/**
 * MyReviewsScreen
 *
 * Every review the signed-in member has written, across all lounges —
 * reached by tapping the Reviews or Photos stat tile on ProfileScreen
 * (Photos routes here too since photos are attached to reviews, not a
 * separate collection — there's no standalone "my photos" feature). Real
 * data via userActionsService.getUserReviews (a collectionGroup query
 * across every lounge's reviews subcollection). Each card shows which
 * lounge the review is for and links to that lounge's detail page.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../theme';
import StarRating from '../components/StarRating';
import { getLoungesByIds, type Lounge } from '../services/loungeService';
import { getUserReviews, type UserReviewEntry } from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type MyReviewsNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

export default function MyReviewsScreen() {
  const navigation = useNavigation<MyReviewsNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const userId = auth.currentUser?.uid;

  const [reviews, setReviews] = useState<UserReviewEntry[] | null>(null);
  const [lounges, setLounges] = useState<Record<string, Lounge>>({});
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setReviews([]);
        return;
      }
      setError(null);
      getUserReviews(userId)
        .then(async userReviews => {
          setReviews(userReviews);
          const uniqueLoungeIds = Array.from(new Set(userReviews.map(r => r.loungeId)));
          const loungeList = await getLoungesByIds(uniqueLoungeIds);
          setLounges(Object.fromEntries(loungeList.map(lounge => [lounge.id, lounge])));
        })
        .catch(() => setError("Couldn't load your reviews."));
    }, [userId]),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.title}>My Reviews</Text>
      </View>

      {error ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{error}</Text>
        </View>
      ) : reviews === null ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : reviews.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Reviews you write will show up here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {reviews.map(review => {
            const lounge = lounges[review.loungeId];
            return (
              <Pressable
                key={review.id}
                style={styles.card}
                onPress={() => {
                  if (!lounge) return;
                  // Cross-tab navigation into the Search stack's LoungeDetail
                  // screen — same pattern ProfileScreen's openCollections uses.
                  (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
                    screen: 'LoungeDetail',
                    params: { loungeId: review.loungeId },
                  });
                }}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.loungeName} numberOfLines={1}>
                    {lounge?.name ?? 'Lounge'}
                  </Text>
                  <StarRating rating={review.rating} size={12} />
                </View>
                {lounge ? (
                  <Text style={styles.loungeAddress} numberOfLines={1}>
                    {lounge.address}
                  </Text>
                ) : null}
                <Text style={styles.reviewText}>"{review.text}"</Text>
                {review.photos.length > 0 ? (
                  <View style={styles.photoRow}>
                    {review.photos.map((uri, index) => (
                      <Image key={index} source={{ uri }} style={styles.photo} />
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  title: {
    ...theme.typography.headingMedium,
    fontSize: 18,
    color: theme.colors.white,
  },
  list: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.lg,
  },
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
  },
  stateText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  card: {
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  loungeName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
    flex: 1,
  },
  loungeAddress: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  reviewText: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.secondarySilver,
  },
  photoRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.medium,
  },
});
