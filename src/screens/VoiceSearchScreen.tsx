/**
 * VoiceSearchScreen
 *
 * Matches design-reference/Voice Search Screen.pdf: full-screen modal
 * with a pulsing mic icon, an example prompt, tappable "Try Saying"
 * suggestions, a Cancel / keyboard fallback row, and recent voice
 * searches. Reached from the mic icon on Search and Map.
 *
 * Real speech recognition since 2026-09-13 — src/services/voiceSearchService.ts.
 * Before that the microphone was decorative: this screen said "Listening..."
 * over a pulsing icon and listened to nothing, while the only way to actually
 * search was to tap one of the suggestions below it.
 *
 * Two things the screen is careful about. It never claims to be listening when
 * it is not — the title follows the real state, including the moment before
 * permission is granted. And the suggestions stay: they are a fallback when the
 * microphone is refused or unavailable, and on a simulator they are the only
 * thing that works at all.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import { ChevronRight, Keyboard, Mic } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { recentVoiceSearches, voiceSearchSuggestions } from '../data/mockMap';
import {
  isVoiceAvailable,
  startListening,
  type VoiceStatus,
} from '../services/voiceSearchService';
import type { MainTabParamList } from '../navigation/MainNavigator';

/**
 * How long to wait after the last word before deciding the sentence is over.
 * Every new partial resets it, so this is the length of a real pause rather
 * than a total time limit.
 */
const SILENCE_MS = 1400;

export default function VoiceSearchScreen() {
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();

  const openSuggestion = useCallback((suggestion: string) => {
    // VoiceSearch is a root-level modal (see AppNavigator's
    // RootStackParamList — its only siblings are Auth/Main/AIConcierge/
    // Notifications), so 'Search' isn't a route it can navigate to
    // directly — it has to go through 'Main' first, same pattern as
    // ConciergeConversationScreen's cross-tab navigation.
    (navigation.navigate as (name: string, params?: object) => void)('Main', {
      screen: 'Search',
      params: { screen: 'SearchResults', params: { query: suggestion } },
    });
  }, [navigation]);
  const pulse = useRef(new Animated.Value(0)).current;

  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [heard, setHeard] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => Promise<void>) | null>(null);
  // Guards against a late transcript arriving after the screen has already
  // navigated away, which would push a second SearchResults on top of the first.
  const handledRef = useRef(false);
  /**
   * The best transcript so far, and a timer that decides when the member has
   * finished talking.
   *
   * The first version searched the moment `onSpeechResults` fired — and iOS
   * fires that as soon as it has *a* result, frequently after a single word.
   * "Find lounges near me" searched for "Find" (Rohith, 2026-09-13). Partial
   * and final results both land here instead, and the search runs only once
   * nothing new has arrived for a beat, which is what "stopped talking"
   * actually looks like.
   */
  const transcriptRef = useRef('');
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(
    (text: string) => {
      const query = text.trim();
      if (!query || handledRef.current) {
        return;
      }
      handledRef.current = true;
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
      }
      stopRef.current?.();
      openSuggestion(query);
    },
    [openSuggestion],
  );

  /**
   * Records what was heard and restarts the countdown.
   *
   * Every partial pushes the deadline out, so a member who pauses mid-sentence
   * to think is not cut off — only a real stop ends it. SILENCE_MS is long
   * enough to survive drawing breath and short enough not to feel broken.
   */
  const heardSomething = useCallback(
    (text: string) => {
      transcriptRef.current = text;
      setHeard(text);
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
      }
      silenceTimer.current = setTimeout(() => runSearch(transcriptRef.current), SILENCE_MS);
    },
    [runSearch],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!(await isVoiceAvailable())) {
        if (!cancelled) {
          setStatus('error');
          // The honest wording. This is what a simulator reports, and a member
          // on a device without speech support deserves the same sentence
          // rather than a failure that blames them.
          setError('Voice search is not available on this device. Tap a suggestion instead.');
        }
        return;
      }
      try {
        const stop = await startListening({
          onPartial: text => !cancelled && heardSomething(text),
          // NOT a signal to search. iOS finalises early and often; this is just
          // the best transcript it has so far.
          onResult: text => !cancelled && heardSomething(text),
          onError: message => {
            if (!cancelled) {
              setStatus('error');
              setError(message);
            }
          },
          // iOS stops the session on its own, sometimes after a single word.
          // Search what was heard if there is anything; otherwise say nothing
          // was caught rather than leaving a dead pulsing microphone on screen.
          onEnd: () => {
            if (cancelled || handledRef.current) {
              return;
            }
            if (transcriptRef.current.trim()) {
              runSearch(transcriptRef.current);
            } else {
              setStatus('idle');
            }
          },
        });
        if (cancelled) {
          await stop();
          return;
        }
        stopRef.current = stop;
        setStatus('listening');
      } catch (e) {
        if (!cancelled) {
          setStatus('error');
          setError(e instanceof Error ? e.message : 'Could not start listening.');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
      }
      // Releases the microphone on the way out. Without this the recording
      // session outlives the screen and the next one cannot start.
      stopRef.current?.();
    };
  }, [runSearch, heardSomething]);

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
    // Only while actually listening. A microphone pulsing at somebody whose
    // permission was refused is the version of this screen we just removed.
    if (status === 'listening') {
      loop.start();
    }
    return () => loop.stop();
  }, [pulse, status]);

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

        <Text style={styles.title}>
          {status === 'listening'
            ? 'Listening…'
            : status === 'error'
              ? "Can't listen right now"
              : 'Starting…'}
        </Text>
        <Text style={styles.prompt}>
          {error
            ? error
            : heard
              ? `“${heard}”`
              : '“What cigar lounge are you looking for?”'}
        </Text>

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
    backgroundColor: theme.colors.surface,
    borderWidth: 2,
    borderColor: withAlpha(theme.colors.accentGold, 0.4),
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
    color: theme.colors.accentGold,
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
    backgroundColor: theme.colors.surface,
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
    backgroundColor: theme.colors.surface,
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
    color: theme.colors.accentGold,
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
    borderColor: withAlpha(theme.colors.accentGold, 0.25),
  },
  recentChipText: {
    ...theme.typography.medium,
    fontSize: 12,
    fontStyle: 'italic',
    color: theme.colors.secondarySilver,
  },
});
