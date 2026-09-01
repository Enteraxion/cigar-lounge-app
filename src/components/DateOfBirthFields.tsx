/**
 * DateOfBirthFields
 *
 * Three number fields — month, day, year — for entering a date of birth.
 *
 * Three fields rather than one free-text date, because "18/08" and "08/18" are
 * both plausible readings of the same input and guessing wrong on an age gate is
 * not a cosmetic error. Month first, per Julian's walkthrough note on
 * 2026-08-28: this is a US product and MM/DD/YYYY is what its members will type
 * whatever order the boxes are in.
 *
 * **SignUpScreen has its own copy of this markup and deliberately still does.**
 * It is the single highest-risk screen in the app — every account starts there —
 * and swapping its layout days before an App Store submission buys consistency
 * at the cost of a screen nobody would notice was broken until sign-ups stopped.
 * Whoever is next in SignUpScreen with time to look at it should adopt this and
 * delete the duplicate; until then, any change to the ordering or the digit
 * filtering has to be made in both.
 */

import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { theme, withAlpha } from '../theme';

/** Digits only, capped — pasting a full date into one box should not overflow it. */
const digits = (text: string, max: number) => text.replace(/\D/g, '').slice(0, max);

export type DateOfBirthParts = { month: string; day: string; year: string };

type Props = {
  value: DateOfBirthParts;
  onChange: (next: DateOfBirthParts) => void;
  editable?: boolean;
};

export default function DateOfBirthFields({ value, onChange, editable = true }: Props) {
  return (
    <View style={styles.row}>
      <View style={[styles.wrap, styles.field]}>
        <TextInput
          accessibilityLabel="Month of birth"
          style={styles.input}
          placeholder="MM"
          placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
          value={value.month}
          onChangeText={text => onChange({ ...value, month: digits(text, 2) })}
          keyboardType="number-pad"
          maxLength={2}
          editable={editable}
        />
      </View>
      <View style={[styles.wrap, styles.field]}>
        <TextInput
          accessibilityLabel="Day of birth"
          style={styles.input}
          placeholder="DD"
          placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
          value={value.day}
          onChangeText={text => onChange({ ...value, day: digits(text, 2) })}
          keyboardType="number-pad"
          maxLength={2}
          editable={editable}
        />
      </View>
      <View style={[styles.wrap, styles.fieldYear]}>
        <TextInput
          accessibilityLabel="Year of birth"
          style={styles.input}
          placeholder="YYYY"
          placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
          value={value.year}
          onChangeText={text => onChange({ ...value, year: digits(text, 4) })}
          keyboardType="number-pad"
          maxLength={4}
          editable={editable}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: theme.spacing.sm },
  wrap: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: theme.gold.line,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  field: { flex: 1 },
  fieldYear: { flex: 1.4 },
  input: {
    ...theme.typography.medium,
    color: theme.colors.white,
    padding: 0,
    textAlign: 'center',
  },
});
