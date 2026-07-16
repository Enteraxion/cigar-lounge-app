/**
 * SearchScreen
 *
 * Matches design-reference/Search Home Screen.pdf top to bottom: header +
 * search bar, filter chips, recent searches, popular destinations,
 * trending cities, recently viewed, and a featured travel guide banner.
 * The section labels/imagery (see src/data/mockSearch.ts) are still a
 * curated mock list — there's no "trending"/"recent search history"
 * tracking in Firestore yet — but every row is wired to real data once
 * tapped: Recent Searches/Popular Destinations/Trending Cities each run
 * a real searchLounges() query via SearchResultsScreen, and Recently
 * Viewed Lounges links straight to LoungeDetailScreen by real lounge id.
 * Featured Travel Guide stays non-interactive (no destination-guide
 * content modeled anywhere yet).
 */

import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowRight, History, Mic, Search as SearchIcon } from 'lucide-react-native';
import { theme } from '../theme';
import SectionHeader from '../components/SectionHeader';
import FilterChip from '../components/FilterChip';
import CompactLoungeCard from '../components/CompactLoungeCard';
import type { SearchStackParamList } from '../navigation/SearchNavigator';
import {
  featuredTravelGuide,
  filterChips,
  popularDestinations,
  recentSearches,
  recentlyViewedLounges,
  trendingCities,
} from '../data/mockSearch';

type SearchNavigationProp = NativeStackNavigationProp<SearchStackParamList>;

export default function SearchScreen() {
  const navigation = useNavigation<SearchNavigationProp>();
  const [selectedChip, setSelectedChip] = useState('nearby');

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
              onPress={() => setSelectedChip(item.id)}
            />
          )}
        />

        {/* ---------------- Recent Searches ---------------- */}
        <View style={styles.section}>
          <SectionHeader
            title="Recent Searches"
            actionLabel="Clear All"
            onActionPress={() =>
              Alert.alert(
                'Coming Soon',
                'Search history isn\'t tracked yet, so there\'s nothing to clear.',
              )
            }
          />
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
                  <Text style={styles.recentSubtitle}>{item.subtitle}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ---------------- Popular Destinations ---------------- */}
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
                  colors={['transparent', 'rgba(5, 10, 24, 0.85)']}
                  style={styles.destinationGradient}
                  pointerEvents="none"
                />
                <Text style={styles.destinationName}>{item.city}</Text>
              </Pressable>
            )}
          />
        </View>

        {/* ---------------- Trending Cities ---------------- */}
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

        {/* ---------------- Recently Viewed ---------------- */}
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
                  image={{ uri: item.imageUri }}
                  name={item.name}
                  location={item.location}
                  tags={item.tags}
                  rating={item.rating}
                />
              </Pressable>
            )}
          />
        </View>

        {/* ---------------- Featured Travel Guide ---------------- */}
        <View style={[styles.section, styles.lastSection]}>
          <View style={styles.guideCard}>
            <Image
              source={{ uri: featuredTravelGuide.imageUri }}
              style={styles.guideImage}
              resizeMode="cover"
            />
            <LinearGradient
              colors={['transparent', 'rgba(5, 10, 24, 0.7)', 'rgba(5, 10, 24, 0.95)']}
              locations={[0, 0.5, 1]}
              style={styles.guideGradient}
              pointerEvents="none"
            />
            <View style={styles.guideBody}>
              <Text style={styles.guideLabel}>{featuredTravelGuide.label}</Text>
              <Text style={styles.guideHeadline}>{featuredTravelGuide.headline}</Text>
              <Text style={styles.guideDescription}>{featuredTravelGuide.description}</Text>
              <Pressable
                style={styles.guideButton}
                onPress={() => Alert.alert('Coming Soon', 'Travel guides are not available yet.')}
              >
                <Text style={styles.guideButtonText}>{featuredTravelGuide.ctaLabel}</Text>
                <ArrowRight size={16} color={theme.colors.primaryNavy} />
              </Pressable>
            </View>
          </View>
        </View>
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
    paddingBottom: 140,
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
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.2)',
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
    backgroundColor: theme.colors.surfaceNavy,
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
    backgroundColor: theme.colors.surfaceNavy,
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
    backgroundColor: theme.colors.surfaceNavy,
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
    backgroundColor: theme.colors.surfaceNavy,
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
    backgroundColor: theme.colors.white,
  },
  guideButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },
});
