/**
 * ProgressRatingBar
 *
 * Label + numeric score with a filled gold progress bar underneath,
 * scaled against a 5.0 max. Used in "The Verdict" on Lounge Detail, and
 * will be reused on the Ratings Breakdown screen.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  label: string;
  score: number;
  maxScore?: number;
};

export default function ProgressRatingBar({ label, score, maxScore = 5 }: Props) {
  const percent = Math.max(0, Math.min(1, score / maxScore)) * 100;

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.score}>{score.toFixed(1)}</Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${percent}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  label: {
    ...theme.typography.caption,
    fontSize: 11,
    color: theme.colors.secondarySilver,
  },
  score: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },
  track: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
    overflow: 'hidden',
  },
  fill: {
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
  },
});
