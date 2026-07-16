/**
 * ReviewSubmittedScreen
 *
 * Matches the bottom half of design-reference/Photo Upload & Review
 * Submitted.pdf: a full-screen takeover shown after submitting a review —
 * checkmark hero image, XP/badge stat cards, and actions back into the
 * app. No header or tab bar; the bottom tab bar is explicitly hidden
 * while this screen is focused since it's a modal-style moment, not a
 * regular tab destination.
 */

import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { ArrowRight, Award, Check } from 'lucide-react-native';
import { theme } from '../theme';
import { loungeInteriors } from '../data/mockImages';
import type { SearchStackParamList } from '../navigation/SearchNavigator';

type ReviewSubmittedNavigationProp = NativeStackNavigationProp<SearchStackParamList>;
type ReviewSubmittedRouteProp = RouteProp<SearchStackParamList, 'ReviewSubmitted'>;

export default function ReviewSubmittedScreen() {
  const navigation = useNavigation<ReviewSubmittedNavigationProp>();
  const route = useRoute<ReviewSubmittedRouteProp>();
  const loungeId = route.params?.loungeId;

  useEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => parent?.setOptions({ tabBarStyle: undefined });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: loungeInteriors[0] }} style={styles.heroImage} />
          <View style={styles.checkBadge}>
            <Check size={32} color={theme.colors.primaryNavy} strokeWidth={3} />
          </View>
        </View>

        <Text style={styles.title}>Review Submitted</Text>
        <Text style={styles.subtitle}>
          Thank you for helping the cigar community. Your insight makes finding the perfect
          smoke easier for everyone.
        </Text>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>+150</Text>
            <Text style={styles.statLabel}>XP Earned</Text>
          </View>
          <View style={styles.statCard}>
            <Award size={18} color={theme.colors.accentGold} />
            <Text style={styles.statValueSmall}>Aficionado</Text>
            <Text style={styles.statLabel}>Badge Level Up</Text>
          </View>
        </View>
      </View>

      <View style={styles.footer}>
        {loungeId ? (
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('LoungeDetail', { loungeId })}
          >
            <Text style={styles.primaryButtonText}>Return to Lounge</Text>
            <ArrowRight size={18} color={theme.colors.primaryNavy} />
          </Pressable>
        ) : null}
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('SearchResults')}
        >
          <Text style={styles.secondaryButtonText}>Browse Nearby Lounges</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    gap: theme.spacing.lg,
  },

  // ---- Hero ----
  heroWrap: {
    width: 180,
    height: 180,
    borderRadius: theme.radius.hero,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.deep,
  },
  heroImage: {
    ...StyleSheet.absoluteFill,
  },
  checkBadge: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadows.soft,
  },

  // ---- Copy ----
  title: {
    ...theme.typography.headingLarge,
    color: theme.colors.white,
    textAlign: 'center',
  },
  subtitle: {
    ...theme.typography.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: theme.colors.mutedGray,
    paddingHorizontal: theme.spacing.md,
  },

  // ---- Stats ----
  statRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    width: '100%',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  statValue: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 22,
    color: theme.colors.accentGold,
  },
  statValueSmall: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  statLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },

  // ---- Footer ----
  footer: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  primaryButton: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
  },
  primaryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
  },
  secondaryButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  secondaryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.secondarySilver,
  },
});
