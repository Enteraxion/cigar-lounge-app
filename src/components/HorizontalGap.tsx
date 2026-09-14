/**
 * The gap between cards in a horizontal rail.
 *
 * Six lists across Home, Search and Travel Wishlist each passed
 * `ItemSeparatorComponent={() => <View style={{ width: theme.spacing.md }} />}`.
 * An arrow function in a prop is a NEW component type on every render, so
 * React tears the separator down and rebuilds it each time the parent renders
 * rather than reusing it — which is what the react/no-unstable-nested-components
 * warning was pointing at (audit F18, 2026-09-14).
 *
 * Declared once at module scope so the type is stable, and shared so the rails
 * cannot drift apart on spacing.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { theme } from '../theme';

export default function HorizontalGap() {
  return <View style={styles.gap} />;
}

const styles = StyleSheet.create({
  gap: {
    width: theme.spacing.md,
  },
});
