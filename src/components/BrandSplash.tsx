/**
 * The branded hold shown while the session and verification reads resolve.
 *
 * Rohith, 2026-08-19: make it linger, and make it good. Both halves matter and
 * they pull against each other, so the reasoning is worth keeping.
 *
 * **Why it lingers at all.** Apple's guidance is that a launch experience should
 * be as brief as possible, and normally I would agree — a splash you notice is
 * usually a slow app. The exception is a brand this deliberate: the icon is a
 * gold-ringed badge, and going from that straight into a login form throws away
 * the one moment the app has to feel like a members' club rather than a
 * directory. AppNavigator holds this for a **minimum**, not a fixed delay: if the
 * auth reads take longer than the floor, nothing extra is added, so this can only
 * ever cost the difference.
 *
 * **Why no spinner.** A spinner says "waiting". The animation says "arriving" —
 * the logo settles in rather than sitting there, which reads as intent instead of
 * latency. If the reads genuinely stall, a spinner would not make them faster; it
 * would just tell the member the app is struggling.
 *
 * The gradient is the same two-layer treatment LoginScreen uses — gold glow over
 * black — so the splash resolves *into* the next screen instead of cutting to a
 * different-looking one.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { theme, withAlpha } from '../theme';

export default function BrandSplash() {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.92)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const ruleWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      // The logo settles rather than pops: scaling up from just under full size
      // with an ease-out reads as the badge coming to rest.
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 640,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      // Staggered, so the eye lands on the mark first and the words second.
      Animated.parallel([
        Animated.timing(taglineOpacity, {
          toValue: 1,
          duration: 420,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ruleWidth, {
          toValue: 1,
          duration: 520,
          easing: Easing.out(Easing.cubic),
          // Width cannot run on the native driver, so this one stays on the JS
          // thread. It is a single hairline, which is cheap enough that the
          // alternative — animating scaleX on a fixed-width view — is not worth
          // the extra layer.
          useNativeDriver: false,
        }),
      ]),
    ]).start();
  }, [logoOpacity, logoScale, taglineOpacity, ruleWidth]);

  return (
    <View style={styles.screen}>
      {/* Same two layers as LoginScreen, in the same order: a warm gold glow at
          the top, then black over it. Flat black gives the badge nothing to sit
          on — this is what reads as lit. */}
      <LinearGradient
        colors={[theme.gold.glow, withAlpha(theme.colors.accentGold, 0.04), theme.colors.background]}
        locations={[0, 0.35, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          withAlpha(theme.colors.background, 0.2),
          withAlpha(theme.colors.background, 0.75),
          theme.colors.background,
        ]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.centre}>
        <Animated.Image
          source={require('../../assets/images/lounge-locator-logo.png')}
          style={[styles.logo, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
          resizeMode="contain"
          accessibilityRole="image"
          accessibilityLabel="Lounge Locator"
        />

        <Animated.View style={[styles.rule, { opacity: taglineOpacity }]}>
          <Animated.View
            style={[
              styles.ruleLine,
              { width: ruleWidth.interpolate({ inputRange: [0, 1], outputRange: [0, 132] }) },
            ]}
          />
        </Animated.View>

        {/* The logo already carries the wordmark, so repeating "Lounge Locator"
            here would be saying it twice. The tagline is the line that is not on
            the badge. */}
        <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
          Cigar Lounge Society
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.primaryBlack },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md },
  logo: { width: 156, height: 156 },
  rule: { height: 1, alignItems: 'center' },
  ruleLine: { height: 1, backgroundColor: theme.gold.lineStrong },
  tagline: {
    fontFamily: theme.fontFamily.medium,
    fontSize: 12,
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: theme.colors.accentGold,
    textAlign: 'center',
  },
});

/**
 * How long the splash is held at minimum, in milliseconds.
 *
 * 1600ms is long enough for the staggered animation above to finish and be seen,
 * and short enough that it never becomes the thing standing between a member and
 * the app. Exported so AppNavigator and this file cannot drift — a floor shorter
 * than the animation would cut it off mid-way, which looks like a bug rather than
 * a brief splash.
 */
export const SPLASH_MINIMUM_MS = 1600;
