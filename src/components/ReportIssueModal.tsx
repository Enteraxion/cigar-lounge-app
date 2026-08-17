/**
 * ReportIssueModal
 *
 * Small centered dialog for reporting a problem with an AI recommendation
 * (AIFeedbackScreen's "Report Issues" action). Built with RN's built-in
 * Modal — same pattern as FilterBottomSheet/SortBottomSheet/
 * FilterReviewsSheet. No backend wired up yet; submitting just closes the
 * dialog and lets the caller show a confirmation.
 */

import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';
import { theme, withAlpha } from '../theme';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (description: string) => void;
};

export default function ReportIssueModal({ visible, onClose, onSubmit }: Props) {
  const [description, setDescription] = useState('');

  const submit = () => {
    onSubmit(description);
    setDescription('');
  };

  const cancel = () => {
    setDescription('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={cancel}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={cancel} />
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <AlertTriangle size={20} color={theme.colors.danger} />
          </View>
          <Text style={styles.title}>Report an Issue</Text>
          <Text style={styles.subtitle}>Tell us what went wrong with this recommendation.</Text>
          <TextInput
        accessibilityLabel="Describe the issue..."
            style={styles.input}
            placeholder="Describe the issue..."
            placeholderTextColor={theme.colors.mutedGray}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelButton} onPress={cancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable style={styles.submitButton} onPress={submit}>
              <Text style={styles.submitButtonText}>Submit</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: withAlpha(theme.colors.background, 0.7),
  },
  card: {
    padding: theme.spacing.lg,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
    ...theme.shadows.deep,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.danger, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.typography.headingSmall,
    fontSize: 18,
    color: theme.colors.white,
    marginTop: theme.spacing.xs,
  },
  subtitle: {
    ...theme.typography.medium,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.mutedGray,
  },
  input: {
    minHeight: 90,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.25),
    color: theme.colors.white,
    fontSize: 14,
    marginTop: theme.spacing.xs,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.secondarySilver, 0.25),
  },
  cancelButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  submitButton: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.white,
  },
  submitButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 14,
    color: theme.colors.primaryBlack,
  },
});
