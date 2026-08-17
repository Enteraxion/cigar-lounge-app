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

import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { theme } from '../theme';
import SectionHeader from '../components/SectionHeader';
import { conciergeUser, curatedExperiences, luxuryExperience, tonightEvent } from '../data/mockConcierge';

export default function ConciergeInspirationScreen() {
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
          <View style={styles.grid}>
            {curatedExperiences.map(experience => (
              <Pressable
                key={experience.id}
                style={styles.gridCard}
                onPress={() => Alert.alert('Coming Soon', 'Experience details are coming soon.')}
              >
                <Image source={{ uri: experience.image }} style={styles.gridImage} />
                <View style={styles.gridOverlay} />
                <View style={styles.gridTextGroup}>
                  <Text style={styles.gridTitle} numberOfLines={2}>
                    {experience.title}
                  </Text>
                  <Text style={styles.gridSubtitle} numberOfLines={1}>
                    {experience.subtitle}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {/* ---------------- Events Tonight ---------------- */}
        <View style={styles.field}>
          <SectionHeader
            title="Events Tonight"
            actionLabel="View All"
            onActionPress={() => Alert.alert('Coming Soon', 'More events are coming soon.')}
          />
          <View style={styles.eventRow}>
            <View style={styles.eventDateBox}>
              <Text style={styles.eventDateLabel}>{tonightEvent.dayLabel}</Text>
              <Text style={styles.eventDateNumber}>{tonightEvent.day}</Text>
            </View>
            <View style={styles.eventTextGroup}>
              <Text style={styles.eventTitle} numberOfLines={2}>
                {tonightEvent.title}
              </Text>
              <Text style={styles.eventSubtitle}>{tonightEvent.subtitle}</Text>
            </View>
            <Pressable
              style={styles.eventJoinButton}
              onPress={() => Alert.alert('Coming Soon', 'Event RSVPs are coming soon.')}
              hitSlop={8}
            >
              <Plus size={16} color={theme.colors.primaryNavy} />
            </Pressable>
          </View>
        </View>

        {/* ---------------- Luxury Experiences ---------------- */}
        <View style={[styles.field, styles.lastField]}>
          <SectionHeader title="Luxury Experiences" />
          <View style={styles.luxuryCard}>
            <Image source={{ uri: luxuryExperience.image }} style={styles.luxuryImage} />
            <View style={styles.luxuryTextGroup}>
              <View style={styles.luxuryBadge}>
                <Text style={styles.luxuryBadgeText}>{luxuryExperience.badge}</Text>
              </View>
              <Text style={styles.luxuryTitle} numberOfLines={2}>
                {luxuryExperience.title}
              </Text>
              <Pressable
                style={styles.luxuryButton}
                onPress={() => Alert.alert('Coming Soon', 'This experience is not bookable yet.')}
              >
                <Text style={styles.luxuryButtonText}>{luxuryExperience.ctaLabel}</Text>
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
