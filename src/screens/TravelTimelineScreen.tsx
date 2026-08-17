/**
 * TravelTimelineScreen
 *
 * Matches design-reference/Travel Timeline & Achievements.pdf (top half):
 * header, then chronologically grouped visit entries.
 *
 * Real, built from the member's own visit history — see
 * src/utils/passport.ts for why a review counts as a visit (its
 * `visitDate` is a first-hand, user-picked date). This replaced a fixed
 * list of invented trips to lounges in Rome and Mayfair that every member
 * saw identically.
 *
 * The per-entry tags are the two facts actually derivable from a visit:
 * distance from the member's home city, and the rating they gave. The
 * mock's "14°C" and "Business Trip" tags are gone — there's no weather
 * data anywhere in this app and no concept of a visit type, so neither
 * could ever have been real.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, MapPin, Navigation, Star } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { auth } from '../services/firebaseAuth';
import { getPassport } from '../services/passportService';
import { groupVisitsByRecency, type TimelineGroup, type Visit } from '../utils/passport';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import type { MainTabParamList } from '../navigation/MainNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type TravelTimelineNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

function VisitCard({ visit, onPress }: { visit: Visit; onPress: () => void }) {
  const showBanner = !visit.reviewText && visit.photos.length === 1;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.cardName} numberOfLines={1}>
        {visit.loungeName}
      </Text>

      <View style={styles.cardLocationRow}>
        <MapPin size={12} color={theme.colors.mutedGray} />
        <Text style={styles.cardLocation} numberOfLines={1}>
          {visit.city ?? visit.address}
        </Text>
      </View>

      <View style={styles.tagRow}>
        {visit.distanceFromHomeMiles !== null ? (
          <View style={styles.tag}>
            <Navigation size={11} color={theme.colors.secondarySilver} />
            <Text style={styles.tagText}>
              {Math.round(visit.distanceFromHomeMiles).toLocaleString()} mi
            </Text>
          </View>
        ) : null}
        <View style={styles.tag}>
          <Star size={11} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
          <Text style={styles.tagText}>{visit.rating.toFixed(1)}</Text>
        </View>
      </View>

      {visit.reviewText ? (
        <Text style={styles.quote} numberOfLines={3}>
          “{visit.reviewText}”
        </Text>
      ) : null}

      {showBanner ? (
        <Image source={{ uri: visit.photos[0] }} style={styles.bannerPhoto} />
      ) : visit.photos.length > 0 ? (
        <View style={styles.photoRow}>
          {visit.photos.slice(0, 3).map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.photoThumb} />
          ))}
          {visit.photos.length > 3 ? (
            <View style={styles.photoOverflow}>
              <Text style={styles.photoOverflowText}>+{visit.photos.length - 3}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TravelTimelineScreen() {
  const navigation = useNavigation<TravelTimelineNavigationProp>();
  const tabNavigation = useNavigation<NavigationProp<MainTabParamList>>();
  const userId = auth.currentUser?.uid;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [groups, setGroups] = useState<TimelineGroup[]>([]);

  const load = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    getPassport(userId)
      .then(({ passport }) => setGroups(groupVisitsByRecency(passport.visits)))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const openLounge = (loungeId: string) => {
    (tabNavigation.navigate as (name: string, params?: object) => void)('Search', {
      screen: 'LoungeDetail',
      params: { loungeId },
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
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerCaption}>Chronicle</Text>
          <Text style={styles.headerTitle}>Travel Timeline</Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateText}>Couldn't load your timeline.</Text>
          <Pressable onPress={load} hitSlop={8}>
            <Text style={styles.retryText}>Try Again</Text>
          </Pressable>
        </View>
      ) : groups.length === 0 ? (
        <View style={styles.stateBox}>
          <MapPin size={28} color={theme.colors.mutedGray} />
          <Text style={styles.stateText}>Your timeline is empty.</Text>
          <Text style={styles.stateHint}>
            Review a lounge you've visited and it will appear here.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {groups.map(group => (
            <View key={group.id} style={styles.group}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              <View style={styles.groupEntries}>
                {group.visits.map((visit, index) => (
                  <VisitCard
                    key={`${visit.loungeId}-${visit.visitedAt.getTime()}-${index}`}
                    visit={visit}
                    onPress={() => openLounge(visit.loungeId)}
                  />
                ))}
              </View>
            </View>
          ))}
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

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.md,
  },
  headerTitleGroup: {
    flex: 1,
    marginLeft: theme.spacing.md,
  },
  headerCaption: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  headerTitle: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 20,
    color: theme.colors.white,
    marginTop: 2,
  },

  // ---- States ----
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  stateText: {
    ...theme.typography.medium,
    fontSize: 15,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
  },
  stateHint: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  retryText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.accentGold,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.xl,
  },

  // ---- Groups ----
  group: {
    gap: theme.spacing.md,
  },
  groupLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.mutedGray,
  },
  groupEntries: {
    gap: theme.spacing.md,
  },

  // ---- Card ----
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  cardName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  cardLocation: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.background,
  },
  tagText: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.secondarySilver,
  },
  quote: {
    ...theme.typography.medium,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    color: theme.colors.secondarySilver,
    paddingLeft: theme.spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.accentGold,
  },
  photoRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  photoThumb: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  photoOverflow: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverflowText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  bannerPhoto: {
    width: '100%',
    height: 150,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
});
