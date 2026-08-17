/**
 * VoiceSearchScreen
 *
 * Matches design-reference/Voice Search Screen.pdf: full-screen modal
 * with a pulsing mic icon, an example prompt, tappable "Try Saying"
 * suggestions, a Cancel / keyboard fallback row, and recent voice
 * searches. Reached from the mic icon on Search and Map. Mock data only
 * (see src/data/mockMap.ts) — no real speech recognition wired up yet.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { ChevronRight, Keyboard, Mic } from 'lucide-react-native';
import { theme } from '../theme';
import { recentVoiceSearches, voiceSearchSuggestions } from '../data/mockMap';
import type { MainTabParamList } from '../navigation/MainNavigator';

export default function VoiceSearchScreen() {
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();

  const openSuggestion = (suggestion: string) => {
    // VoiceSearch is a root-level modal (see AppNavigator's
    // RootStackParamList — its only siblings are Auth/Main/AIConcierge/
    // Notifications), so 'Search' isn't a route it can navigate to
    // directly — it has to go through 'Main' first, same pattern as
    // ConciergeConversationScreen's cross-tab navigation.
    (navigation.navigate as (name: string, params?: object) => void)('Main', {
      screen: 'Search',
      params: { screen: 'SearchResults', params: { query: suggestion } },
    });
  };
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.in(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const ringScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <View style={styles.micArea}>
          <Animated.View
            style={[styles.micRing, { transform: [{ scale: ringScale }], opacity: ringOpacity }]}
          />
          <View style={styles.micCircle}>
            <Mic size={36} color={theme.colors.white} />
          </View>
        </View>

        <Text style={styles.title}>Listening...</Text>
        <Text style={styles.prompt}>&quot;What cigar lounge are you looking for?&quot;</Text>

        <View style={styles.suggestionsBlock}>
          <Text style={styles.suggestionsLabel}>Try Saying</Text>
          {voiceSearchSuggestions.map(suggestion => (
            <Pressable
              key={suggestion}
              style={styles.suggestionPill}
              onPress={() => openSuggestion(suggestion)}
            >
              <Text style={styles.suggestionText}>&quot;{suggestion}&quot;</Text>
              <ChevronRight size={16} color={theme.colors.mutedGray} />
            </Pressable>
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.keyboardButton} onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={8}>
            <Keyboard size={18} color={theme.colors.white} />
          </Pressable>
        </View>
      </View>

      <View style={styles.recentBlock}>
        <Text style={styles.recentLabel}>Recent Voice Searches</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentRow}>
          {recentVoiceSearches.map(term => (
            <View key={term} style={styles.recentChip}>
              <Mic size={12} color={theme.colors.mutedGray} />
              <Text style={styles.recentChipText}>&quot;{term}&quot;</Text>
            </View>
          ))}
        </ScrollView>
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
    paddingTop: theme.spacing.xxl,
    paddingHorizontal: theme.spacing.lg,
  },
  micArea: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
  },
  micRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: theme.colors.secondarySilver,
  },
  micCircle: {
    width: 100,
    height: 100,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.headingLarge,
    fontSize: 28,
    color: theme.colors.white,
  },
  prompt: {
    ...theme.typography.medium,
    fontSize: 15,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },

  suggestionsBlock: {
    width: '100%',
    gap: theme.spacing.sm,
  },
  suggestionsLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 52,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
  },
  suggestionText: {
    ...theme.typography.medium,
    fontSize: 14,
    fontStyle: 'italic',
    color: theme.colors.white,
  },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
    marginTop: theme.spacing.xl,
  },
  cancelText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.mutedGray,
  },
  keyboardButton: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  recentBlock: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.lg,
    gap: theme.spacing.sm,
  },
  recentLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.mutedGray,
  },
  recentRow: {
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.lg,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingHorizontal: theme.spacing.md,
    height: 36,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  recentChipText: {
    ...theme.typography.medium,
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.colors.secondarySilver,
  },
});
