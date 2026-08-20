/**
 * LoginScreen
 *
 * "Welcome & Login" screen for The Reserve (Cigar Lounge Locator).
 * Matches the Figma "Welcome & Login" frame (375 x 840):
 *   - Playfair Display for headings, Inter for body text (linked as static
 *     TTFs in assets/fonts, see react-native.config.js).
 *   - Real vector icons via react-native-vector-icons/Ionicons (no emoji).
 *   - Gradient background + card sheen via react-native-linear-gradient.
 * Wired to real Firebase Authentication (signInWithEmailAndPassword) — see
 * src/services/firebaseAuth.ts for the shared auth instance and error
 * mapping. Session persistence/auto-redirect on relaunch is handled by
 * AppNavigator's onAuthStateChanged listener, not this screen.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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
import { signInWithEmailAndPassword } from '@react-native-firebase/auth';
import { auth, getAuthErrorMessage } from '../../services/firebaseAuth';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { theme, withAlpha } from '../../theme';

const FONT_SERIF_REGULAR = 'PlayfairDisplay-Regular';
const FONT_SERIF_SEMIBOLD = 'PlayfairDisplay-SemiBold';
const FONT_SANS_REGULAR = 'Inter-Regular';
const FONT_SANS_MEDIUM = 'Inter-Medium';
const FONT_SANS_SEMIBOLD = 'Inter-SemiBold';
const FONT_SANS_BOLD = 'Inter-Bold';

type LoginNavigationProp = NativeStackNavigationProp<RootStackParamList & AuthStackParamList>;

export default function LoginScreen() {
  const navigation = useNavigation<LoginNavigationProp>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async () => {
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter your email and password.');
      return;
    }

    setSubmitting(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // No explicit navigation — AppNavigator's onAuthStateChanged listener
      // swaps the root stack to Main as soon as it observes the new session.
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // Figma measures the 32px header padding from the true top of the
    // frame (no reserved status-bar gap), so we only inset the bottom
    // safe area here and let the background bleed behind the status bar.
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* Background photo placeholder + the 3-stop gradient overlay, now
          expressed against the palette rather than baked-in navy literals —
          see src/theme's withAlpha. */}
      {/* Two layers, in the order the kiosk welcome screens use: a warm gold
          glow at the top, then black over it. Flat black behind a black card
          gave the screen nothing to sit on — this is what reads as lit. */}
      <LinearGradient
        colors={[theme.gold.glow, withAlpha(theme.colors.accentGold, 0.04), theme.colors.background]}
        locations={[0, 0.35, 1]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[withAlpha(theme.colors.background, 0.2), withAlpha(theme.colors.background, 0.75), theme.colors.background]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <KeyboardAvoidingView
        style={styles.main}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <Image
            source={require('../../../assets/images/lounge-locator-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel="Lounge Locator"
          />
          <Text style={styles.heading1}>LOUNGE LOCATOR</Text>
          <Text style={styles.subtitle}>CIGAR LOUNGE SOCIETY</Text>
        </View>

        {/* ---------------- Member Access Card ---------------- */}
        <View style={styles.card}>
          <LinearGradient
            colors={[theme.gold.wash, withAlpha(theme.colors.accentGold, 0)]}
            style={styles.cardSheen}
            pointerEvents="none"
          />
          <Text style={styles.heading2}>Member Access</Text>

          {/* ---- Form ---- */}
          <View style={styles.form}>
            {/* Email field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconSlot}>
                  <Icon name="mail-outline" size={16} color={theme.colors.accentGold} />
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

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.fieldLabel}>Password</Text>
                <Pressable onPress={() => navigation.navigate('ForgotPassword')}>
                  <Text style={styles.forgotLink}>Forgot?</Text>
                </Pressable>
              </View>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconSlot}>
                  <Icon name="lock-closed-outline" size={16} color={theme.colors.accentGold} />
                </View>
                <TextInput
        accessibilityLabel="••••••••"
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            {/* Sign In button */}
            <Pressable
              style={({ pressed }) => [
                styles.signInButton,
                pressed && styles.signInButtonPressed,
                submitting && styles.signInButtonDisabled,
              ]}
              onPress={handleSignIn}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.primaryBlack} />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          {/* Apple and Google buttons removed 2026-08-19 — see the matching note
              in SignUpScreen. They only raised a "Coming Soon" alert, and the
              blocker on making them real is the 21+ gate: neither provider hands
              over a date of birth, so social sign-in needs its own step to collect
              one before it can ship. */}
        </View>

        {/* ---------------- Footer ---------------- */}
        {/* "Apply for Access" until 2026-08-19 — membership wording carried over
            from the original Figma. It promised something the app does not do:
            there is no application and nothing to wait for, an account is created
            immediately. It also stopped reading as the sign-up link at all, which
            is how the only route to sign-up came to look missing. The screen it
            opens is headed "Create Account", so this now matches it. */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Not a member yet?{' '}
            <Text
              style={styles.footerLink}
              onPress={() => navigation.navigate('SignUp')}
              accessibilityRole="link"
            >
              Create Account
            </Text>
          </Text>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 24,
    paddingVertical: 32,
  },

  // ---- Header ----
  header: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 16,
  },
  logo: { width: 76, height: 76 },
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
    letterSpacing: 3,
    textTransform: 'uppercase',
    color: theme.colors.accentGold,
    textAlign: 'center',
  },

  // ---- Card ----
  card: {
    marginTop: 33,
    backgroundColor: withAlpha(theme.colors.primaryBlack, 0.75),
    // A hairline all the way round, not just the top edge. On navy the card
    // separated from the page by tone alone; on black it needs an edge or it
    // reads as a hole rather than a panel.
    borderWidth: 1,
    borderColor: theme.gold.line,
    borderRadius: 24,
    padding: 24,
    gap: 24,
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

  // ---- Form ----
  form: {
    gap: 16,
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
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  forgotLink: {
    fontFamily: FONT_SANS_REGULAR,
    fontSize: 12,
    lineHeight: 16,
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

  // ---- Sign In button ----
  signInButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.accentGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
    elevation: 4,
  },
  signInButtonPressed: {
    opacity: 0.85,
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    fontFamily: FONT_SANS_BOLD,
    fontSize: 14,
    letterSpacing: 0.35,
    textTransform: 'uppercase',
    color: theme.colors.primaryBlack,
  },

  // ---- Divider ----

  // ---- Social buttons ----

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
