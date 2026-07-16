/**
 * BadgeTile
 *
 * Icon-box + label for a single achievement badge — unlocked badges get a
 * gold-tinted icon box, locked ones a muted/grayed one. Originally built
 * for AchievementsScreen, now also reused on ProfileScreen's Achievements
 * preview row.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Award,
  Box,
  Car,
  Compass,
  Crown,
  Globe,
  Map,
  MessageCircle,
  Mountain,
  Plane,
  Send,
  Ship,
  Users,
} from 'lucide-react-native';
import { theme } from '../theme';
import type { Badge } from '../data/mockPassport';

export const BADGE_ICON: Record<Badge['icon'], React.ComponentType<{ size?: number; color?: string }>> = {
  compass: Compass,
  map: Map,
  globe: Globe,
  users: Users,
  messageCircle: MessageCircle,
  crown: Crown,
  plane: Plane,
  car: Car,
  ship: Ship,
  mountain: Mountain,
  send: Send,
  award: Award,
  box: Box,
};

export default function BadgeTile({ badge }: { badge: Badge }) {
  const Icon = BADGE_ICON[badge.icon];

  return (
    <View style={styles.badgeTile}>
      <View style={[styles.badgeIconBox, !badge.unlocked && styles.badgeIconBoxLocked]}>
        <Icon
          size={22}
          color={badge.unlocked ? theme.colors.accentGold : theme.colors.mutedGray}
        />
      </View>
      <Text
        style={[styles.badgeLabel, !badge.unlocked && styles.badgeLabelLocked]}
        numberOfLines={2}
      >
        {badge.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badgeTile: {
    width: 76,
    alignItems: 'center',
    gap: theme.spacing.xs,
    minHeight: 100,
  },
  badgeIconBox: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.large,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeIconBoxLocked: {
    backgroundColor: theme.colors.surfaceNavy,
  },
  badgeLabel: {
    ...theme.typography.medium,
    fontSize: 11,
    textAlign: 'center',
    color: theme.colors.white,
  },
  badgeLabelLocked: {
    color: theme.colors.mutedGray,
  },
});
