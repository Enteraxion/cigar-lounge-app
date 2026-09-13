/**
 * IdReviewProgress
 *
 * What a member watches while their ID is being read.
 *
 * Until 2026-09-13 this moment had no screen at all: the submit button sat at
 * "Sending 100%" for the four seconds the model takes, and then an alert
 * appeared. Four seconds of nothing is long enough to wonder whether the app has
 * frozen, and it is the single most anxious moment in the product — somebody has
 * just handed over a photograph of their driving licence.
 *
 * **The animation is the document being read**, not a spinner. A frame at the
 * real proportions of the card they just photographed (ID-1, 85.6 x 54), with a
 * gold line sweeping down it. It is the same shape as the capture frames on the
 * previous screen, so the two read as one continuous act rather than a form
 * followed by a wait.
 *
 * **The status lines are true.** Each one names something the server actually
 * does — see functions/src/idReview.ts, which reads the document, then checks
 * legibility, the date of birth, the expiry and the age in that order. Inventing
 * plausible-sounding steps would be easy and would make the wait feel longer the
 * first time somebody noticed a claim that could not be happening.
 */

import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Check, ScanLine } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';

/** ID-1, the same proportions as the capture frames a moment earlier. */
const CARD_ASPECT = 85.6 / 54;
const CARD_WIDTH = 250;
const CARD_HEIGHT = CARD_WIDTH / CARD_ASPECT;

/**
 * Each names a real step. Ordered as the server performs them, and paced a
 * little slower than the sweep so the two do not tick in lockstep.
 */
const STEPS = [
  'Reading your document…',
  'Finding the date of birth…',
  'Checking it is still in date…',
  'Almost there…',
];

type Props = {
  /** Switches to the confirmed state. The caller holds it there for a beat. */
  done?: boolean;
};

export default function IdReviewProgress({ done = false }: Props) {
  const sweep = useRef(new Animated.Value(0)).current;
  const tick = useRef(new Animated.Value(0)).current;
  const [step, setStep] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    // A sweeping line is exactly the kind of movement reduced-motion exists to
    // suppress, and the screen still works as a still frame with a caption.
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => setReduceMotion(false));
  }, []);

  useEffect(() => {
    if (done || reduceMotion) {
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(sweep, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [sweep, done, reduceMotion]);

  useEffect(() => {
    if (done) {
      return;
    }
    const interval = setInterval(() => setStep(s => (s + 1) % STEPS.length), 1400);
    return () => clearInterval(interval);
  }, [done]);

  useEffect(() => {
    if (!done) {
      return;
    }
    Animated.spring(tick, {
      toValue: 1,
      useNativeDriver: true,
      friction: 5,
      tension: 90,
    }).start();
  }, [done, tick]);

  const translateY = sweep.interpolate({
    inputRange: [0, 1],
    // Inset so the line never sits exactly on the frame's edge, where it would
    // read as part of the border rather than something moving across it.
    outputRange: [8, CARD_HEIGHT - 8],
  });

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={[styles.corner, styles.cornerTopLeft]} />
        <View style={[styles.corner, styles.cornerTopRight]} />
        <View style={[styles.corner, styles.cornerBottomLeft]} />
        <View style={[styles.corner, styles.cornerBottomRight]} />

        {done ? (
          <Animated.View style={[styles.tickWrap, { transform: [{ scale: tick }] }]}>
            <Check size={40} color={theme.colors.accentGold} strokeWidth={2.5} />
          </Animated.View>
        ) : (
          <>
            <View style={styles.cardIcon}>
              <ScanLine size={26} color={withAlpha(theme.colors.secondarySilver, 0.35)} />
            </View>
            {!reduceMotion ? (
              <Animated.View style={[styles.scanLine, { transform: [{ translateY }] }]} />
            ) : null}
          </>
        )}
      </View>

      <Text style={styles.title}>
        {done ? 'Identity verified' : 'Checking your ID'}
      </Text>
      <Text style={styles.status}>
        {done
          ? 'Your identity has been successfully verified. Taking you in…'
          : STEPS[step]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.background,
  },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.gold.line,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  cardIcon: { opacity: 0.8 },
  /** The sweep. Brightest at its centre so it reads as a beam, not a rule. */
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: theme.colors.accentGold,
    shadowColor: theme.colors.accentGold,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  tickWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.gold.wash,
    borderWidth: 1,
    borderColor: theme.gold.line,
  },
  corner: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderColor: theme.colors.accentGold,
  },
  cornerTopLeft: { top: 8, left: 8, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 4 },
  cornerTopRight: {
    top: 8,
    right: 8,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderTopRightRadius: 4,
  },
  cornerBottomLeft: {
    bottom: 8,
    left: 8,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderBottomLeftRadius: 4,
  },
  cornerBottomRight: {
    bottom: 8,
    right: 8,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 4,
  },
  title: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 19,
    color: theme.colors.white,
  },
  status: {
    ...theme.typography.body,
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
});
