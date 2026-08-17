/**
 * SectionHeader
 *
 * Reused above every horizontal/vertical list section on Home and other
 * browse screens: a title (+ optional subtitle) on the left and an
 * optional "View All" action on the right.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
};

export default function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onActionPress,
}: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.textGroup}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel ? (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  textGroup: {
    gap: theme.spacing.xs / 2,
  },
  title: {
    ...theme.typography.headingSmall,
    fontFamily: theme.fontFamily.bold,
    fontSize: 20,
    color: theme.colors.white,
  },
  subtitle: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.mutedGray,
  },
  action: {
    ...theme.typography.caption,
    color: theme.colors.accentGold,
  },
});
