/**
 * ForgotPasswordScreen
 *
 * "Reset Password" screen for The Reserve (Cigar Lounge Locator).
 * Matches LoginScreen's exact visual system (same fonts, colors, card
 * sheen, input/button styles) — see that file for the design source of
 * truth. Wired to real Firebase Authentication (sendPasswordResetEmail) —
 * see src/services/firebaseAuth.ts for the shared auth instance and error
 * mapping.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { sendPasswordResetEmail } from '@react-native-firebase/auth';
import FlameIcon from '../components/FlameIcon';
import { auth, getAuthErrorMessage } from '../services/firebaseAuth';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { theme, withAlpha } from '../theme';

const FONT_SERIF_REGULAR = 'PlayfairDisplay-Regular';
const FONT_SERIF_SEMIBOLD = 'PlayfairDisplay-SemiBold';
const FONT_SANS_REGULAR = 'Inter-Regular';
const FONT_SANS_MEDIUM = 'Inter-Medium';
const FONT_SANS_SEMIBOLD = 'Inter-SemiBold';
const FONT_SANS_BOLD = 'Inter-Bold';

type ForgotPasswordNavigationProp = NativeStackNavigationProp<AuthStackParamList>;

export default function ForgotPasswordScreen() {
  const navigation = useNavigation<ForgotPasswordNavigationProp>();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSendResetLink = async () => {
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage('Please enter your email address.');
      return;
    }

    setSubmitting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <LinearGradient
        colors={[withAlpha(theme.colors.primaryBlack, 0.4), withAlpha(theme.colors.primaryBlack, 0.8), theme.colors.primaryBlack]}
        locations={[0, 0.5, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.main}
        contentContainerStyle={styles.mainContent}
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
          <View style={styles.logoBadge}>
            <FlameIcon size={24} color={theme.colors.secondarySilver} />
          </View>
          <Text style={styles.heading1}>THE RESERVE</Text>
          <Text style={styles.subtitle}>CIGAR LOUNGE SOCIETY</Text>
        </View>

        {/* ---------------- Card ---------------- */}
        <View style={styles.card}>
          <LinearGradient
            colors={[withAlpha(theme.colors.white, 0.06), withAlpha(theme.colors.white, 0)]}
            style={styles.cardSheen}
            pointerEvents="none"
          />

          {sent ? (
            <View style={styles.successBlock}>
              <View style={styles.successIconBadge}>
                <Icon name="checkmark-circle-outline" size={32} color={theme.colors.secondarySilver} />
              </View>
              <Text style={styles.heading2}>Check Your Email</Text>
              <Text style={styles.description}>
                We've sent a password reset link to{' '}
                <Text style={styles.descriptionEmphasis}>{email}</Text>. Follow the
                instructions in that email to choose a new password.
              </Text>

              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && styles.primaryButtonPressed,
                ]}
                onPress={() => navigation.navigate('Login')}
              >
                <Text style={styles.primaryButtonText}>Back to Sign In</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.heading2}>Reset Password</Text>
              <Text style={styles.description}>
                Enter your email and we'll send you a link to reset your password.
              </Text>

              {/* ---- Form ---- */}
              <View style={styles.form}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Email Address</Text>
                  <View style={styles.inputWrapper}>
                    <View style={styles.inputIconSlot}>
                      <Icon name="mail-outline" size={16} color={withAlpha(theme.colors.secondarySilver, 0.6)} />
                    </View>
                    <TextInput
        accessibilityLabel="Enter your email"
                      style={styles.input}
                      placeholder="Enter your email"
                      placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
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
                  onPress={handleSendResetLink}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color={theme.colors.primaryBlack} />
                  ) : (
                    <Text style={styles.primaryButtonText}>Send Reset Link</Text>
                  )}
                </Pressable>
              </View>
            </>
          )}
        </View>

        {/* ---------------- Footer ---------------- */}
        {!sent ? (
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
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: withAlpha(theme.colors.surface, 0.5),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.3),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 6,
  },
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
