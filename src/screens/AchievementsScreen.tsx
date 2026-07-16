/**
 * AchievementsScreen
 *
 * Matches design-reference/Travel Timeline & Achievements.pdf (bottom
 * half): header with overall completion percentage + progress bar, a
 * "Next Recommendation" card, and badge categories (Explorer, Social
 * Member, Traveler) each with unlocked/total counts and a horizontally
 * scrollable row of badge tiles — unlocked badges shown in full color,
 * locked ones faded. Reached via "Achievements" on PassportScreen. Mock
 * data only (see src/data/mockPassport.ts) — no backend wired up yet.
 */

import React from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react-native';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { theme } from '../theme';
import { achievementCategories, achievementsPercent, nextRecommendation } from '../data/mockPassport';
import BadgeTile from '../components/BadgeTile';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';

type AchievementsNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

export default function AchievementsScreen() {
  const navigation = useNavigation<AchievementsNavigationProp>();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Title Row ---------------- */}
        <View style={styles.titleBlock}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.headerCaption}>Milestones</Text>
              <Text style={styles.title}>Achievements</Text>
            </View>
            <View style={styles.percentGroup}>
              <Text style={styles.percentValue}>{achievementsPercent}%</Text>
              <Text style={styles.percentLabel}>Complete</Text>
            </View>
          </View>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${achievementsPercent}%` }]} />
          </View>
        </View>

        {/* ---------------- Next Recommendation ---------------- */}
        <Pressable
          style={styles.recommendationCard}
          onPress={() => Alert.alert('Coming Soon', 'Achievement recommendations are coming soon.')}
        >
          <View style={styles.recommendationIconBox}>
            <Star size={18} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
          </View>
          <Text style={styles.recommendationText}>{nextRecommendation.text}</Text>
          <ChevronRight size={18} color={theme.colors.secondarySilver} />
        </Pressable>

        {/* ---------------- Categories ---------------- */}
        {achievementCategories.map(category => (
          <View key={category.id} style={styles.category}>
            <View style={styles.categoryHeaderRow}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryCount}>
                {category.unlockedCount} / {category.totalCount} Unlocked
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.badgeRow}
            >
              {category.badges.map(badge => (
                <BadgeTile key={badge.id} badge={badge} />
              ))}
            </ScrollView>
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
  header: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
    gap: theme.spacing.xl,
  },

  // ---- Title row ----
  titleBlock: {
    gap: theme.spacing.sm,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  headerCaption: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.white,
    marginTop: 2,
  },
  percentGroup: {
    alignItems: 'flex-end',
  },
  percentValue: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 24,
    color: theme.colors.accentGold,
  },
  percentLabel: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },

  // ---- Progress ----
  progressTrack: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },

  // ---- Recommendation ----
  recommendationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  recommendationIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    lineHeight: 19,
    color: theme.colors.white,
    flex: 1,
  },

  // ---- Categories ----
  category: {
    gap: theme.spacing.md,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryName: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 16,
    color: theme.colors.white,
  },
  categoryCount: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  badgeRow: {
    gap: theme.spacing.md,
    paddingRight: theme.spacing.lg,
  },
});
