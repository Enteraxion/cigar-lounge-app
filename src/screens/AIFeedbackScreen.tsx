/**
 * AIFeedbackScreen
 *
 * Matches design-reference/Settings & AI Feedback.pdf (bottom half):
 * header, a "Last Recommendation" card with Helpful/Not Helpful voting
 * and "How can we improve?" chips, then Save Recommendation, Report
 * Issues, and Update Preferences actions. Reached via the message-square
 * icon on AISettingsScreen; "Update Preferences" navigates back there.
 * Mock data only (see src/data/mockAISettings.ts) — no backend/real AI
 * feedback pipeline wired up yet.
 */

import React, { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  AlertTriangle,
  Bookmark,
  ChevronLeft,
  Settings,
  ThumbsDown,
  ThumbsUp,
  User,
} from 'lucide-react-native';
import { theme } from '../theme';
import ReportIssueModal from '../components/ReportIssueModal';
import { useUserProfile } from '../hooks/useUserProfile';
import { improvementReasons, lastRecommendation } from '../data/mockAISettings';
import { submitIssueReport } from '../services/userActionsService';
import { auth } from '../services/firebaseAuth';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';

type AIFeedbackNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

type Vote = 'helpful' | 'not-helpful' | null;

export default function AIFeedbackScreen() {
  const navigation = useNavigation<AIFeedbackNavigationProp>();
  const { profile } = useUserProfile();

  const [vote, setVote] = useState<Vote>('helpful');
  const [selectedReasonIds, setSelectedReasonIds] = useState<Set<string>>(new Set());
  const [reportModalVisible, setReportModalVisible] = useState(false);

  const toggleReason = (id: string) => {
    setSelectedReasonIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const submitReport = async (description: string) => {
    const userId = auth.currentUser?.uid;
    if (!userId || !description.trim()) {
      setReportModalVisible(false);
      return;
    }
    setReportModalVisible(false);
    try {
      await submitIssueReport(userId, description);
      Alert.alert('Report Submitted', "Thanks for letting us know — we'll look into it.");
    } catch (error) {
      Alert.alert(
        "Couldn't submit report",
        error instanceof Error ? error.message : 'Check your connection and try again.',
      );
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </Pressable>
          {profile?.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <User size={20} color={theme.colors.secondarySilver} />
            </View>
          )}
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerCaption}>AI Experience</Text>
            <Text style={styles.headerTitle}>Recommendations</Text>
          </View>
          <Pressable
            style={styles.headerButton}
            onPress={() => navigation.navigate('AISettings')}
            hitSlop={8}
          >
            <Settings size={18} color={theme.colors.secondarySilver} />
          </Pressable>
        </View>

        {/* ---------------- Last Recommendation ---------------- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Last Recommendation</Text>
          <View style={styles.card}>
            <View style={styles.imageWrap}>
              <Image source={{ uri: lastRecommendation.image }} style={styles.image} resizeMode="cover" />
              <View style={styles.loungeBadge}>
                <Text style={styles.loungeBadgeText}>{lastRecommendation.loungeName.toUpperCase()}</Text>
              </View>
            </View>

            <Text style={styles.question}>Did you enjoy this visit?</Text>

            <View style={styles.voteRow}>
              <Pressable
                style={[styles.voteButton, vote === 'helpful' && styles.voteButtonSelected]}
                onPress={() => setVote('helpful')}
              >
                <ThumbsUp
                  size={16}
                  color={vote === 'helpful' ? theme.colors.primaryNavy : theme.colors.secondarySilver}
                />
                <Text
                  style={[styles.voteButtonText, vote === 'helpful' && styles.voteButtonTextSelected]}
                >
                  Helpful
                </Text>
              </Pressable>
              <Pressable
                style={[styles.voteButton, vote === 'not-helpful' && styles.voteButtonSelected]}
                onPress={() => setVote('not-helpful')}
              >
                <ThumbsDown
                  size={16}
                  color={vote === 'not-helpful' ? theme.colors.primaryNavy : theme.colors.secondarySilver}
                />
                <Text
                  style={[
                    styles.voteButtonText,
                    vote === 'not-helpful' && styles.voteButtonTextSelected,
                  ]}
                >
                  Not Helpful
                </Text>
              </Pressable>
            </View>

            <Text style={styles.improveLabel}>How can we improve?</Text>
            <View style={styles.chipRow}>
              {improvementReasons.map(reason => {
                const selected = selectedReasonIds.has(reason.id);
                return (
                  <Pressable
                    key={reason.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleReason(reason.id)}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {reason.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ---------------- Actions ---------------- */}
        <View style={[styles.section, styles.lastSection]}>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => Alert.alert('Coming Soon', 'Saving recommendations is coming soon.')}
          >
            <Bookmark size={16} color={theme.colors.white} />
            <Text style={styles.secondaryButtonText}>Save Recommendation</Text>
          </Pressable>
          <Pressable style={styles.reportButton} onPress={() => setReportModalVisible(true)}>
            <AlertTriangle size={16} color={theme.colors.danger} />
            <Text style={styles.reportButtonText}>Report Issues</Text>
          </Pressable>
          <Pressable
            style={styles.primaryButton}
            onPress={() => navigation.navigate('AISettings')}
          >
            <Text style={styles.primaryButtonText}>Update Preferences</Text>
          </Pressable>
        </View>
      </ScrollView>

      <ReportIssueModal
        visible={reportModalVisible}
        onClose={() => setReportModalVisible(false)}
        onSubmit={submitReport}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
    gap: theme.spacing.xl,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerCaption: {
    ...theme.typography.caption,
    color: theme.colors.mutedGray,
  },
  headerTitle: {
    ...theme.typography.headingSmall,
    color: theme.colors.white,
    marginTop: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Sections ----
  section: {
    gap: theme.spacing.md,
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    ...theme.typography.headingSmall,
    fontSize: 20,
    color: theme.colors.white,
  },

  // ---- Last Recommendation card ----
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    gap: theme.spacing.md,
    ...theme.shadows.soft,
  },
  imageWrap: {
    borderRadius: theme.radius.medium,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 10,
    backgroundColor: theme.colors.background,
  },
  loungeBadge: {
    position: 'absolute',
    top: theme.spacing.sm,
    left: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(5, 10, 24, 0.75)',
  },
  loungeBadgeText: {
    ...theme.typography.caption,
    fontSize: 9,
    color: theme.colors.white,
  },
  question: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 18,
    color: theme.colors.white,
  },

  // ---- Vote buttons ----
  voteRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  voteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 52,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  voteButtonSelected: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.white,
  },
  voteButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.secondarySilver,
  },
  voteButtonTextSelected: {
    color: theme.colors.primaryNavy,
  },

  // ---- Improve chips ----
  improveLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.mutedGray,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  chipSelected: {
    backgroundColor: theme.colors.secondarySilver,
    borderColor: theme.colors.secondarySilver,
  },
  chipText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  chipTextSelected: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },

  // ---- Actions ----
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 52,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  secondaryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 52,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  reportButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.danger,
  },
  primaryButton: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
  },
  primaryButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 15,
    color: theme.colors.primaryNavy,
  },
});
