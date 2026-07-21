/**
 * SearchSuggestionsScreen
 *
 * Matches design-reference/Live Search Suggestions Screen.pdf: shown when
 * the member taps the search bar on Search Home. A live-filtering list —
 * as the query changes, Recently Visited / Cities / Lounges / Cigar Brands
 * each filter down to substring matches, with the matched portion of each
 * result styled in accentGold. Icon + text only, no imagery, per design.
 *
 * Recently Visited, Cities, and Lounges are real data
 * (userActionsService.getRecentlyViewedLounges, loungeService.getDistinctCities,
 * loungeService.getTopRatedLounges — all fetched once on mount). Recently
 * Visited caps at 5 here with a "View All" row to RecentlyViewedScreen if
 * there are more. Cigar Brands is still curated mock data
 * (src/data/mockSuggestions.ts) — no backing "top brands" query exists yet.
 * The whole list is scrollable (ScrollView), since real data can run
 * longer than the original mock-data-sized screen ever needed to handle.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  ChevronRight,
  Cigarette,
  ExternalLink,
  History,
  MapPin,
  Search as SearchIcon,
  Sofa,
  X,
} from 'lucide-react-native';
import { theme } from '../theme';
import { cigarBrandSuggestions, type CigarBrandSuggestion, type RecentlyVisited } from '../data/mockSuggestions';
import {
  getDistinctCities,
  getTopRatedLounges,
  type CitySuggestion,
  type Lounge,
} from '../services/loungeService';
import { getRecentlyViewedLounges } from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

const RECENT_VISIBLE_LIMIT = 5;

type SuggestionsNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

type TextSegment = { text: string; matched: boolean };

function splitMatch(text: string, query: string): TextSegment[] {
  if (!query.trim()) {
    return [{ text, matched: false }];
  }
  const index = text.toLowerCase().indexOf(query.trim().toLowerCase());
  if (index === -1) {
    return [{ text, matched: false }];
  }
  return [
    { text: text.slice(0, index), matched: false },
    { text: text.slice(index, index + query.trim().length), matched: true },
    { text: text.slice(index + query.trim().length), matched: false },
  ].filter(segment => segment.text.length > 0);
}

function HighlightedText({ text, query, style }: { text: string; query: string; style: object }) {
  return (
    <Text style={style} numberOfLines={1}>
      {splitMatch(text, query).map((segment, index) => (
        <Text key={index} style={segment.matched ? styles.matchedText : undefined}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
}

function matches(name: string, query: string) {
  return !query.trim() || name.toLowerCase().includes(query.trim().toLowerCase());
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

function SuggestionRow({
  icon,
  name,
  subtitle,
  subtitleStyle,
  query,
  right,
  onPress,
}: {
  icon: React.ReactNode;
  name: string;
  subtitle?: string;
  subtitleStyle?: object;
  query: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowIcon}>{icon}</View>
      <View style={styles.rowDetails}>
        <HighlightedText text={name} query={query} style={styles.rowTitle} />
        {subtitle ? (
          <Text style={[styles.rowSubtitle, subtitleStyle]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </Pressable>
  );
}

function BrandAvatar({ item }: { item: CigarBrandSuggestion }) {
  if (!item.showAvatar) {
    return null;
  }
  return (
    <View style={styles.brandAvatar}>
      <Text style={styles.brandAvatarText}>{item.initials}</Text>
    </View>
  );
}

export default function SearchSuggestionsScreen() {
  const navigation = useNavigation<SuggestionsNavigationProp>();
  const [query, setQuery] = useState('');
  const [recentlyVisited, setRecentlyVisited] = useState<RecentlyVisited[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [topLounges, setTopLounges] = useState<Lounge[]>([]);

  useEffect(() => {
    getDistinctCities()
      .then(setCitySuggestions)
      .catch(() => {});

    getTopRatedLounges()
      .then(setTopLounges)
      .catch(() => {});

    const userId = auth.currentUser?.uid;
    if (!userId) {
      return;
    }
    getRecentlyViewedLounges(userId, 20)
      .then(lounges =>
        setRecentlyVisited(
          lounges.map(lounge => ({ id: lounge.id, name: lounge.name, subtitle: lounge.address })),
        ),
      )
      .catch(() => {});
  }, []);

  const goToResults = (name: string) => {
    navigation.navigate('SearchResults', { query: name });
  };

  const filteredRecent = useMemo(
    () => recentlyVisited.filter(item => matches(item.name, query)),
    [query, recentlyVisited],
  );
  const filteredCities = useMemo(
    () => citySuggestions.filter(item => matches(item.name, query)),
    [query, citySuggestions],
  );
  const filteredLounges = useMemo(
    () => topLounges.filter(item => matches(item.name, query)),
    [query, topLounges],
  );
  const filteredBrands = useMemo(
    () => cigarBrandSuggestions.filter(item => matches(item.name, query)),
    [query],
  );

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      {/* ---------------- Header ---------------- */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <View style={styles.searchBar}>
          <SearchIcon size={18} color={theme.colors.accentGold} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Lounges, cities, or brands..."
            placeholderTextColor={theme.colors.mutedGray}
            style={styles.searchInput}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => query.trim() && goToResults(query)}
          />
          {query.length > 0 ? (
            <Pressable style={styles.clearButton} onPress={() => setQuery('')} hitSlop={8}>
              <X size={14} color={theme.colors.white} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentInner}>
        {/* ---------------- Search this query ---------------- */}
        {/* Always available, regardless of whether the query matches the
            small local suggestion lists below — those are mock/curated
            (see src/data/mockSuggestions.ts) and won't cover every real
            Firestore lounge, so this is the fallback that guarantees any
            typed text can actually run a real searchLounges() query. */}
        {query.trim().length > 0 ? (
          <SuggestionRow
            icon={<SearchIcon size={16} color={theme.colors.accentGold} />}
            name={`Search for "${query.trim()}"`}
            query=""
            onPress={() => goToResults(query)}
          />
        ) : null}

        {/* ---------------- Recently Visited ---------------- */}
        {filteredRecent.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>Recently Visited</SectionLabel>
            {filteredRecent.slice(0, RECENT_VISIBLE_LIMIT).map(item => (
              <SuggestionRow
                key={item.id}
                icon={<History size={16} color={theme.colors.secondarySilver} />}
                name={item.name}
                subtitle={item.subtitle}
                query={query}
                right={<ExternalLink size={16} color={theme.colors.mutedGray} />}
                onPress={() => navigation.navigate('LoungeDetail', { loungeId: item.id })}
              />
            ))}
            {filteredRecent.length > RECENT_VISIBLE_LIMIT ? (
              <SuggestionRow
                icon={<History size={16} color={theme.colors.accentGold} />}
                name="View All Recently Viewed"
                query=""
                right={<ChevronRight size={16} color={theme.colors.mutedGray} />}
                onPress={() => navigation.navigate('RecentlyViewed')}
              />
            ) : null}
          </View>
        ) : null}

        {/* ---------------- Cities ---------------- */}
        {filteredCities.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>Cities</SectionLabel>
            {filteredCities.map(item => (
              <SuggestionRow
                key={item.id}
                icon={<MapPin size={16} color={theme.colors.secondarySilver} />}
                name={item.name}
                query={query}
                onPress={() => goToResults(item.name)}
              />
            ))}
          </View>
        ) : null}

        {/* ---------------- Lounges ---------------- */}
        {filteredLounges.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>Lounges</SectionLabel>
            {filteredLounges.map(item => (
              <SuggestionRow
                key={item.id}
                icon={<Sofa size={16} color={theme.colors.secondarySilver} />}
                name={item.name}
                subtitle={item.address}
                query={query}
                onPress={() => navigation.navigate('LoungeDetail', { loungeId: item.id })}
              />
            ))}
          </View>
        ) : null}

        {/* ---------------- Cigar Brands ---------------- */}
        {filteredBrands.length > 0 ? (
          <View style={styles.section}>
            <SectionLabel>Cigar Brands</SectionLabel>
            {filteredBrands.map(item => (
              <SuggestionRow
                key={item.id}
                icon={<Cigarette size={16} color={theme.colors.secondarySilver} />}
                name={item.name}
                subtitle={item.subtitle}
                subtitleStyle={
                  item.subtitleVariant === 'gold' ? styles.subtitleGold : undefined
                }
                query={query}
                right={<BrandAvatar item={item} />}
                onPress={() => goToResults(item.name)}
              />
            ))}
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
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.2)',
  },
  searchInput: {
    ...theme.typography.body,
    flex: 1,
    fontSize: 16,
    color: theme.colors.white,
    padding: 0,
  },
  clearButton: {
    width: 22,
    height: 22,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    flex: 1,
  },
  contentInner: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 140,
    gap: theme.spacing.lg,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionLabel: {
    ...theme.typography.caption,
    color: theme.colors.mutedGray,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowDetails: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  matchedText: {
    color: theme.colors.accentGold,
  },
  rowSubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  subtitleGold: {
    color: theme.colors.accentGold,
  },

  brandAvatar: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandAvatarText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 13,
    color: theme.colors.primaryNavy,
  },
});
