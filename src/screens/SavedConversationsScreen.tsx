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

import React from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Pencil, Plus, Star, Trash2 } from 'lucide-react-native';
import { theme } from '../theme';
import { conciergeUser } from '../data/mockConcierge';
import { savedConversations, type SavedConversation } from '../data/mockTripPlanner';
import type { ConciergeStackParamList } from '../navigation/ConciergeNavigator';

type ConciergeNavigationProp = NativeStackNavigationProp<ConciergeStackParamList>;

function ConversationCard({
  conversation,
  onOpen,
}: {
  conversation: SavedConversation;
  onOpen: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleRow}>
          {conversation.isRecent ? (
            <Star size={13} color={theme.colors.accentGold} fill={theme.colors.accentGold} />
          ) : null}
          <Text style={styles.cardTitle} numberOfLines={1}>
            {conversation.title}
          </Text>
        </View>
        <Text style={styles.cardTimestamp}>{conversation.timestamp.toUpperCase()}</Text>
      </View>

      <Text style={styles.cardSummary} numberOfLines={2}>
        Summarized: {conversation.summary}
      </Text>

      <View style={styles.cardFooterRow}>
        <View style={styles.cardIconRow}>
          <Pressable
            onPress={() => Alert.alert('Coming Soon', 'Renaming conversations is coming soon.')}
            hitSlop={8}
          >
            <Pencil size={15} color={theme.colors.mutedGray} />
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert('Delete Conversation', 'Deleting saved conversations is coming soon.')
            }
            hitSlop={8}
          >
            <Trash2 size={15} color={theme.colors.mutedGray} />
          </Pressable>
        </View>
        <Pressable
          style={conversation.isRecent ? styles.continueButton : styles.viewButton}
          onPress={onOpen}
        >
          <Text style={conversation.isRecent ? styles.continueButtonText : styles.viewButtonText}>
            {conversation.isRecent ? 'Continue' : 'View'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SavedConversationsScreen() {
  const navigation = useNavigation<ConciergeNavigationProp>();

  const openConversation = () => {
    navigation.navigate('ConciergeConversation');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Image source={{ uri: conciergeUser.avatarUri }} style={styles.avatar} />
        <View style={styles.headerTextGroup}>
          <Text style={styles.headerCaption}>Archive</Text>
          <Text style={styles.headerTitle}>History</Text>
        </View>
        <Pressable style={styles.newButton} onPress={openConversation} hitSlop={8}>
          <Plus size={18} color={theme.colors.primaryNavy} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.sectionTitle}>Conversations</Text>
        <View style={styles.list}>
          {savedConversations.map(conversation => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              onOpen={openConversation}
            />
          ))}
        </View>
      </ScrollView>
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
    paddingBottom: 120,
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
