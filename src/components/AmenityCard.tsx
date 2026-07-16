/**
 * AmenityCard
 *
 * Icon + label tile used in the Amenities grid on Lounge Detail, and will
 * be reused wherever amenity/feature grids appear later (Ratings
 * Breakdown, etc).
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

type Props = {
  icon: React.ReactNode;
  label: string;
};

export default function AmenityCard({ icon, label }: Props) {
  return (
    <View style={styles.card}>
      {icon}
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    width: '47%',
    height: 64,
    paddingHorizontal: theme.spacing.md,
    borderRadius: theme.radius.medium,
    backgroundColor: theme.colors.surfaceNavy,
  },
  label: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.white,
    flexShrink: 1,
  },
});
