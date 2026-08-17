/**
 * RecentlyViewedScreen
 *
 * Full list of the signed-in member's recently viewed lounges — reached
 * from SearchSuggestionsScreen's "View All" row once there are more than
 * the 5 shown inline there. Real data via
 * userActionsService.getRecentlyViewedLounges (see LoungeDetailScreen for
 * where each view gets recorded), rendered with the same SearchResultCard
 * tile SearchResultsScreen uses, so this reads as a normal results list
 * rather than a bespoke history UI.
 *
 * Not the same thing as design-reference/Search History Screen.pdf —
 * that design is about past *search queries* (grouped by day, with
 * favorite/delete/clear-all), which isn't tracked anywhere in this app
 * yet. This screen is lounge *views*, which is what was actually asked
 * for and already had tracking wired up.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../theme';
import SearchResultCard from '../components/SearchResultCard';
import AddToCollectionSheet from '../components/AddToCollectionSheet';
import type { Lounge } from '../services/loungeService';
import { getRecentlyViewedLounges, getUserFavoriteIds } from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import type { SearchStackParamList } from '../navigation/SearchNavigator';
import { loungeImageUri } from '../utils/loungeImage';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type RecentlyViewedNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

export default function RecentlyViewedScreen() {
  const navigation = useNavigation<RecentlyViewedNavigationProp>();
  const userId = auth.currentUser?.uid;

  const [lounges, setLounges] = useState<Lounge[] | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [savingResult, setSavingResult] = useState<Lounge | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!userId) {
        setLounges([]);
        return;
      }
      setError(null);
      Promise.all([getRecentlyViewedLounges(userId, 20), getUserFavoriteIds(userId)])
        .then(([recent, favorites]) => {
          setLounges(recent);
          setFavoriteIds(new Set(favorites));
        })
        .catch(() => setError("Couldn't load your recently viewed lounges."));
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
        <Text style={styles.title}>Recently Viewed</Text>
      </View>

      {error ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>{error}</Text>
        </View>
      ) : lounges === null ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : lounges.length === 0 ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Lounges you view will show up here.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {lounges.map(lounge => (
            <SearchResultCard
              key={lounge.id}
              result={lounge}
              userId={userId}
              favorited={favoriteIds.has(lounge.id)}
              onPressDetails={() => navigation.navigate('LoungeDetail', { loungeId: lounge.id })}
              onPressDirections={() => {
                const { lat, lng } = lounge.coordinates;
                const url =
                  Platform.OS === 'ios'
                    ? `https://maps.apple.com/?daddr=${lat},${lng}`
                    : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                Linking.openURL(url);
              }}
              onPressSave={() => setSavingResult(lounge)}
            />
          ))}
        </ScrollView>
      )}

      {savingResult ? (
        <AddToCollectionSheet
          visible
          loungeId={savingResult.id}
          lounge={{
            name: savingResult.name,
            location: savingResult.address,
            imageUri: loungeImageUri(savingResult),
          }}
          onClose={() => setSavingResult(null)}
          onCreateNew={() => {
            setSavingResult(null);
            navigation.navigate('CreateCollection');
          }}
        />
      ) : null}
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
});
