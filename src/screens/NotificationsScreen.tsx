/**
 * NotificationsScreen
 *
 * Real in-app notification center — a root-level modal (see AppNavigator,
 * same pattern as VoiceSearch/AIConcierge) reached from the bell icon on
 * every screen that has one (Home, Favorites, Collections, Wishlist,
 * Passport, Concierge Home). Push notifications (arriving while the app
 * is closed) are explicitly out of scope — this only surfaces what's
 * already sitting in Firestore under users/{userId}/notifications via
 * src/services/userActionsService.ts's getUserNotifications().
 *
 * Two real triggers currently write notifications here (see
 * userActionsService.ts): toggleReviewHelpful (someone marked your
 * review helpful) and submitReview (someone reviewed a lounge you
 * favorited). Tapping a notification marks it read and, when it carries
 * a loungeId, deep-links to that lounge via the same cross-stack
 * escape-hatch navigation pattern used throughout the app (see
 * FavoritesScreen's openLounge).
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, type NavigationProp } from '@react-navigation/native';
import { Bell, ChevronLeft } from 'lucide-react-native';
import { theme } from '../theme';
import { auth } from '../services/firebaseAuth';
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/userActionsService';
import type { NotificationDocument } from '../types/firestore';
import type { MainTabParamList } from '../navigation/MainNavigator';

/** Short relative timestamp ("Just now" / "5m ago" / "3h ago" / "2d ago" / a date once it's old) — no date library, this is the only place in the app that needs one so far. */
function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: NotificationDocument;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {!notification.read ? <View style={styles.unreadDot} /> : <View style={styles.unreadDotSpacer} />}
      <View style={styles.rowTextGroup}>
        <Text style={[styles.rowTitle, !notification.read && styles.rowTitleUnread]} numberOfLines={2}>
          {notification.title}
        </Text>
        <Text style={styles.rowBody} numberOfLines={3}>
          {notification.body}
        </Text>
        <Text style={styles.rowTimestamp}>{formatRelativeTime(notification.createdAt.toDate())}</Text>
      </View>
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const navigation = useNavigation<NavigationProp<MainTabParamList>>();
  const userId = auth.currentUser?.uid;

  const [notifications, setNotifications] = useState<NotificationDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      return;
    }
    setError(null);
    setNotifications(null);
    try {
      setNotifications(await getUserNotifications(userId));
    } catch {
      setError("Couldn't load your notifications. Check your connection and try again.");
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const openNotification = async (notification: NotificationDocument) => {
    if (!userId) return;

    if (!notification.read) {
      setNotifications(prev =>
        prev ? prev.map(n => (n.id === notification.id ? { ...n, read: true } : n)) : prev,
      );
      try {
        await markNotificationRead(userId, notification.id);
      } catch {
        // Best-effort — the local read state already reflects the tap.
      }
    }

    const loungeId = notification.data?.loungeId;
    if (loungeId) {
      // Cross-tab navigation into the Search stack's LoungeDetail screen —
      // same escape-hatch pattern as FavoritesScreen/TravelWishlistScreen's
      // openLounge, bubbling up from this root-level modal.
      (navigation.navigate as (name: string, params?: object) => void)('Search', {
        screen: 'LoungeDetail',
        params: { loungeId },
      });
    }
  };

  const markAllRead = async () => {
    if (!userId || !notifications?.some(n => !n.read)) return;
    setNotifications(prev => (prev ? prev.map(n => ({ ...n, read: true })) : prev));
    try {
      await markAllNotificationsRead(userId);
    } catch {
      // Best-effort — a refetch on next focus will reconcile either way.
    }
  };

  const hasUnread = notifications?.some(n => !n.read) ?? false;

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable
          onPress={markAllRead}
          hitSlop={8}
          disabled={!hasUnread}
          style={[styles.markAllButton, !hasUnread && styles.markAllButtonDisabled]}
        >
          <Text style={[styles.markAllText, !hasUnread && styles.markAllTextDisabled]}>
            Mark all read
          </Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.stateBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={load}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </Pressable>
        </View>
      ) : notifications === null ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.secondarySilver} />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.stateBox}>
          <View style={styles.emptyIconWrap}>
            <Bell size={28} color={theme.colors.mutedGray} />
          </View>
          <Text style={styles.emptyTitle}>No Notifications Yet</Text>
          <Text style={styles.emptyDescription}>
            You&apos;ll see updates here when someone finds your review helpful, or reviews a
            lounge you&apos;ve favorited.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          <View style={styles.list}>
            {notifications.map(notification => (
              <NotificationRow
                key={notification.id}
                notification={notification}
                onPress={() => openNotification(notification)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  headerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.white,
  },
  markAllButton: {
    paddingHorizontal: theme.spacing.sm,
    height: 32,
    borderRadius: theme.radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllButtonDisabled: {
    opacity: 0.4,
  },
  markAllText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 12,
    color: theme.colors.accentGold,
  },
  markAllTextDisabled: {
    color: theme.colors.mutedGray,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  list: {
    gap: theme.spacing.sm,
  },

  row: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    ...theme.shadows.soft,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
    marginTop: 6,
  },
  unreadDotSpacer: {
    width: 8,
    height: 8,
    marginTop: 6,
  },
  rowTextGroup: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.secondarySilver,
  },
  rowTitleUnread: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.white,
  },
  rowBody: {
    ...theme.typography.medium,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.mutedGray,
  },
  rowTimestamp: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
    marginTop: 2,
  },

  // ---- Loading / error / empty state ----
  stateBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
  },
  errorText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: theme.spacing.lg,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  emptyTitle: {
    ...theme.typography.headingSmall,
    fontSize: 18,
    color: theme.colors.white,
  },
  emptyDescription: {
    ...theme.typography.medium,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: theme.colors.mutedGray,
    paddingHorizontal: theme.spacing.md,
  },
});
