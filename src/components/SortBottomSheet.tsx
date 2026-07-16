/**
 * SortBottomSheet
 *
 * Matches design-reference/Sort & Active Summary.pdf: a bottom sheet modal
 * with a radio-button list of sort options and an "Apply Sort" button.
 * Built with RN's built-in Modal (no bottom-sheet library in this
 * project yet) — a backdrop press or the close button dismiss it.
 */

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Crown, X } from 'lucide-react-native';
import { theme } from '../theme';
import { sortOptions } from '../data/mockSort';

type Props = {
  visible: boolean;
  selectedId: string;
  onSelect: (id: string) => void;
  onApply: () => void;
  onClose: () => void;
};

export default function SortBottomSheet({
  visible,
  selectedId,
  onSelect,
  onApply,
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Sort By</Text>
          <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
            <X size={18} color={theme.colors.white} />
          </Pressable>
        </View>

        <View style={styles.divider} />

        {sortOptions.map(option => {
          const selected = option.id === selectedId;
          return (
            <Pressable
              key={option.id}
              style={styles.optionRow}
              onPress={() => onSelect(option.id)}
            >
              <View style={styles.optionLabelRow}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                {option.icon === 'crown' ? (
                  <Crown size={14} color={theme.colors.accentGold} />
                ) : null}
              </View>
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
            </Pressable>
          );
        })}

        <Pressable style={styles.applyButton} onPress={onApply}>
          <Text style={styles.applyButtonText}>Apply Sort</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 10, 24, 0.7)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: theme.radius.xl,
    borderTopRightRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceNavy,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
    ...theme.shadows.deep,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.3)',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...theme.typography.headingMedium,
    fontFamily: theme.fontFamily.regular,
    fontSize: 28,
    color: theme.colors.white,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(192, 192, 192, 0.15)',
    marginVertical: theme.spacing.md,
  },

  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
  },
  optionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  optionLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: theme.radius.full,
    borderWidth: 2,
    borderColor: 'rgba(192, 192, 192, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: theme.colors.secondarySilver,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.secondarySilver,
  },

  applyButton: {
    height: 52,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.secondarySilver,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.md,
  },
  applyButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 16,
    color: theme.colors.primaryNavy,
  },
});
