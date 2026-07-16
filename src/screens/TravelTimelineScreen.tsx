/**
 * TravelTimelineScreen
 *
 * Matches design-reference/Travel Timeline & Achievements.pdf (top
 * half): header, chronologically grouped visit entries — a rich card
 * (favorite badge, tags, quote, photo thumbnails) for recent visits, and
 * a compact row for older ones. Reached via "View Timeline" on
 * PassportScreen. Mock data only (see src/data/mockPassport.ts) — no
 * backend wired up yet.
 */

import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Calendar, ChevronLeft, MapPin, Navigation, Thermometer, UserCheck } from 'lucide-react-native';
import { theme } from '../theme';
import { timelineGroups, type TimelineEntry } from '../data/mockPassport';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';

type TravelTimelineNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const showBanner = !entry.quote && entry.photos?.length === 1;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardName} numberOfLines={1}>
          {entry.loungeName}
        </Text>
        {entry.favorite ? (
          <View style={styles.favoriteBadge}>
            <Text style={styles.favoriteBadgeText}>Favorite</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.cardLocationRow}>
        <MapPin size={12} color={theme.colors.mutedGray} />
        <Text style={styles.cardLocation}>{entry.location}</Text>
      </View>

      {entry.distance || entry.temperature || entry.visitType ? (
        <View style={styles.tagRow}>
          {entry.distance ? (
            <View style={styles.tag}>
              <Navigation size={11} color={theme.colors.secondarySilver} />
              <Text style={styles.tagText}>{entry.distance}</Text>
            </View>
          ) : null}
          {entry.temperature ? (
            <View style={styles.tag}>
              <Thermometer size={11} color={theme.colors.secondarySilver} />
              <Text style={styles.tagText}>{entry.temperature}</Text>
            </View>
          ) : null}
          {entry.visitType ? (
            <View style={styles.tag}>
              <UserCheck size={11} color={theme.colors.secondarySilver} />
              <Text style={styles.tagText}>{entry.visitType}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {entry.quote ? <Text style={styles.quote}>{entry.quote}</Text> : null}

      {showBanner && entry.photos ? (
        <Image source={{ uri: entry.photos[0] }} style={styles.bannerPhoto} />
      ) : entry.photos && entry.photos.length > 0 ? (
        <View style={styles.photoRow}>
          {entry.photos.map((uri, index) => (
            <Image key={index} source={{ uri }} style={styles.photoThumb} />
          ))}
          {entry.overflowCount ? (
            <View style={styles.photoOverflow}>
              <Text style={styles.photoOverflowText}>+{entry.overflowCount}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function TimelineCompactRow({ entry }: { entry: TimelineEntry }) {
  return (
    <View style={styles.compactRow}>
      {entry.photos?.[0] ? (
        <Image source={{ uri: entry.photos[0] }} style={styles.compactThumb} />
      ) : null}
      <View style={styles.compactTextGroup}>
        <Text style={styles.compactName} numberOfLines={1}>
          {entry.loungeName}
        </Text>
        <Text style={styles.compactLocation} numberOfLines={1}>
          {entry.location}
        </Text>
        <Text style={styles.compactMeta}>{entry.compactMeta}</Text>
      </View>
    </View>
  );
}

export default function TravelTimelineScreen() {
  const navigation = useNavigation<TravelTimelineNavigationProp>();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerCaption}>Chronicle</Text>
          <Text style={styles.headerTitle}>Travel Timeline</Text>
        </View>
        <Pressable
          style={styles.calendarButton}
          hitSlop={8}
          onPress={() => Alert.alert('Coming Soon', 'Calendar view is coming soon.')}
        >
          <Calendar size={18} color={theme.colors.secondarySilver} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {timelineGroups.map(group => (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            <View style={styles.groupEntries}>
              {group.entries.map(entry =>
                entry.compact ? (
                  <TimelineCompactRow key={entry.id} entry={entry} />
                ) : (
                  <TimelineCard key={entry.id} entry={entry} />
                ),
              )}
            </View>
          </View>
        ))}
      </ScrollView>
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
    justifyContent: 'space-between',
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
  calendarButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
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
    backgroundColor: theme.colors.surfaceNavy,
    gap: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cardName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
    flex: 1,
  },
  favoriteBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
  },
  favoriteBadgeText: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.primaryNavy,
  },
  cardLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardLocation: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- Tags ----
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tagText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.secondarySilver,
  },

  // ---- Quote ----
  quote: {
    ...theme.typography.medium,
    fontSize: 13,
    lineHeight: 19,
    fontStyle: 'italic',
    color: theme.colors.secondarySilver,
  },

  // ---- Photos ----
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
    backgroundColor: 'rgba(192, 192, 192, 0.12)',
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
    aspectRatio: 16 / 9,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },

  // ---- Compact row ----
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  compactThumb: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
  },
  compactTextGroup: {
    flex: 1,
    gap: 2,
  },
  compactName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  compactLocation: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },
  compactMeta: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.secondarySilver,
  },
});
