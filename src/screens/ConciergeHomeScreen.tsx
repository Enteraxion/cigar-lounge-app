/**
 * ConciergeHomeScreen
 *
 * Matches design-reference/Concierge Home & Conversation View.pdf (top
 * half): header with greeting, a large conversational search input,
 * quick-suggestion chips, a "Suggested for You" rail with an AI reasoning
 * line per card, and a "Trending Nearby" rail. Submitting a query (via
 * the search input or a suggestion chip) opens the conversation thread
 * with that query as the first message. Mock data only (see
 * src/data/mockConcierge.ts) — no real AI wired up yet.
 */

import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Bell, ChevronRight, Compass, History, Map, Search, Star, X } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import SectionHeader from '../components/SectionHeader';
import NotificationBadge from '../components/NotificationBadge';
import {
  conciergeUser,
  quickSuggestions,
  suggestedForYou,
  trendingNearby,
  type ConciergeLounge,
} from '../data/mockConcierge';
import { useLoungeNameLookup } from '../hooks/useLoungeNameLookup';
import { useUnreadNotificationCount } from '../hooks/useUnreadNotificationCount';
import type { ConciergeStackParamList } from '../navigation/ConciergeNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';

type ConciergeNavigationProp = NativeStackNavigationProp<ConciergeStackParamList>;

function LoungeRailCard({ lounge, onPress }: { lounge: ConciergeLounge; onPress: () => void }) {
  return (
    <Pressable style={styles.railCard} onPress={onPress}>
      {lounge.reasoning ? (
        <View style={styles.reasoningPill}>
          <Text style={styles.reasoningText} numberOfLines={2}>
            {lounge.reasoning}
          </Text>
        </View>
      ) : null}
      <Image source={{ uri: lounge.image }} style={styles.railImage} />
      <View style={styles.railBody}>
        <View style={styles.railNameRow}>
          <Text style={styles.railName} numberOfLines={1}>
            {lounge.name}
          </Text>
          <Text style={styles.railDistance}>{lounge.distance}</Text>
        </View>
        <Text style={styles.railLocation} numberOfLines={1}>
          {lounge.location}
        </Text>
      </View>
    </Pressable>
  );
}

export default function ConciergeHomeScreen() {
  const navigation = useNavigation<ConciergeNavigationProp>();
  const [query, setQuery] = useState('');
  const { findRealLoungeId } = useLoungeNameLookup();
  const { count: unreadNotificationCount } = useUnreadNotificationCount();

  const askConcierge = (text: string) => {
    if (!text.trim()) {
      return;
    }
    navigation.navigate('ConciergeConversation', { initialQuery: text.trim() });
  };

  // Concierge recommendation *content* is still mock (from
  // mockConcierge.ts) — the AI Concierge is out of scope for real backend
  // wiring in this pass. The mock card's own `id` is never a real
  // Firestore lounge id, so rather than navigate straight to a "not
  // found" LoungeDetail, best-effort match the card's name against real
  // lounges (see useLoungeNameLookup) and only navigate when it resolves.
  const openLoungeDetails = (lounge: ConciergeLounge) => {
    const realLoungeId = findRealLoungeId(lounge.name);
    if (!realLoungeId) {
      Alert.alert('Not Available', "This lounge isn't in our directory yet.");
      return;
    }
    (navigation.navigate as (name: string, params?: object) => void)('Main', {
      screen: 'Search',
      params: { screen: 'LoungeDetail', params: { loungeId: realLoungeId } },
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView {...keyboardAwareScrollProps} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          {/* This screen is the root of the AIConcierge modal stack (see
              AppNavigator), which renders above the tab bar — so without an
              explicit close the only way out is iOS's swipe-down gesture,
              which doesn't exist on Android. */}
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={8}>
            <X size={18} color={theme.colors.secondarySilver} />
          </Pressable>
          <Image source={{ uri: conciergeUser.avatarUri }} style={styles.avatar} />
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerCaption}>AI Concierge</Text>
            <Text style={styles.headerGreeting} numberOfLines={1}>
              Good Evening, Julian
            </Text>
          </View>
          <Pressable
            style={styles.headerButton}
            onPress={() => navigation.navigate('SavedConversations')}
            hitSlop={8}
          >
            <History size={18} color={theme.colors.secondarySilver} />
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={() => navigation.navigate('ConciergeInspiration')}
            hitSlop={8}
          >
            <Compass size={18} color={theme.colors.secondarySilver} />
          </Pressable>
          <Pressable
            style={styles.headerButton}
            onPress={() =>
              (navigation.navigate as (name: string, params?: object) => void)('Notifications')
            }
            hitSlop={8}
          >
            <Bell size={18} color={theme.colors.secondarySilver} />
            <NotificationBadge count={unreadNotificationCount} />
          </Pressable>
        </View>

        <Text style={styles.prompt}>How can I help you discover your next great lounge?</Text>

        {/* ---------------- Search input ---------------- */}
        <View style={styles.searchBar}>
          <Search size={18} color={theme.colors.mutedGray} />
          <TextInput
        accessibilityLabel="Ask anything about cigar lounges..."
            style={styles.searchInput}
            placeholder="Ask anything about cigar lounges..."
            placeholderTextColor={theme.colors.mutedGray}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => askConcierge(query)}
            returnKeyType="search"
          />
        </View>

        {/* ---------------- Quick suggestions ---------------- */}
        <View style={styles.chipWrap}>
          {quickSuggestions.map(suggestion => (
            <Pressable
              key={suggestion.id}
              style={styles.chip}
              onPress={() => askConcierge(suggestion.label)}
            >
              <Text style={styles.chipText}>{suggestion.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* ---------------- Plan a Trip ---------------- */}
        <Pressable style={styles.tripCard} onPress={() => navigation.navigate('TripPlanner')}>
          <View style={styles.tripIconBox}>
            <Map size={20} color={theme.colors.accentGold} />
          </View>
          <View style={styles.tripTextGroup}>
            <Text style={styles.tripTitle}>Plan a Trip</Text>
            <Text style={styles.tripSubtitle}>Multi-stop routes with lounge stops along the way</Text>
          </View>
          <ChevronRight size={18} color={theme.colors.secondarySilver} />
        </Pressable>

        {/* ---------------- Suggested for You ---------------- */}
        <View style={styles.field}>
          <SectionHeader
            title="Suggested for You"
            actionLabel="View All"
            onActionPress={() => navigation.navigate('ConciergeResults')}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {suggestedForYou.map(lounge => (
              <LoungeRailCard key={lounge.id} lounge={lounge} onPress={() => openLoungeDetails(lounge)} />
            ))}
          </ScrollView>
        </View>

        {/* ---------------- Trending Nearby ---------------- */}
        <View style={[styles.field, styles.lastField]}>
          <SectionHeader title="Trending Nearby" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            {trendingNearby.map(lounge => (
              <Pressable key={lounge.id} style={styles.trendingCard} onPress={() => openLoungeDetails(lounge)}>
                <Image source={{ uri: lounge.image }} style={styles.trendingImage} />
                <View style={styles.trendingRatingRow}>
                  <Star size={11} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
                  <Text style={styles.trendingRatingText}>{lounge.rating}</Text>
                </View>
                <Text style={styles.trendingName} numberOfLines={1}>
                  {lounge.name}
                </Text>
                <Text style={styles.trendingLocation} numberOfLines={1}>
                  {lounge.location}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
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
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.xl,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  headerCaption: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.accentGold,
  },
  headerGreeting: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 16,
    color: theme.colors.white,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  prompt: {
    ...theme.typography.headingSmall,
    fontSize: 22,
    lineHeight: 29,
    color: theme.colors.white,
    marginTop: theme.spacing.md,
  },

  // ---- Search bar ----
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    height: 52,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.md,
  },
  searchInput: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.white,
    flex: 1,
    padding: 0,
  },

  // ---- Quick suggestions ----
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  chipText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },

  // ---- Plan a Trip ----
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.soft,
  },
  tripIconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripTextGroup: {
    flex: 1,
    gap: 2,
  },
  tripTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
  },
  tripSubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Fields ----
  field: {
    gap: 0,
  },
  lastField: {
    marginBottom: theme.spacing.lg,
  },
  rail: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },

  // ---- Suggested for You card ----
  railCard: {
    width: 220,
  },
  reasoningPill: {
    padding: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
    marginBottom: theme.spacing.sm,
  },
  reasoningText: {
    ...theme.typography.medium,
    fontSize: 11,
    fontStyle: 'italic',
    color: theme.colors.accentGold,
  },
  railImage: {
    width: '100%',
    aspectRatio: 16 / 10,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
  },
  railBody: {
    marginTop: theme.spacing.sm,
    gap: 2,
  },
  railNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  railName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
    flex: 1,
  },
  railDistance: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  railLocation: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Trending card ----
  trendingCard: {
    width: 160,
    gap: 2,
  },
  trendingImage: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
    marginBottom: theme.spacing.xs,
  },
  trendingRatingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  trendingRatingText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.white,
  },
  trendingName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  trendingLocation: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
});
