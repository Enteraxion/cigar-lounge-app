/**
 * SearchScreen
 *
 * Matches design-reference/Search Home Screen.pdf top to bottom: header +
 * search bar, filter chips, recent searches, popular destinations,
 * trending cities, recently viewed, and a featured travel guide banner.
 *
 * Recent Searches, Popular Destinations, Trending Cities, and Recently
 * Viewed are all real now — refetched on focus (useFocusEffect) so
 * running a search or viewing a lounge elsewhere shows up here
 * immediately on return:
 *  - Recent Searches: userActionsService.getRecentSearches — see
 *    SearchResultsScreen's recordSearch() call for where each entry gets
 *    written, and clearSearchHistory for "Clear All".
 *  - Popular Destinations / Trending Cities: loungeService's
 *    getPopularDestinations/getTrendingCities, ranked by real lounge
 *    density per city (see LoungeDocument.city, only populated on
 *    Yelp-imported lounges).
 *  - Recently Viewed: userActionsService.getRecentlyViewedLounges (same
 *    view-tracking SearchSuggestionsScreen's Recently Visited uses).
 *
 * Filter chips (Nearby/Open Now/Premium/Whiskey) now run a real
 * SearchResultsScreen query too — see pressFilterChip below and
 * SearchStackParamList's initialQuickFilterIds/initialFilters params,
 * which seed SearchResultsScreen's existing (already-real) selectedChips/
 * appliedFilters state.
 *
 * Still mock/non-functional, deliberately not touched here: Featured
 * Travel Guide has no backing content model anywhere in the app (would
 * mean writing actual destination-guide content, a product/content task,
 * not a data-wiring one) — stays "Coming Soon".
 */

import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, History, Mic, Search as SearchIcon } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import SectionHeader from '../components/SectionHeader';
import FilterChip from '../components/FilterChip';
import CompactLoungeCard from '../components/CompactLoungeCard';
import type { SearchStackParamList } from '../navigation/SearchNavigator';
import { filterChips } from '../data/mockSearch';
import {
  getPopularDestinations,
  getTrendingCities,
  type Lounge,
  getFeaturedCityGuide,
  type FeaturedCityGuide,
  type PopularDestination,
  type TrendingCity,
} from '../services/loungeService';
import {
  clearSearchHistory,
  getRecentlyViewedLounges,
  getRecentSearches,
  type SearchHistoryEntry,
} from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import { displayTags } from '../utils/displayTags';
import { loungeImageUri } from '../utils/loungeImage';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type SearchNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

/** "Today" / "Yesterday" / a short date, for a recent search's subtitle. */
function relativeDayLabel(date: Date): string {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000));
  if (dayDiff === 0) return 'Today';
  if (dayDiff === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SearchScreen() {
  const navigation = useNavigation<SearchNavigationProp>();
  const [selectedChip, setSelectedChip] = useState('nearby');
  const [recentSearches, setRecentSearches] = useState<SearchHistoryEntry[]>([]);
  const [popularDestinations, setPopularDestinations] = useState<PopularDestination[]>([]);
  const [featuredGuide, setFeaturedGuide] = useState<FeaturedCityGuide | null>(null);
  const [trendingCities, setTrendingCities] = useState<TrendingCity[]>([]);
  const [recentlyViewedLounges, setRecentlyViewedLounges] = useState<Lounge[]>([]);

  useFocusEffect(
    useCallback(() => {
      getPopularDestinations()
        .then(setPopularDestinations)
        .catch(() => {});
      getTrendingCities()
        .then(setTrendingCities)
        .catch(() => {});
      getFeaturedCityGuide()
        .then(setFeaturedGuide)
        .catch(() => {});

      const userId = auth.currentUser?.uid;
      if (!userId) {
        return;
      }
      getRecentSearches(userId, 5)
        .then(setRecentSearches)
        .catch(() => {});
      getRecentlyViewedLounges(userId, 10)
        .then(setRecentlyViewedLounges)
        .catch(() => {});
    }, []),
  );

  const clearRecentSearches = () => {
    const userId = auth.currentUser?.uid;
    if (!userId) {
      return;
    }
    clearSearchHistory(userId)
      .then(() => setRecentSearches([]))
      .catch(() => Alert.alert('Something went wrong', 'Could not clear search history.'));
  };

  /**
   * Filter chips run a real SearchResultsScreen query pre-filtered to
   * match: Nearby -> distance-from-current-location, Open Now/Premium ->
   * the same quick filter chips SearchResultsScreen already has, Whiskey
   * -> the Filter sheet's "Whiskey Tastings" entertainment category
   * (see src/utils/loungeSearch.ts's keywordForLabel — matches lounges
   * whose tags/amenities/description mention whiskey).
   */
  const pressFilterChip = (chipId: string) => {
    setSelectedChip(chipId);
    switch (chipId) {
      case 'nearby':
        navigation.navigate('SearchResults', { initialFilters: { nearCurrentLocation: true } });
        break;
      case 'open-now':
        navigation.navigate('SearchResults', { initialQuickFilterIds: ['open-now'] });
        break;
      case 'premium':
        navigation.navigate('SearchResults', { initialQuickFilterIds: ['premium'] });
        break;
      case 'whiskey':
        navigation.navigate('SearchResults', { initialFilters: { entertainment: ['Whiskey Tastings'] } });
        break;
    }
  };

  const openVoiceSearch = () => {
    // VoiceSearch is a root-level modal (see AppNavigator) reachable from
    // more than one tab; SearchStackParamList doesn't model it, but
    // navigate() bubbles up to the ancestor Stack.Navigator at runtime.
    (navigation.navigate as (name: string, params?: object) => void)('VoiceSearch');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- Header ---------------- */}
        <Text style={styles.title}>Explore Lounges</Text>
        <Pressable
          style={styles.searchBar}
          onPress={() => navigation.navigate('LiveSearchSuggestions')}
        >
          <SearchIcon size={18} color={theme.colors.mutedGray} />
          <Text style={styles.searchPlaceholder}>Lounges, cities, or brands...</Text>
          <Pressable onPress={openVoiceSearch} hitSlop={8}>
            <Mic size={18} color={theme.colors.mutedGray} />
          </Pressable>
        </Pressable>

        {/* ---------------- Filter Chips ---------------- */}
        <FlatList
          data={filterChips}
          keyExtractor={item => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: theme.spacing.sm }}
          renderItem={({ item }) => (
            <FilterChip
              label={item.label}
              selected={selectedChip === item.id}
              onPress={() => pressFilterChip(item.id)}
            />
          )}
        />

        {/* ---------------- Recent Searches ---------------- */}
        {recentSearches.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Recent Searches" actionLabel="Clear All" onActionPress={clearRecentSearches} />
            <View style={{ gap: theme.spacing.md }}>
              {recentSearches.map(item => (
                <Pressable
                  key={item.id}
                  style={styles.recentRow}
                  onPress={() => navigation.navigate('SearchResults', { query: item.term })}
                >
                  <View style={styles.recentIcon}>
                    <History size={16} color={theme.colors.secondarySilver} />
                  </View>
                  <View style={styles.recentDetails}>
                    <Text style={styles.recentTerm} numberOfLines={1}>
                      {item.term}
                    </Text>
                    <Text style={styles.recentSubtitle}>
                      {relativeDayLabel(item.searchedAt.toDate())}
                    </Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ---------------- Popular Destinations ---------------- */}
        {popularDestinations.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Popular Destinations" />
            <FlatList
              data={popularDestinations}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ width: theme.spacing.md }} />}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.destinationCard}
                  onPress={() => navigation.navigate('SearchResults', { query: item.city })}
                >
                  <Image
                    source={{ uri: item.imageUri }}
                    style={styles.destinationImage}
                    resizeMode="cover"
                  />
                  <LinearGradient
                    colors={['transparent', withAlpha(theme.colors.background, 0.85)]}
                    style={styles.destinationGradient}
                    pointerEvents="none"
                  />
                  <Text style={styles.destinationName}>{item.city}</Text>
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* ---------------- Trending Cities ---------------- */}
        {trendingCities.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Trending Cities" />
            <View style={styles.trendingCard}>
              {trendingCities.map(item => (
                <Pressable
                  key={item.id}
                  style={styles.trendingRow}
                  onPress={() => navigation.navigate('SearchResults', { query: item.name })}
                >
                  <Text style={styles.trendingRank}>{item.rank}</Text>
                  <Text style={styles.trendingName}>{item.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ---------------- Recently Viewed ---------------- */}
        {recentlyViewedLounges.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Recently Viewed" />
            <FlatList
              data={recentlyViewedLounges}
              keyExtractor={item => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ width: theme.spacing.md }} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => navigation.navigate('LoungeDetail', { loungeId: item.id })}
                >
                  <CompactLoungeCard
                    image={{ uri: loungeImageUri(item) }}
                    name={item.name}
                    location={item.address}
                    tags={displayTags(item.tags).slice(0, 2)}
                    rating={item.ratings.overall}
                  />
                </Pressable>
              )}
            />
          </View>
        ) : null}

        {/* ---------------- Featured Travel Guide ---------------- */}
        {/* Hidden when no city qualifies — a guide we can't honour is
            worse than no guide. */}
        {featuredGuide ? (
        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.guideCard}>
            <Image
              source={{ uri: featuredGuide.imageUri }}
              style={styles.guideImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', withAlpha(theme.colors.background, 0.7), withAlpha(theme.colors.background, 0.95)]}
              locations={[0, 0.5, 1]}
              style={styles.guideGradient}
              pointerEvents="none"
            />
            <View style={styles.guideBody}>
              <Text style={styles.guideLabel}>Featured Travel Guide</Text>
              <Text style={styles.guideHeadline}>
                Traveling to {featuredGuide.city.split(',')[0]}?
              </Text>
              <Text style={styles.guideDescription}>
                {featuredGuide.loungeCount.toLocaleString()} lounges in our directory, from
                neighbourhood humidors to rooftop bars.
              </Text>
              <Pressable
                style={styles.guideButton}
                onPress={() =>
                  navigation.navigate('SearchResults', { query: featuredGuide.city })
                }
              >
                <Text style={styles.guideButtonText}>
                  Explore {featuredGuide.city.split(',')[0]}
                </Text>
                <ArrowRight size={16} color={theme.colors.primaryBlack} />
              </Pressable>
            </View>
          </View>
        </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.xl,
  },

  // ---- Header ----
  title: {
    ...theme.typography.headingLarge,
    fontSize: 30,
    color: theme.colors.white,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 48,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.2),
    marginBottom: theme.spacing.md,
  },
  searchPlaceholder: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.mutedGray,
    flex: 1,
  },

  // ---- Sections ----
  section: {
    gap: 0,
  },
  lastSection: {
    marginBottom: theme.spacing.xl,
  },

  // ---- Recent Searches ----
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  recentIcon: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentDetails: {
    flex: 1,
    gap: 2,
  },
  recentTerm: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  recentSubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Popular Destinations ----
  destinationCard: {
    width: 160,
    height: 120,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.surface,
  },
  destinationImage: {
    ...StyleSheet.absoluteFill,
  },
  destinationGradient: {
    ...StyleSheet.absoluteFill,
  },
  destinationName: {
    ...theme.typography.headingSmall,
    color: theme.colors.white,
    padding: theme.spacing.sm,
  },

  // ---- Trending Cities ----
  trendingCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.large,
    padding: theme.spacing.md,
    ...theme.shadows.soft,
  },
  trendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    width: '50%',
    paddingVertical: theme.spacing.sm,
  },
  trendingRank: {
    ...theme.typography.headingSmall,
    fontStyle: 'italic',
    color: theme.colors.accentGold,
  },
  trendingName: {
    ...theme.typography.medium,
    color: theme.colors.white,
  },

  // ---- Featured Travel Guide ----
  guideCard: {
    height: 260,
    borderRadius: theme.radius.xl,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: theme.colors.surface,
    ...theme.shadows.deep,
  },
  guideImage: {
    ...StyleSheet.absoluteFill,
  },
  guideGradient: {
    ...StyleSheet.absoluteFill,
  },
  guideBody: {
    padding: theme.spacing.md,
    gap: theme.spacing.xs,
  },
  guideLabel: {
    ...theme.typography.caption,
    color: theme.colors.accentGold,
  },
  guideHeadline: {
    ...theme.typography.headingMedium,
    fontSize: 24,
    color: theme.colors.white,
  },
  guideDescription: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
    marginBottom: theme.spacing.sm,
  },
  guideButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    height: 44,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.accentGold,
  },
  guideButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryBlack,
  },
});
