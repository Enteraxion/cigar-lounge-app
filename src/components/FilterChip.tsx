/**
 * FilterChip
 *
 * Pill-shaped filter control from 05 Core Components.pdf ("Filter Chips"):
 * a filled/selected state and an outlined/unselected state. Reused
 * anywhere a horizontal row of quick filters appears (Search, Map, etc).
 */

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export default function FilterChip({ label, selected = false, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected ? styles.chipSelected : styles.chipUnselected]}
    >
      <Text style={[styles.label, selected ? styles.labelSelected : styles.labelUnselected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: theme.spacing.md,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: theme.colors.secondarySilver,
  },
  chipUnselected: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  label: {
    ...theme.typography.medium,
    fontSize: 13,
  },
  labelSelected: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },
  labelUnselected: {
    color: theme.colors.secondarySilver,
  },
});
