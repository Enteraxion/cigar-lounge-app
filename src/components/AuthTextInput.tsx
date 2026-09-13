/**
 * AuthTextInput
 *
 * A text field for the sign-in, sign-up and reset screens whose placeholder is
 * drawn by us rather than by iOS.
 *
 * **Why this exists.** iOS substitutes its own font into the placeholder of any
 * field it decides belongs to a credential group — the password field itself,
 * and the email field sitting next to it. That font is wide-tracked, so
 * "Enter your email" rendered as "E n t e r  y o u r  e m a i" and clipped, and
 * it ignores `fontFamily` completely. Nothing on the TextInput changes it:
 * `textContentType`, `autoComplete` and an explicit font were each tried on
 * 2026-09-13 and none of them worked. One of those attempts made it worse,
 * because `textContentType="newPassword"` additionally switches on Automatic
 * Strong Password styling.
 *
 * The only reliable fix is to not ask iOS to draw it. The native `placeholder`
 * is left empty and a `Text` is laid over the field while it is empty, which we
 * style like any other text in the app.
 *
 * Two details that matter:
 *   - `pointerEvents="none"` so a tap on the placeholder still focuses the
 *     field underneath it.
 *   - `numberOfLines={1}` so a long placeholder truncates with an ellipsis
 *     rather than wrapping and pushing the field's height around.
 *
 * The font is owned here rather than taken from the caller, because all three
 * auth screens style these fields identically and the point of this component
 * is that the placeholder and the typed text cannot drift apart.
 */

import React from 'react';
import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { theme, withAlpha } from '../theme';

const FONT_SANS_REGULAR = 'Inter-Regular';

type Props = Omit<TextInputProps, 'placeholder' | 'placeholderTextColor' | 'value'> & {
  /** Drawn by us, over the field, while it is empty. */
  placeholder: string;
  /** Controlled. The placeholder shows only while this is empty. */
  value: string;
};

export default function AuthTextInput({ placeholder, value, style, ...rest }: Props) {
  return (
    <View style={styles.field}>
      <TextInput
        {...rest}
        value={value}
        style={[styles.input, style]}
        // Deliberately empty — see the header. This is the whole fix.
        placeholder=""
      />
      {value.length === 0 ? (
        <Text style={styles.placeholder} numberOfLines={1} pointerEvents="none">
          {placeholder}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // `justifyContent` is what vertically centres the absolute placeholder below,
  // which is why it sets no `top`.
  field: { flex: 1, justifyContent: 'center' },
  input: {
    flex: 1,
    height: '100%',
    paddingRight: 16,
    fontFamily: FONT_SANS_REGULAR,
    fontSize: 14,
    color: theme.colors.white,
  },
  placeholder: {
    position: 'absolute',
    left: 0,
    // Matches the input's own paddingRight so the ellipsis lands in the same
    // place the typed text would stop.
    right: 16,
    fontFamily: FONT_SANS_REGULAR,
    fontSize: 14,
    color: withAlpha(theme.colors.secondarySilver, 0.4),
  },
});
