/**
 * HoursCard
 *
 * Replaces LoungeDetailScreen's old single-line hours text with a real
 * per-day breakdown (matches how Google/Apple Maps show hours) whenever
 * structured hours are available — see src/utils/parseHours.ts. Falls
 * back to the old plain-text row for lounges without structured hours
 * (the "Hours not yet available" placeholder, or free-text seed data).
 * Collapsed by default, showing just today; tapping expands the full week.
 */

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import { parseWeeklyHours, rotateToToday } from '../utils/parseHours';

type Props = {
  hours: string;
  status: 'open' | 'closed';
};

export default function HoursCard({ hours, status }: Props) {
  const [expanded, setExpanded] = useState(false);
  const parsed = parseWeeklyHours(hours);

  if (!parsed) {
    return (
      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.iconBox}>
            <Clock size={16} color={theme.colors.accentGold} />
          </View>
          <View style={styles.fallbackTextGroup}>
            <Text style={styles.statusLabel}>{status === 'open' ? 'Open' : 'Closed'}</Text>
            <Text style={styles.fallbackText}>{hours}</Text>
          </View>
        </View>
      </View>
    );
  }

  const [today, ...rest] = rotateToToday(parsed);

  return (
    <View style={styles.card}>
      <Pressable style={styles.row} onPress={() => setExpanded(value => !value)} hitSlop={4}>
        <View style={styles.iconBox}>
          <Clock size={16} color={theme.colors.accentGold} />
        </View>
        <Text style={[styles.dayText, styles.todayText]}>{today.day}</Text>
        <Text style={[styles.timeText, styles.todayText]}>{today.time}</Text>
        {expanded ? (
          <ChevronUp size={18} color={theme.colors.mutedGray} />
        ) : (
          <ChevronDown size={18} color={theme.colors.mutedGray} />
        )}
      </Pressable>

      {expanded &&
        rest.map(row => (
          <View key={row.day} style={styles.subRow}>
            <View style={styles.iconSpacer} />
            <Text style={styles.dayText}>{row.day}</Text>
            <Text style={styles.timeText}>{row.time}</Text>
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surface,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  subRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: theme.radius.small,
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSpacer: {
    width: 32,
  },
  dayText: {
    ...theme.typography.body,
    flex: 1,
    fontSize: 14,
    color: theme.colors.mutedGray,
  },
  timeText: {
    ...theme.typography.body,
    fontSize: 14,
    color: theme.colors.mutedGray,
  },
  todayText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.white,
  },
  fallbackTextGroup: {
    flex: 1,
    gap: 2,
  },
  statusLabel: {
    ...theme.typography.caption,
    fontSize: 10,
    color: theme.colors.accentGold,
  },
  fallbackText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
});
