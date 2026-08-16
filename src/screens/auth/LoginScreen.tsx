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
  Alert,
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
import FlameIcon from '../../components/FlameIcon';
import { auth, getAuthErrorMessage } from '../../services/firebaseAuth';
import type { RootStackParamList } from '../../navigation/AppNavigator';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';

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

      {/* Background photo placeholder + the exact 3-stop Figma gradient
          overlay: rgba(10,17,40,0.4) -> rgba(10,17,40,0.8) -> #0A1128 */}
      <LinearGradient
        colors={['rgba(10, 17, 40, 0.4)', 'rgba(10, 17, 40, 0.8)', '#0A1128']}
        locations={[0, 0.5, 1]}
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
          <View style={styles.logoBadge}>
            <FlameIcon size={24} color="#C0C0C0" />
          </View>
          <Text style={styles.heading1}>THE RESERVE</Text>
          <Text style={styles.subtitle}>CIGAR LOUNGE SOCIETY</Text>
        </View>

        {/* ---------------- Member Access Card ---------------- */}
        <View style={styles.card}>
          <LinearGradient
            colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0)']}
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
                  <Icon name="mail-outline" size={16} color="rgba(192, 192, 192, 0.6)" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(192, 192, 192, 0.4)"
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
                  <Icon name="lock-closed-outline" size={16} color="rgba(192, 192, 192, 0.6)" />
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(192, 192, 192, 0.4)"
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
                <ActivityIndicator color="#0A1128" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </Pressable>
          </View>

          {/* ---- Divider ---- */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>Or continue with</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* ---- Social buttons ---- */}
          <View style={styles.socialRow}>
            <Pressable
              style={styles.socialButton}
              onPress={() =>
                Alert.alert(
                  'Coming Soon',
                  'Sign in with Apple will be available in a future update. Please use email and password for now.',
                )
              }
            >
              <Icon name="logo-apple" size={18} color="#FFFFFF" />
              <Text style={styles.socialButtonText}>Apple</Text>
            </Pressable>
            <Pressable
              style={styles.socialButton}
              onPress={() =>
                Alert.alert(
                  'Coming Soon',
                  'Sign in with Google will be available in a future update. Please use email and password for now.',
                )
              }
            >
              <Icon name="logo-google" size={14} color="#FFFFFF" />
              <Text style={styles.socialButtonText}>Google</Text>
            </Pressable>
          </View>
        </View>

        {/* ---------------- Footer ---------------- */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Not a member yet?{' '}
            <Text
              style={styles.footerLink}
              onPress={() => navigation.navigate('SignUp')}
            >
              Apply for Access
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
    backgroundColor: '#0A1128',
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
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(18, 30, 63, 0.5)',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.3)',
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
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FONT_SANS_MEDIUM,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: 'rgba(192, 192, 192, 0.8)',
    textAlign: 'center',
  },

  // ---- Card ----
  card: {
    marginTop: 33,
    backgroundColor: 'rgba(10, 17, 40, 0.75)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(192, 192, 192, 0.2)',
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
    color: '#FFFFFF',
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
    color: '#C0C0C0',
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
    color: 'rgba(192, 192, 192, 0.8)',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    backgroundColor: 'rgba(18, 30, 63, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.2)',
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
    color: '#FFFFFF',
  },

  // ---- Error message ----
  errorText: {
    fontFamily: FONT_SANS_MEDIUM,
    fontSize: 13,
    lineHeight: 18,
    color: '#EF4444',
    textAlign: 'center',
  },

  // ---- Sign In button ----
  signInButton: {
    height: 52,
    borderRadius: 12,
    backgroundColor: '#C0C0C0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#C0C0C0',
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
    color: '#0A1128',
  },

  // ---- Divider ----
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(192, 192, 192, 0.2)',
  },
  dividerText: {
    fontFamily: FONT_SANS_REGULAR,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(192, 192, 192, 0.5)',
  },

  // ---- Social buttons ----
  socialRow: {
    flexDirection: 'row',
    gap: 12,
  },
  socialButton: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(18, 30, 63, 0.4)',
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.2)',
    borderRadius: 12,
  },
  socialButtonText: {
    fontFamily: FONT_SANS_MEDIUM,
    fontSize: 14,
    color: '#FFFFFF',
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
    color: 'rgba(192, 192, 192, 0.7)',
    textAlign: 'center',
  },
  footerLink: {
    fontFamily: FONT_SANS_SEMIBOLD,
    color: '#FFFFFF',
    textDecorationLine: 'underline',
  },
});
