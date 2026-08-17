/**
 * ConciergeResultsScreen
 *
 * Matches design-reference/AI Recommendation Results & Inspiration.pdf
 * (top half): sort/filter tabs, an AI insight banner above each result
 * explaining why it matched, and a vertical list of full recommendation
 * cards. Reached from "View All" on the Concierge home's "Suggested for
 * You" section. Mock data only (see src/data/mockConcierge.ts) — no real
 * AI/backend wired up yet.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MapPin, Sparkles, Star } from 'lucide-react-native';
import { theme } from '../theme';
import { resultTabs, type ResultCard, type ResultTabId } from '../data/mockConcierge';
import { getAllLounges, type Lounge } from '../services/loungeService';
import { haversineDistanceMiles, isPremiumLounge } from '../utils/loungeSearch';
import { useCurrentLocation } from '../hooks/useCurrentLocation';
import { useUserProfile } from '../hooks/useUserProfile';
import { findCityCoordinates } from '../utils/cityAutocomplete';
import { loungeImageUri } from '../utils/loungeImage';
import { displayTags } from '../utils/displayTags';
import type { ConciergeStackParamList } from '../navigation/ConciergeNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type ConciergeNavigationProp = NativeStackNavigationProp<ConciergeStackParamList>;

function ResultCardView({ result, onViewDetails }: { result: ResultCard; onViewDetails: () => void }) {
  return (
    <View style={styles.field}>
      <View style={styles.insightBanner}>
        <Sparkles size={13} color={theme.colors.accentGold} />
        <Text style={styles.insightText}>{result.insight}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.imageWrap}>
          <Image source={{ uri: result.image }} style={styles.image} />
          {result.topMatch ? (
            <View style={styles.topMatchBadge}>
              <Text style={styles.topMatchText}>TOP MATCH</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {result.name}
            </Text>
            <Text style={styles.distance}>{result.distance}</Text>
          </View>
          <View style={styles.locationRow}>
            <MapPin size={12} color={theme.colors.mutedGray} />
            <Text style={styles.locationText} numberOfLines={1}>
              {result.location} • {result.tags.join(' • ')}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={styles.ratingRow}>
              {Array.from({ length: 5 }).map((_, index) => (
                <Star
                  key={index}
                  size={13}
                  color={theme.colors.accentGold}
                  fill={index < Math.round(result.rating) ? theme.colors.accentGold : 'transparent'}
                />
              ))}
            </View>
            <Pressable onPress={onViewDetails} hitSlop={8}>
              <Text style={styles.viewDetailsLink}>View Details</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

/**
 * Why a lounge is being shown, in the app's own voice.
 *
 * The mock shipped a hand-written sentence per lounge ("Matches your
 * preference for quiet lounges with strong Wi-Fi"), which read well and was
 * attached to nothing. This states only what the data supports — if all it
 * can say is the rating, it says the rating.
 */
function insightFor(lounge: Lounge, distanceMiles: number | null): string {
  const parts: string[] = [];
  if (lounge.ratings.overall >= 4.5) {
    parts.push(`Rated ${lounge.ratings.overall.toFixed(1)} by ${lounge.reviewCount} members`);
  }
  const tags = displayTags(lounge.tags).slice(0, 2);
  if (tags.length) parts.push(tags.join(' and ').toLowerCase());
  if (distanceMiles !== null && distanceMiles < 5) parts.push('close to you');
  return parts.length ? `${parts.join(' • ')}.` : 'In your area.';
}

export default function ConciergeResultsScreen() {
  const [activeTab, setActiveTab] = useState<ResultTabId>('relevance');
  const { location } = useCurrentLocation();
  const { profile } = useUserProfile();
  const [lounges, setLounges] = useState<Lounge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAllLounges()
      .then(all => {
        if (!cancelled) setLounges(all);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Same fallback chain as Home: real fix, then home city, then nothing —
  // and "nothing" means the distance tab is simply unavailable rather than
  // silently ranking by distance from a coordinate in another country.
  const homeCoordinates = profile?.homeCity ? findCityCoordinates(profile.homeCity) : null;
  const origin =
    location ??
    (homeCoordinates
      ? { latitude: homeCoordinates.lat, longitude: homeCoordinates.lng }
      : null);

  const results: ResultCard[] = useMemo(() => {
    const withDistance = lounges.map(lounge => ({
      lounge,
      distance: origin ? haversineDistanceMiles(origin, lounge.coordinates) : null,
    }));

    const sorted = [...withDistance];
    switch (activeTab) {
      case 'distance':
        sorted.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity));
        break;
      case 'rating':
        sorted.sort((a, b) => b.lounge.ratings.overall - a.lounge.ratings.overall);
        break;
      case 'price':
        sorted.sort(
          (a, b) => a.lounge.priceRange.length - b.lounge.priceRange.length,
        );
        break;
      default:
        // Relevance: well-rated, actually reviewed, and near if we know where
        // "near" is — the closest thing to a ranking this data supports.
        sorted.sort((a, b) => {
          const score = (e: typeof a) =>
            e.lounge.ratings.overall * 2 +
            Math.min(e.lounge.reviewCount, 50) / 25 -
            (e.distance !== null ? Math.min(e.distance, 50) / 25 : 0);
          return score(b) - score(a);
        });
    }

    return sorted.slice(0, 20).map((entry, index) => ({
      id: entry.lounge.id,
      name: entry.lounge.name,
      distance: entry.distance !== null ? `${entry.distance.toFixed(1)} mi` : '',
      rating: entry.lounge.ratings.overall,
      location: entry.lounge.city ?? entry.lounge.address,
      tags: displayTags(entry.lounge.tags).slice(0, 3),
      image: loungeImageUri(entry.lounge),
      insight: insightFor(entry.lounge, entry.distance),
      topMatch: index === 0 && isPremiumLounge(entry.lounge),
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lounges, origin?.latitude, origin?.longitude, activeTab]);

  const navigation = useNavigation<ConciergeNavigationProp>();

  // Concierge recommendation *content* is still mock (from
  // mockConcierge.ts) — the AI Concierge is out of scope for real backend
  // wiring in this pass. The mock card's own `id` is never a real
  // Firestore lounge id, so rather than navigate straight to a "not
  // found" LoungeDetail, best-effort match the card's name against real
  // lounges (see useLoungeNameLookup) and only navigate when it resolves.
  const openLoungeDetails = (result: ResultCard) => {
    // Real Firestore ids now — no name matching needed.
    const realLoungeId = result.id;
    // Cross-boundary navigation from this root-level modal stack into
    // Main's Search tab stack's LoungeDetail screen — see the same
    // pattern/comment in ConciergeConversationScreen.
    (navigation.navigate as (name: string, params?: object) => void)('Main', {
      screen: 'Search',
      params: { screen: 'LoungeDetail', params: { loungeId: realLoungeId } },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerCaption}>AI Analysis</Text>
          <Text style={styles.headerTitle}>Curated Matches</Text>
        </View>
      </View>

      <View style={styles.tabRow}>
        {resultTabs.map(tab => (
          <Pressable
            key={tab.id}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
            onPress={() => setActiveTab(tab.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.id }}
            accessibilityLabel={`Sort by ${tab.label}`}
          >
            <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {loading ? (
          <ActivityIndicator color={theme.colors.secondarySilver} style={styles.stateBox} />
        ) : results.length === 0 ? (
          <Text style={styles.emptyHint}>No lounges to rank yet.</Text>
        ) : (
          results.map(result => (
            <ResultCardView
              key={result.id}
              result={result}
              onViewDetails={() => openLoungeDetails(result)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stateBox: {
    paddingVertical: theme.spacing.xl,
  },
  emptyHint: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    paddingVertical: theme.spacing.xl,
  },
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
  headerTextGroup: {
    gap: 2,
  },
  headerCaption: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  headerTitle: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 20,
    color: theme.colors.white,
    marginTop: 2,
  },

  tabRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  tab: {
    paddingHorizontal: theme.spacing.md,
    height: 34,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  tabActive: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.white,
  },
  tabText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.secondarySilver,
  },
  tabTextActive: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.lg,
  },

  field: {
    gap: theme.spacing.sm,
  },
  insightBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(234, 179, 8, 0.1)',
  },
  insightText: {
    ...theme.typography.medium,
    fontSize: 12,
    lineHeight: 17,
    color: theme.colors.secondarySilver,
    flex: 1,
  },

  card: {
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    overflow: 'hidden',
    ...theme.shadows.soft,
  },
  imageWrap: {
    position: 'relative',
    aspectRatio: 16 / 10,
    backgroundColor: theme.colors.background,
  },
  image: {
    ...StyleSheet.absoluteFill,
  },
  topMatchBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    right: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },
  topMatchText: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.primaryNavy,
  },
  body: {
    padding: theme.spacing.md,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  name: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 17,
    color: theme.colors.white,
    flex: 1,
  },
  distance: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
    flex: 1,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  ratingRow: {
    flexDirection: 'row',
    gap: 2,
  },
  viewDetailsLink: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
    textDecorationLine: 'underline',
  },
});
