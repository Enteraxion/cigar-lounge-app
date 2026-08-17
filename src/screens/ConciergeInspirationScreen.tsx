/**
 * ConciergeInspirationScreen
 *
 * Matches design-reference/AI Recommendation Results & Inspiration.pdf
 * (bottom half): a "Curated Experiences" 2x2 image grid, an "Events
 * Tonight" section with a single event row, and a "Luxury Experiences"
 * VIP-badged premium card. Reached from the compass/discover icon on
 * ConciergeHomeScreen. Mock data only (see src/data/mockConcierge.ts) —
 * no real AI/backend wired up yet.
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { theme } from '../theme';
import SectionHeader from '../components/SectionHeader';
import { conciergeUser } from '../data/mockConcierge';
import { getAllLounges, type Lounge } from '../services/loungeService';
import { getUpcomingEventsAcrossLounges, type MemberEvent } from '../services/eventService';
import { isPremiumLounge } from '../utils/loungeSearch';
import { loungeImageUri } from '../utils/loungeImage';
import type { MainTabParamList } from '../navigation/MainNavigator';

/**
 * Curated experiences, built from the directory rather than invented.
 *
 * Each theme is a real query over real lounges — "Perfect for Remote Work"
 * is lounges tagged for wifi/quiet, "Hidden Gems" is well-rated places
 * almost nobody has reviewed. A theme with nothing behind it is dropped
 * rather than shown as an empty promise, so this section shrinks honestly
 * as the data thins instead of offering four cards that lead nowhere.
 */
const EXPERIENCE_THEMES: {
  id: string;
  title: string;
  subtitle: string;
  match: (lounge: Lounge) => boolean;
}[] = [
  {
    id: 'remote-work',
    title: 'Perfect for Remote Work',
    subtitle: 'Quiet • Reliable Wi-Fi',
    match: l => /wi-?fi|quiet|work/i.test([...l.tags, ...l.amenities].join(' ')),
  },
  {
    id: 'whiskey-pairings',
    title: 'Whiskey Pairings',
    subtitle: 'Full bar, rare pours',
    match: l => /whiske?y|bourbon|scotch|full bar|cocktail/i.test([...l.tags, ...l.amenities].join(' ')),
  },
  {
    id: 'hidden-gems',
    title: 'Hidden Gems',
    subtitle: 'Well rated, rarely reviewed',
    match: l => l.ratings.overall >= 4.5 && l.reviewCount > 0 && l.reviewCount <= 15,
  },
  {
    id: 'outdoor',
    title: 'Outdoor & Terrace',
    subtitle: 'Somewhere to sit outside',
    match: l => /patio|outdoor|terrace|rooftop/i.test([...l.tags, ...l.amenities].join(' ')),
  },
];

export default function ConciergeInspirationScreen() {
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const [lounges, setLounges] = useState<Lounge[]>([]);
  const [events, setEvents] = useState<MemberEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getAllLounges().catch(() => []), getUpcomingEventsAcrossLounges(3).catch(() => [])])
      .then(([allLounges, upcoming]) => {
        if (cancelled) return;
        setLounges(allLounges);
        setEvents(upcoming);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Only themes that actually have lounges behind them.
  const experiences = EXPERIENCE_THEMES.map(experienceTheme => {
    const matches = lounges.filter(experienceTheme.match);
    return {
      ...experienceTheme,
      matches,
      image: matches[0] ? loungeImageUri(matches[0]) : null,
    };
  }).filter(entry => entry.matches.length > 0);

  const nextEvent = events[0] ?? null;
  // "VIP exclusive" means the highest-rated premium lounge we actually have.
  const luxury =
    [...lounges].filter(isPremiumLounge).sort((a, b) => b.ratings.overall - a.ratings.overall)[0] ??
    null;

  const openLounge = (loungeId: string) =>
    (tabNavigation.navigate as (n: string, p?: object) => void)('Search', {
      screen: 'LoungeDetail',
      params: { loungeId },
    });


  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Image source={{ uri: conciergeUser.avatarUri }} style={styles.avatar} />
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerCaption}>Discovery</Text>
          <Text style={styles.headerTitle}>Inspiration</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Curated Experiences ---------------- */}
        <View style={styles.field}>
          <SectionHeader title="Curated Experiences" />
          {loading ? (
            <ActivityIndicator color={theme.colors.secondarySilver} />
          ) : experiences.length === 0 ? (
            <Text style={styles.emptyHint}>
              Nothing to feature yet — lounges need tags before themes can be built.
            </Text>
          ) : (
          <View style={styles.grid}>
            {experiences.map(experience => (
              <Pressable
                key={experience.id}
                style={styles.gridCard}
                accessibilityRole="button"
                accessibilityLabel={`${experience.title}, ${experience.matches.length} lounges`}
                // Opens the first lounge in the theme. A dedicated
                // theme-results screen would be better, but it would be a
                // new screen — this uses one that already exists and works.
                onPress={() => openLounge(experience.matches[0].id)}
              >
                <Image
                  source={{ uri: experience.image ?? undefined }}
                  style={styles.gridImage}
                  accessibilityLabel={experience.title}
                />
                <View style={styles.gridOverlay} />
                <View style={styles.gridTextGroup}>
                  <Text style={styles.gridTitle} numberOfLines={2}>
                    {experience.title}
                  </Text>
                  <Text style={styles.gridSubtitle} numberOfLines={1}>
                    {experience.matches.length} {experience.matches.length === 1 ? 'lounge' : 'lounges'} • {experience.subtitle}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
          )}
        </View>

        {/* ---------------- Upcoming Events ---------------- */}
        {/* Real owner-posted events. "Events Tonight" was the old title and
            a lie on any night nobody had posted one — the section now names
            the real next event, or says there isn't one. */}
        <View style={styles.field}>
          <SectionHeader title="Upcoming Events" />
          {nextEvent ? (
            <Pressable
              style={styles.eventRow}
              onPress={() => openLounge(nextEvent.loungeId)}
              accessibilityRole="button"
              accessibilityLabel={`${nextEvent.title}, opens the lounge`}
            >
              <View style={styles.eventDateBox}>
                <Text style={styles.eventDateLabel}>
                  {nextEvent.startsAt.toDate().toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
                </Text>
                <Text style={styles.eventDateNumber}>{nextEvent.startsAt.toDate().getDate()}</Text>
              </View>
              <View style={styles.eventTextGroup}>
                <Text style={styles.eventTitle} numberOfLines={2}>
                  {nextEvent.title}
                </Text>
                <Text style={styles.eventSubtitle}>
                  {nextEvent.startsAt.toDate().toLocaleTimeString(undefined, {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
            </Pressable>
          ) : (
            <Text style={styles.emptyHint}>
              No events posted yet. Lounges announce tastings and cigar nights here.
            </Text>
          )}
        </View>

        {/* ---------------- Luxury Experiences ---------------- */}
        {/* The highest-rated premium lounge we actually have, rather than a
            fictional "Presidential Private Vault" with no booking behind it. */}
        {luxury ? (
          <View style={styles.field}>
            <SectionHeader title="Luxury Experiences" />
            <Pressable
              style={styles.luxuryCard}
              onPress={() => openLounge(luxury.id)}
              accessibilityRole="button"
              accessibilityLabel={`${luxury.name}, premium lounge`}
            >
              <Image
                source={{ uri: loungeImageUri(luxury) }}
                style={styles.luxuryImage}
                accessibilityLabel={luxury.name}
              />
              <View style={styles.luxuryTextGroup}>
                <View style={styles.luxuryBadge}>
                  <Text style={styles.luxuryBadgeText}>PREMIUM</Text>
                </View>
                <Text style={styles.luxuryTitle} numberOfLines={2}>
                  {luxury.name}
                </Text>
                <View style={styles.luxuryButton}>
                  <Text style={styles.luxuryButtonText}>View lounge</Text>
                </View>
              </View>
            </Pressable>
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  emptyHint: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.full,
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

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
    gap: theme.spacing.xl,
  },

  field: {
    gap: theme.spacing.md,
  },
  lastField: {
    marginBottom: theme.spacing.lg,
  },

  // ---- Curated Experiences grid ----
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  gridCard: {
    width: '48.5%',
    aspectRatio: 1,
    borderRadius: theme.radius.large,
    overflow: 'hidden',
    backgroundColor: theme.colors.surfaceNavy,
    justifyContent: 'flex-end',
  },
  gridImage: {
    ...StyleSheet.absoluteFill,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 10, 24, 0.35)',
  },
  gridTextGroup: {
    padding: theme.spacing.sm,
    gap: 2,
  },
  gridTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 14,
    lineHeight: 17,
    color: theme.colors.white,
  },
  gridSubtitle: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.secondarySilver,
  },

  // ---- Events Tonight ----
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  eventDateBox: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDateLabel: {
    ...theme.typography.caption,
    fontSize: 8,
    color: theme.colors.accentGold,
  },
  eventDateNumber: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.white,
  },
  eventTextGroup: {
    flex: 1,
    gap: 2,
  },
  eventTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  eventSubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  eventJoinButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Luxury Experiences ----
  luxuryCard: {
    flexDirection: 'row',
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    overflow: 'hidden',
    ...theme.shadows.soft,
  },
  luxuryImage: {
    width: 110,
    height: 140,
    backgroundColor: theme.colors.background,
  },
  luxuryTextGroup: {
    flex: 1,
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
    justifyContent: 'center',
  },
  luxuryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  luxuryBadgeText: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.accentGold,
  },
  luxuryTitle: {
    ...theme.typography.headingSmall,
    fontSize: 17,
    color: theme.colors.white,
  },
  luxuryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.md,
    height: 36,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  luxuryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 12,
    color: theme.colors.primaryNavy,
  },
});
