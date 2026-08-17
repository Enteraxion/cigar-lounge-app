/**
 * SavedConversationsScreen
 *
 * Matches design-reference/Trip Planner & Saved Conversations.pdf
 * (bottom half): header with a "new conversation" action, and a vertical
 * list of past conversation cards — the most recent one is star-badged
 * with a "Continue" button, older ones get a "View" button. Reached via
 * the history/archive icon on ConciergeHomeScreen (and Trip Planner's
 * header). Mock data only (see src/data/mockTripPlanner.ts) — no real
 * conversation persistence wired up yet.
 */

import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Pencil, Plus, Star, Trash2 } from 'lucide-react-native';
import { theme } from '../theme';
import { conciergeUser } from '../data/mockConcierge';
import { auth } from '../services/firebaseAuth';
import {
  deleteConversation,
  getSavedConversations,
  renameConversation,
  type SavedConversation,
} from '../services/conciergeMemoryService';
import type { ConciergeStackParamList } from '../navigation/ConciergeNavigator';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type ConciergeNavigationProp = NativeStackNavigationProp<ConciergeStackParamList>;

function ConversationCard({
  conversation,
  isMostRecent,
  onOpen,
  onRename,
  onDelete,
}: {
  conversation: SavedConversation;
  isMostRecent: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleRow}>
          {isMostRecent ? (
            <Star size={13} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
          ) : null}
          <Text style={styles.cardTitle} numberOfLines={1}>
            {conversation.title}
          </Text>
        </View>
        <Text style={styles.cardTimestamp}>
          {relativeTime(conversation.updatedAt?.toDate?.()).toUpperCase()}
        </Text>
      </View>

      <Text style={styles.cardSummary} numberOfLines={2}>
        {conversation.summary || 'No reply yet.'}
      </Text>

      <View style={styles.cardFooterRow}>
        <View style={styles.cardIconRow}>
          <Pressable
            onPress={onRename}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Rename ${conversation.title}`}
          >
            <Pencil size={15} color={theme.colors.mutedGray} />
          </Pressable>
          <Pressable
            onPress={onDelete}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${conversation.title}`}
          >
            <Trash2 size={15} color={theme.colors.mutedGray} />
          </Pressable>
        </View>
        <Pressable
          style={isMostRecent ? styles.continueButton : styles.viewButton}
          onPress={onOpen}
          accessibilityRole="button"
        >
          <Text style={isMostRecent ? styles.continueButtonText : styles.viewButtonText}>
            {isMostRecent ? 'Continue' : 'View'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * "2h ago" / "Oct 22" — the mock stored these as literal strings, which is
 * why every member saw the same ages forever. Derived from the real
 * updatedAt instead.
 */
function relativeTime(date: Date | undefined): string {
  if (!date) return 'just now';
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function SavedConversationsScreen() {
  const userId = auth.currentUser?.uid;
  const [conversations, setConversations] = useState<SavedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    getSavedConversations(userId)
      .then(setConversations)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [userId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const onRename = (conversation: SavedConversation) => {
    if (!userId) return;
    Alert.prompt?.(
      'Rename conversation',
      undefined,
      async title => {
        if (!title?.trim()) return;
        // Optimistic: the list is the member's own data and a failed rename
        // is recoverable, so waiting on the round trip just feels broken.
        setConversations(prev =>
          prev.map(c => (c.id === conversation.id ? { ...c, title: title.trim() } : c)),
        );
        try {
          await renameConversation(userId, conversation.id, title);
        } catch {
          load();
        }
      },
      'plain-text',
      conversation.title,
    );
  };

  const onDelete = (conversation: SavedConversation) => {
    if (!userId) return;
    Alert.alert('Delete conversation', `Delete "${conversation.title}"? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setConversations(prev => prev.filter(c => c.id !== conversation.id));
          try {
            await deleteConversation(userId, conversation.id);
          } catch {
            load();
          }
        },
      },
    ]);
  };

  const navigation = useNavigation<ConciergeNavigationProp>();

  const openConversation = (conversationId?: string) => {
    navigation.navigate('ConciergeConversation', conversationId ? { conversationId } : undefined);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <ChevronLeft size={24} color={theme.colors.white} />
        </Pressable>
        <Image source={{ uri: conciergeUser.avatarUri }} style={styles.avatar} />
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerCaption}>Archive</Text>
          <Text style={styles.headerTitle}>History</Text>
        </View>
        <Pressable style={styles.newButton} onPress={() => openConversation()} hitSlop={8} accessibilityRole="button" accessibilityLabel="New conversation">
          <Plus size={18} color={theme.colors.primaryNavy} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Conversations</Text>
        {loading ? (
          <ActivityIndicator color={theme.colors.secondarySilver} style={styles.stateBox} />
        ) : error ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>Couldn't load your conversations.</Text>
            <Pressable onPress={load} hitSlop={8} accessibilityRole="button">
              <Text style={styles.retryText}>Try Again</Text>
            </Pressable>
          </View>
        ) : conversations.length === 0 ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateText}>No saved conversations yet.</Text>
            <Text style={styles.stateHint}>
              Ask the concierge something and it will be kept here.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {conversations.map((conversation, index) => (
              <ConversationCard
                key={conversation.id}
                conversation={conversation}
                // The list is ordered by updatedAt, so "most recent" is
                // simply the first row — no stored flag to go stale.
                isMostRecent={index === 0}
                onOpen={() => openConversation(conversation.id)}
                onRename={() => onRename(conversation)}
                onDelete={() => onDelete(conversation)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  stateBox: {
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.xl,
  },
  stateText: {
    ...theme.typography.medium,
    fontSize: 15,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
  },
  stateHint: {
    ...theme.typography.body,
    fontSize: 13,
    color: theme.colors.mutedGray,
    textAlign: 'center',
  },
  retryText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.accentGold,
  },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
  },
  headerTextGroup: {
    flex: 1,
    gap: 2,
  },
  headerCaption: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  headerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.white,
  },
  newButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
  },
  sectionTitle: {
    ...theme.typography.headingSmall,
    fontSize: 22,
    color: theme.colors.white,
    marginBottom: theme.spacing.md,
  },

  list: {
    gap: theme.spacing.md,
  },
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flex: 1,
  },
  cardTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 15,
    color: theme.colors.white,
    flexShrink: 1,
  },
  cardTimestamp: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.mutedGray,
  },
  cardSummary: {
    ...theme.typography.medium,
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    color: theme.colors.mutedGray,
  },
  cardFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: theme.spacing.xs,
  },
  cardIconRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  continueButton: {
    paddingHorizontal: theme.spacing.md,
    height: 36,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.primaryNavy,
  },
  viewButton: {
    paddingHorizontal: theme.spacing.md,
    height: 36,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
  },
});
