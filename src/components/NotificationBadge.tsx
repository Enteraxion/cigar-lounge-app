/**
 * NotificationBadge
 *
 * Small unread-count indicator overlaid on the bell icon across every
 * screen that has one (Home, Favorites, Collections, Wishlist, Passport,
 * Concierge Home) — each screen supplies `count` from
 * src/hooks/useUnreadNotificationCount.ts. Renders nothing when there's
 * nothing unread, so it's safe to always mount.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

export default function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) {
    return null;
  }

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{count > 9 ? '9+' : count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.background,
  },
  badgeText: {
    ...theme.typography.caption,
    fontSize: 9,
    lineHeight: 11,
    letterSpacing: 0,
    color: theme.colors.white,
  },
});
