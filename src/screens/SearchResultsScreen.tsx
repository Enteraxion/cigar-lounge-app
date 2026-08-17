/**
 * SearchResultsScreen
 *
 * Matches design-reference/Search Results Screen.pdf: search bar header,
 * sort/filter toolbar + list/map toggle, results count, quick filter
 * chips, and a vertical list of SearchResultCard tiles (or, toggled, a
 * MapView with a pin per result). Results are real Firestore lounges via
 * src/services/loungeService.ts's searchLounges() — see that file for
 * the substring-match implementation; the map view plots each result's
 * real `coordinates` field, same as the main Map tab.
 *
 * When the query is a real US city name (checked against the bundled
 * dataset in src/utils/cityAutocomplete.ts — see isKnownUsCityName), the
 * search also awaits a live per-city Yelp refresh (see
 * services/loungeRefreshService.ts / functions/src/index.ts's
 * refreshCityLounges, now deployed) before settling on a final result
 * set — so a city that's never been searched before still gets pulled in
 * on the first try instead of showing empty and quietly repopulating.
 * refreshCityLounges rate-limits itself per city (30-day cache), so this
 * only adds real wait time the first time a given city is searched.
 * Lounge-name/brand searches (e.g. "Davidoff") skip this entirely —
 * they were never going to be a real city, so calling it would just
 * waste a paid Yelp call and needlessly delay real Firestore matches
 * that already exist from showing up.
 *
 * Sort and Filter are both real now (see src/utils/loungeSearch.ts):
 * `results` is filtered (Filter sheet's SearchFilters + the quick filter
 * chips row, AND'd together) and then sorted (Sort sheet's selected
 * option) before it's rendered in the list, the map markers, and the
 * results count. Two known approximations, since there's no real device
 * geolocation anywhere in this app yet and the seeded lounge dataset's
 * `tags`/`amenities` are free-text rather than a structured taxonomy:
 * "current location" / distance-based sorting and filtering use the
 * app's default region (src/data/mockMap.ts's `defaultRegion`, the same
 * placeholder the Map tab's default view uses) as a stand-in for real
 * GPS; and Atmosphere/Amenities/Entertainment filtering is a best-effort
 * keyword substring match against `tags` + `amenities` + `description`,
 * not a real structured taxonomy lookup.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  type Region,
} from 'react-native-maps';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import {
  ArrowLeftRight,
  ArrowUpDown,
  Building2,
  ChevronLeft,
  List,
  Map as MapIcon,
  Search as SearchIcon,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import FilterChip from '../components/FilterChip';
import SearchLoadingSkeleton from '../components/SearchLoadingSkeleton';
import SearchResultCard from '../components/SearchResultCard';
import SimplifiedMapView from '../components/SimplifiedMapView';
import SortBottomSheet from '../components/SortBottomSheet';
import FilterBottomSheet from '../components/FilterBottomSheet';
import AddToCollectionSheet from '../components/AddToCollectionSheet';
import { searchLounges, type Lounge } from '../services/loungeService';
import { refreshCityLounges } from '../services/loungeRefreshService';
import { isKnownUsCityName } from '../utils/cityAutocomplete';
import {
  getUserFavoriteIds,
  recordSearch,
} from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import { quickFilterChips } from '../data/mockSearchResults';
import { defaultSortOptionId } from '../data/mockSort';
import { defaultRegion } from '../data/mockMap';
import { defaultDistanceMiles } from '../data/mockFilters';
import {
  applySearchFilters,
  isPremiumLounge,
  sortLounges,
  type SearchFilters,
} from '../utils/loungeSearch';
import type { SearchStackParamList } from '../navigation/SearchNavigator';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { loungeImageUri } from '../utils/loungeImage';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

// Deliberately neutral (no filtering applied) — this is the screen's actual
// applied-filter state before the user has ever pressed "Show Results" on
// the Filter sheet, so search results aren't silently narrowed (e.g. by a
// "near current location" radius from a placeholder point, see
// src/utils/loungeSearch.ts) before the user has done anything. The Filter
// sheet's OWN opening draft (see FilterBottomSheet.tsx) still defaults to
// nearCurrentLocation/"Open Now" pre-checked, matching the design — that's
// just a suggested starting point in the UI, not something pre-applied here.
const defaultSearchFilters: SearchFilters = {
  distanceMiles: defaultDistanceMiles,
  nearCurrentLocation: false,
  cityQuery: '',
  availability: [],
  atmosphere: [],
  amenities: [],
  entertainment: [],
};

/** Fits a region around every result's real coordinates, falling back to
 * the app's default region (see mockMap.ts) when there's nothing to plot. */
function regionForResults(results: Lounge[]): Region {
  if (results.length === 0) {
    return defaultRegion;
  }
  const lats = results.map(r => r.coordinates.lat);
  const lngs = results.map(r => r.coordinates.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLng + maxLng) / 2,
    latitudeDelta: Math.max((maxLat - minLat) * 1.5, 0.05),
    longitudeDelta: Math.max((maxLng - minLng) * 1.5, 0.05),
  };
}

type SearchResultsNavigationProp =
  NativeStackNavigationProp<SearchStackParamList>;
type SearchResultsRouteProp = RouteProp<SearchStackParamList, 'SearchResults'>;

export default function SearchResultsScreen() {
  const navigation = useNavigation<SearchResultsNavigationProp>();
  const route = useRoute<SearchResultsRouteProp>();
  const query = route.params?.query ?? '';

  const [results, setResults] = useState<Lounge[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [selectedChips, setSelectedChips] = useState<string[]>(
    route.params?.initialQuickFilterIds ?? [],
  );
  const [sortVisible, setSortVisible] = useState(false);
  const [pendingSort, setPendingSort] = useState(defaultSortOptionId);
  const [appliedSort, setAppliedSort] = useState(defaultSortOptionId);
  const [filterVisible, setFilterVisible] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState<SearchFilters>({
    ...defaultSearchFilters,
    ...route.params?.initialFilters,
  });
  const [savingResult, setSavingResult] = useState<Lounge | null>(null);

  const userId = auth.currentUser?.uid;
  const { location: currentLocation } = useCurrentLocation();

  const runSearch = useCallback(async () => {
    setError(null);
    setResults(null);
    try {
      const [initialFound, favoritedIds, refreshed] = await Promise.all([
        searchLounges(query),
        userId ? getUserFavoriteIds(userId) : Promise.resolve<string[]>([]),
        // Awaited (not fire-and-forget) so a city no one has searched
        // before still gets a real shot at showing results on the first
        // try, instead of flashing "no lounges found" and quietly
        // repopulating a moment later. refreshCityLounges (see
        // loungeRefreshService.ts) checks its own 30-day per-city cache
        // first, so repeat searches stay fast — this only adds real
        // wait time the first time a city is searched. Only fires for
        // queries that are actually a real city name — see this file's
        // header comment for why lounge/brand-name searches skip it.
        isKnownUsCityName(query) ? refreshCityLounges(query) : Promise.resolve(false),
      ]);
      const found = refreshed ? await searchLounges(query) : initialFound;
      setResults(found);
      setFavoriteIds(new Set(favoritedIds));
      if (userId && query.trim()) {
        // Fire-and-forget — this is for SearchScreen's Recent Searches list
        // and shouldn't block or fail rendering the results themselves.
        recordSearch(userId, query).catch(() => {});
      }
    } catch {
      setError("Couldn't load results. Check your connection and try again.");
    }
  }, [query, userId]);

  useEffect(() => {
    runSearch();
  }, [runSearch]);

  const toggleChip = (id: string) => {
    setSelectedChips(prev =>
      prev.includes(id) ? prev.filter(chipId => chipId !== id) : [...prev, id],
    );
  };

  const openSort = () => {
    setPendingSort(appliedSort);
    setSortVisible(true);
  };

  const applySort = () => {
    setAppliedSort(pendingSort);
    setSortVisible(false);
  };

  // Filter (Filter sheet's SearchFilters + the quick chips row, AND'd
  // together) then sort — see src/utils/loungeSearch.ts and this file's
  // header comment for the exact rules and their approximations.
  const displayResults = useMemo(() => {
    if (!results) {
      return results;
    }
    const filtered = applySearchFilters(
      results,
      appliedFilters,
      currentLocation ?? defaultRegion,
    ).filter(lounge => {
      if (selectedChips.includes('premium') && !isPremiumLounge(lounge)) {
        return false;
      }
      if (selectedChips.includes('open-now') && lounge.status !== 'open') {
        return false;
      }
      return true;
    });
    return sortLounges(filtered, appliedSort, currentLocation ?? defaultRegion);
  }, [results, appliedFilters, selectedChips, appliedSort, currentLocation]);

  const hasActiveFilters =
    selectedChips.length > 0 ||
    JSON.stringify(appliedFilters) !== JSON.stringify(defaultSearchFilters);

  const clearFilters = () => {
    setSelectedChips([]);
    setAppliedFilters(defaultSearchFilters);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ---------------- Header ---------------- */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Pressable
          style={styles.searchBar}
          onPress={() => navigation.navigate('LiveSearchSuggestions')}
        >
          <SearchIcon size={18} color={theme.colors.accentGold} />
          <Text style={styles.searchText} numberOfLines={1}>
            {query}
          </Text>
        </Pressable>
      </View>

      {/* ---------------- Toolbar ---------------- */}
      <View style={styles.toolbar}>
        <Pressable style={styles.toolbarButton} onPress={openSort}>
          <ArrowUpDown size={15} color={theme.colors.white} />
          <Text style={styles.toolbarButtonText}>Sort</Text>
        </Pressable>
        <Pressable
          style={styles.toolbarButton}
          onPress={() => setFilterVisible(true)}
        >
          <SlidersHorizontal size={15} color={theme.colors.white} />
          <Text style={styles.toolbarButtonText}>Filter</Text>
        </Pressable>

        <View style={styles.toggleGroup}>
          <Pressable
            style={[
              styles.toggleOption,
              viewMode === 'list' && styles.toggleOptionActive,
            ]}
            onPress={() => setViewMode('list')}
          >
            <List
              size={14}
              color={
                viewMode === 'list'
                  ? theme.colors.primaryBlack
                  : theme.colors.secondarySilver
              }
            />
            <Text
              style={[
                styles.toggleText,
                viewMode === 'list' && styles.toggleTextActive,
              ]}
            >
              List
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toggleOption,
              viewMode === 'map' && styles.toggleOptionActive,
            ]}
            onPress={() => setViewMode('map')}
          >
            <MapIcon
              size={14}
              color={
                viewMode === 'map'
                  ? theme.colors.primaryBlack
                  : theme.colors.secondarySilver
              }
            />
            <Text
              style={[
                styles.toggleText,
                viewMode === 'map' && styles.toggleTextActive,
              ]}
            >
              Map
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.resultsCount}>
        {displayResults ? `${displayResults.length} lounges found` : ' '}
      </Text>

      {/* ---------------- Quick Filter Chips ---------------- */}
      {/* style={{flexGrow: 0}} is required here — a horizontal ScrollView
          with no explicit style otherwise still stretches to fill the
          remaining *vertical* flex space in this column layout (a common
          RN footgun), which was stealing about half the screen from the
          results list/map below it. */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipRow}
      >
        {quickFilterChips.map(chip => (
          <FilterChip
            key={chip.id}
            label={chip.label}
            selected={selectedChips.includes(chip.id)}
            onPress={() => toggleChip(chip.id)}
          />
        ))}
      </ScrollView>

      {/* ---------------- Results ---------------- */}
      {/* Wrapped in an explicit flex:1 View so MapView (below) can fill it
          with StyleSheet.absoluteFill — same fix MapScreen.tsx uses;
          a native MapView given plain flex:1 directly doesn't reliably
          measure its own height as a flex sibling here (it rendered at a
          collapsed intrinsic size instead of filling the remaining
          screen), so it needs an absolute fill against an already-sized
          parent instead. */}
      <View style={styles.resultsContainer}>
        {viewMode === 'list' ? (
          error ? (
            <View style={styles.stateBox}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable style={styles.retryButton} onPress={runSearch}>
                <Text style={styles.retryButtonText}>Try Again</Text>
              </Pressable>
            </View>
          ) : displayResults === null ? (
            <ScrollView showsVerticalScrollIndicator={false}>
              <SearchLoadingSkeleton />
            </ScrollView>
          ) : displayResults.length === 0 ? (
            <ScrollView contentContainerStyle={styles.emptyContent}>
              <View style={styles.emptyIconWrap}>
                <SearchX size={40} color={theme.colors.secondarySilver} />
              </View>
              <Text style={styles.emptyTitle}>
                {hasActiveFilters
                  ? 'No lounges match your current filters.'
                  : `No lounges matched "${query}".`}
              </Text>
              <Text style={styles.emptyDescription}>
                We couldn't find any spots matching your selection. Try
                adjusting your preferences.
              </Text>

              {hasActiveFilters ? (
                <>
                  <View style={styles.suggestionsBox}>
                    <Text style={styles.suggestionsLabel}>SUGGESTIONS</Text>
                    <View style={styles.suggestionRow}>
                      <View style={styles.suggestionIcon}>
                        <ArrowLeftRight
                          size={16}
                          color={theme.colors.secondarySilver}
                        />
                      </View>
                      <Text style={styles.suggestionText}>
                        Expand search distance
                      </Text>
                    </View>
                    <View style={styles.suggestionRow}>
                      <View style={styles.suggestionIcon}>
                        <SlidersHorizontal
                          size={16}
                          color={theme.colors.secondarySilver}
                        />
                      </View>
                      <Text style={styles.suggestionText}>
                        Remove one or more filters
                      </Text>
                    </View>
                    <View style={styles.suggestionRow}>
                      <View style={styles.suggestionIcon}>
                        <Building2
                          size={16}
                          color={theme.colors.secondarySilver}
                        />
                      </View>
                      <Text style={styles.suggestionText}>
                        Browse nearby cities
                      </Text>
                    </View>
                  </View>

                  <Pressable
                    style={styles.primaryButton}
                    onPress={clearFilters}
                  >
                    <Text style={styles.primaryButtonText}>
                      Clear All Filters
                    </Text>
                  </Pressable>
                </>
              ) : null}

              <Pressable
                style={styles.secondaryButton}
                onPress={() => setViewMode('map')}
              >
                <Text style={styles.secondaryButtonText}>Open Map</Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView
              contentContainerStyle={styles.resultsList}
              showsVerticalScrollIndicator={false}
            >
              {displayResults.map(result => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  userId={userId}
                  favorited={favoriteIds.has(result.id)}
                  onPressDetails={() =>
                    navigation.navigate('LoungeDetail', { loungeId: result.id })
                  }
                  onPressDirections={() => {
                    const { lat, lng } = result.coordinates;
                    const url =
                      Platform.OS === 'ios'
                        ? `https://maps.apple.com/?daddr=${lat},${lng}`
                        : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                    Linking.openURL(url);
                  }}
                  onPressSave={() => setSavingResult(result)}
                />
              ))}
            </ScrollView>
          )
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={runSearch}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </Pressable>
          </View>
        ) : displayResults === null ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <SearchLoadingSkeleton />
          </ScrollView>
        ) : Platform.OS === 'android' ? (
          // TODO(android-maps): same gap as MapScreen.tsx — no Google Maps
          // API key set up on Android yet. SimplifiedMapView plots the same
          // real results and navigates to LoungeDetail on tap, matching the
          // real MapView's Marker onCalloutPress below. See MapScreen.tsx's
          // comment for the full context.
          <SimplifiedMapView
            lounges={displayResults}
            onPressLounge={lounge =>
              navigation.navigate('LoungeDetail', { loungeId: lounge.id })
            }
          />
        ) : (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            userInterfaceStyle="dark"
            region={regionForResults(displayResults)}
          >
            {displayResults.map(result => (
              <Marker
                key={result.id}
                coordinate={{
                  latitude: result.coordinates.lat,
                  longitude: result.coordinates.lng,
                }}
                title={result.name}
                description={result.address}
                onCalloutPress={() =>
                  navigation.navigate('LoungeDetail', { loungeId: result.id })
                }
              />
            ))}
          </MapView>
        )}
      </View>

      <SortBottomSheet
        visible={sortVisible}
        selectedId={pendingSort}
        onSelect={setPendingSort}
        onApply={applySort}
        onClose={() => setSortVisible(false)}
      />
      <FilterBottomSheet
        visible={filterVisible}
        results={results ?? []}
        initialFilters={appliedFilters}
        onApply={setAppliedFilters}
        onClose={() => setFilterVisible(false)}
        currentLocation={currentLocation ?? undefined}
        userId={userId}
      />
      {savingResult ? (
        <AddToCollectionSheet
          visible={!!savingResult}
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

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 48,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.2),
  },
  searchText: {
    ...theme.typography.body,
    flex: 1,
    fontSize: 16,
    color: theme.colors.white,
  },

  // ---- Toolbar ----
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 36,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.25),
  },
  toolbarButtonText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.white,
  },
  toggleGroup: {
    flexDirection: 'row',
    marginLeft: 'auto',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    padding: 3,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: theme.spacing.sm,
    borderRadius: theme.radius.small,
  },
  toggleOptionActive: {
    backgroundColor: theme.colors.white,
  },
  toggleText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.secondarySilver,
  },
  toggleTextActive: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryBlack,
  },

  // ---- Results count + chips ----
  resultsCount: {
    ...theme.typography.caption,
    color: theme.colors.mutedGray,
    paddingHorizontal: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  chipScroll: {
    flexGrow: 0,
  },
  chipRow: {
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },

  // ---- Results list ----
  resultsList: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.lg,
  },

  // ---- Results (list or map) ----
  resultsContainer: {
    flex: 1,
  },
  // ---- Loading / error / empty state ----
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

  // ---- Empty filter state ----
  emptyContent: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.sm,
  },
  emptyTitle: {
    ...theme.typography.headingLarge,
    fontSize: 20,
    textAlign: 'center',
    color: theme.colors.white,
  },
  emptyDescription: {
    ...theme.typography.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: theme.colors.mutedGray,
    marginBottom: theme.spacing.md,
  },
  suggestionsBox: {
    width: '100%',
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.2),
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  suggestionsLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    letterSpacing: 0.5,
    color: theme.colors.mutedGray,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  suggestionIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.12),
  },
  suggestionText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.white,
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
    color: theme.colors.primaryBlack,
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.3),
  },
  secondaryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.secondarySilver,
  },
});
