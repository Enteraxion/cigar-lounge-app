/**
 * ForgotPasswordScreen
 *
 * "Reset Password" screen for The Reserve (Cigar Lounge Locator).
 * Matches LoginScreen's visual system (same fonts, colours, card sheen,
 * input/button styles) — see that file for the design source of truth.
 *
 * That claim was false until 2026-08-20: this screen had one flat black
 * gradient where Login has a gold glow under a black wash, and a silver flame
 * where Login's is gold, so it read as a screen whose theme had not loaded. It
 * also drew its back button under the status bar, which on iOS is where taps
 * stop reaching the app — the button was not broken, it was unreachable. Wired to real Firebase Authentication (sendPasswordResetEmail) —
 * see src/services/firebaseAuth.ts for the shared auth instance and error
 * mapping.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { theme, withAlpha } from '../theme';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';
import AuthTextInput from '../components/AuthTextInput';
import { requestPasswordResetCode, submitPasswordReset } from '../services/emailCodeService';

const FONT_SERIF_REGULAR = 'PlayfairDisplay-Regular';
const FONT_SERIF_SEMIBOLD = 'PlayfairDisplay-SemiBold';
const FONT_SANS_REGULAR = 'Inter-Regular';
const FONT_SANS_MEDIUM = 'Inter-Medium';
const FONT_SANS_SEMIBOLD = 'Inter-SemiBold';
const FONT_SANS_BOLD = 'Inter-Bold';

type ForgotPasswordNavigationProp = NativeStackNavigationProp<AuthStackParamList>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<ForgotPasswordNavigationProp>();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  /** 'email' -> 'code' -> 'done'. */
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSendCode = async () => {
    setErrorMessage(null);
    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    setSubmitting(true);
    const result = await requestPasswordResetCode(email);
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      return;
    }
    // Always advances, whether or not that address has an account. The server
    // answers the same either way — see sendPasswordResetCode. Stopping here for
    // an unknown address would tell anyone who asked which addresses are
    // registered.
    setStep('code');
  };

  const handleResetPassword = async () => {
    setErrorMessage(null);
    if (code.trim().length !== 6) {
      setErrorMessage('Enter all six digits.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('Choose a password of at least 8 characters.');
      return;
    }
    setSubmitting(true);
    const result = await submitPasswordReset(email, code, newPassword);
    setSubmitting(false);
    if (!result.ok) {
      setErrorMessage(result.message);
      setCode('');
      return;
    }
    setStep('done');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      {/* Two layers, matching LoginScreen: a warm gold glow at the top, then
          black over it. A single black gradient — which is what this screen had
          — gives the card nothing to sit on, and reads as the theme not having
          loaded. */}
      <LinearGradient
        colors={[theme.gold.glow, withAlpha(theme.colors.accentGold, 0.04), theme.colors.background]}
        locations={[0, 0.35, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[
          withAlpha(theme.colors.background, 0.2),
          withAlpha(theme.colors.background, 0.75),
          theme.colors.background,
        ]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView {...keyboardAwareScrollProps}
        style={styles.main}
        contentContainerStyle={[styles.mainContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- Back button ---------------- */}
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
          <Icon name="arrow-back" size={22} color={theme.colors.white} />
        </Pressable>

        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <Image
            source={require('../../assets/images/lounge-locator-mark.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Lounge Locator"
          />
          <Text style={styles.heading1}>LOUNGE LOCATOR</Text>
          <Text style={styles.subtitle}>CIGAR LOUNGE SOCIETY</Text>
        </View>

        {/* ---------------- Card ---------------- */}
        <View style={styles.card}>
          <LinearGradient
            colors={[withAlpha(theme.colors.white, 0.06), withAlpha(theme.colors.white, 0)]}
            style={styles.cardSheen}
            pointerEvents="none"
          />

          {step === 'done' ? (
            <View style={styles.successBlock}>
              <View style={styles.successIconBadge}>
                <Icon name="checkmark-circle-outline" size={32} color={theme.colors.accentGold} />
              </View>
              <Text style={styles.heading2}>Password Changed</Text>
              <Text style={styles.description}>
                You can sign in with your new password now. Any other device that was
                signed in has been signed out.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  styles.successButton,
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.primaryButtonText}>Sign In</Text>
              </Pressable>
            </View>
          ) : step === 'code' ? (
            <>
              <Text style={styles.heading2}>Enter Your Code</Text>
              {/* Carefully worded. The server answers identically whether or not
                  that address has an account, so this screen must not imply one
                  exists — "if that address has an account" is the whole promise
                  we are willing to make. */}
              <Text style={styles.description}>
                If <Text style={styles.descriptionEmphasis}>{email}</Text> has an
                account, we&rsquo;ve sent it a 6-digit code. Enter it below and choose
                a new password.
              </Text>

              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>6-Digit Code</Text>
                  <TextInput
                    accessibilityLabel="Six digit reset code"
                    style={styles.codeInput}
                    value={code}
                    onChangeText={text => {
                      setCode(text.replace(/\D/g, '').slice(0, 6));
                      setErrorMessage(null);
                    }}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete="one-time-code"
                    maxLength={6}
                    autoFocus
                    placeholder="000000"
                    placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
                  />
                </View>

                <View style={styles.fieldGroup}>
                  {/* The requirement sits beside the label, not in the
                      placeholder. iOS draws the placeholder of a
                      secureTextEntry field in the system password font —
                      wide-tracked, and it ignores fontFamily — which clipped
                      "At least 8 characters" to "At least 8 ch" (2026-09-13).
                      No textContentType avoids that; bullets are what Login and
                      SignUp use, and spaced bullets still read as bullets.
                      Moving the rule out here is better anyway: it stays visible
                      while they type, which is exactly when it matters. */}
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>New Password</Text>
                    <Text style={styles.fieldRule}>At least 8 characters</Text>
                  </View>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconSlot}>
                      <Icon name="lock-closed-outline" size={16} color={withAlpha(theme.colors.secondarySilver, 0.6)} />
                    </View>
                    <AuthTextInput
                      accessibilityLabel="Choose a new password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      /* `password`, deliberately not `newPassword`. The latter
                         is semantically righter and switches iOS into Automatic
                         Strong Password mode, which restyles the whole field —
                         including drawing the placeholder in a wide-tracked font
                         that clipped "At least 8 characters" to "At least 8 ch".
                         Tried on 2026-09-13 and reverted the same hour. The
                         generator is a small convenience on a reset screen; a
                         visibly broken field is not a fair price for it. */
                      textContentType="password"
                      autoComplete="password"
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      style={styles.inputTrailingIconSlot}
                      onPress={() => setShowPassword(v => !v)}
                      hitSlop={8}
                    >
                      <Icon
                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                        size={16}
                        color={withAlpha(theme.colors.secondarySilver, 0.6)}
                      />
                    </Pressable>
                  </View>
                </View>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    submitting && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleResetPassword}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={theme.colors.primaryBlack} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Change Password</Text>
                  )}
                </Pressable>

                <Pressable onPress={() => setStep('email')} hitSlop={8}>
                  <Text style={styles.stepBackText}>Use a different email address</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.heading2}>Reset Password</Text>
              <Text style={styles.description}>
                Enter your email and we&rsquo;ll send you a 6-digit code to reset your
                password.
              </Text>

              {/* ---- Form ---- */}
              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconSlot}>
                      <Icon name="mail-outline" size={16} color={withAlpha(theme.colors.secondarySilver, 0.6)} />
                    </View>
                    <AuthTextInput
                      accessibilityLabel="Enter your email"
                      placeholder="Enter your email"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoCorrect={false}
                      textContentType="username"
                      autoComplete="email"
                    />
                  </View>
                </View>

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <Pressable
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.primaryButtonPressed,
                    submitting && styles.primaryButtonDisabled,
                  ]}
                  onPress={handleSendCode}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={theme.colors.primaryBlack} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Code</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* ---------------- Footer ---------------- */}
        {step !== 'done' ? (
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Remember your password?{' '}
              <Text style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
                Sign In
              </Text>
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  codeInput: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 26,
    letterSpacing: 10,
    textAlign: 'center',
    color: theme.colors.white,
    height: 58,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.white, 0.04),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.35),
  },
  stepBackText: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    textDecorationLine: 'underline',
    marginTop: theme.spacing.xs,
  },

  screen: {
    flex: 1,
    backgroundColor: theme.colors.primaryBlack,
  },
  main: {
    flex: 1,
  },
  mainContent: {
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  // ---- Back button ----
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(theme.colors.surface, 0.5),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.2),
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Header ----
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  // 96x87 matches the asset's own proportions (816x738 before scaling), so the
  // mark fills its box exactly rather than letterboxing inside a square.
  logo: { width: 96, height: 87 },
  heading1: {
    fontFamily: FONT_SERIF_SEMIBOLD,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: 0.75,
    color: theme.colors.white,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONT_SANS_MEDIUM,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: withAlpha(theme.colors.secondarySilver, 0.8),
    textAlign: 'center',
  },

  // ---- Card ----
  card: {
    marginTop: 33,
    backgroundColor: withAlpha(theme.colors.primaryBlack, 0.75),
    borderTopWidth: 1,
    borderTopColor: withAlpha(theme.colors.secondarySilver, 0.2),
    borderRadius: 24,
    padding: 24,
    gap: 16,
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 32,
    elevation: 8,
  },
  cardSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  heading2: {
    fontFamily: FONT_SERIF_REGULAR,
    fontSize: 24,
    lineHeight: 32,
    color: theme.colors.white,
    textAlign: 'center',
  },
  description: {
    fontFamily: FONT_SANS_REGULAR,
    fontSize: 14,
    lineHeight: 20,
    color: withAlpha(theme.colors.secondarySilver, 0.8),
    textAlign: 'center',
  },
  descriptionEmphasis: {
    fontFamily: FONT_SANS_SEMIBOLD,
    color: theme.colors.white,
  },

  // ---- Form ----
  form: {
    gap: 16,
    marginTop: 8,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontFamily: FONT_SANS_SEMIBOLD,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: theme.colors.accentGold,
  },
  /** Label left, rule right — same row, so it costs no vertical space. */
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  fieldRule: {
    fontFamily: FONT_SANS_REGULAR,
    fontSize: 11,
    lineHeight: 16,
    color: withAlpha(theme.colors.secondarySilver, 0.7),
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: withAlpha(theme.colors.surface, 0.6),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.2),
    borderRadius: 12,
  },
  inputIconSlot: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /**
   * The show/hide eye. Same 44pt slot as the leading icon, so the icon is
   * centred in it rather than pressed against the border — which is how it
   * looked until 2026-09-13, because the Pressable here carried no style at all
   * while SignUpScreen's identical control did. Matching that is the point: a
   * member sees this field and the sign-up one minutes apart.
   *
   * 44pt is also the smallest comfortable touch target, so the slot earns its
   * width twice over.
   */
  inputTrailingIconSlot: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingRight: 16,
    fontFamily: FONT_SANS_REGULAR,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ---- Error message ----
  errorText: {
    fontFamily: FONT_SANS_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
    color: theme.colors.danger,
    textAlign: 'center',
  },

  // ---- Primary button ----
  primaryButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.secondarySilver,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  primaryButtonPressed: {
    opacity: 0.85,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    fontFamily: FONT_SANS_BOLD,
    fontSize: 14,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: theme.colors.primaryBlack,
  },

  // ---- Success state ----
  successBlock: {
    alignItems: 'center',
    gap: 12,
  },
  /**
   * `successBlock` centres its children, which shrinks each one to its own
   * content — right for the badge and the two lines of text, wrong for the
   * button, which collapsed to the width of the words "Sign In" and read as a
   * cramped square. Every other primary button in this flow fills its card, so
   * this one stretches back out and matches them.
   */
  successButton: {
    alignSelf: 'stretch',
    marginTop: 4,
  },
  successIconBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },

  // ---- Footer ----
  footer: {
    marginTop: 32,
    alignItems: 'center',
    paddingBottom: 24,
  },
  footerText: {
    fontFamily: FONT_SANS_REGULAR,
    fontSize: 14,
    color: withAlpha(theme.colors.secondarySilver, 0.7),
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: FONT_SANS_SEMIBOLD,
    color: theme.colors.accentGold,
    textDecorationLine: 'underline',
  },
});
