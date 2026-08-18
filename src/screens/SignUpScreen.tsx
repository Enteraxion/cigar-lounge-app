/**
 * SignUpScreen
 *
 * "Create Account" screen for The Reserve (Cigar Lounge Locator).
 * Matches LoginScreen's exact visual system (same fonts, colors, card
 * sheen, input/button styles) — see that file for the design source of
 * truth. Wired to real Firebase Authentication (createUserWithEmailAndPassword,
 * then updateProfile with the entered name) — see
 * src/services/firebaseAuth.ts for the shared auth instance and error
 * mapping. Signs the new user back out immediately after creation so they
 * land on Login and sign in with their new credentials, rather than being
 * dropped straight into Main by createUserWithEmailAndPassword's implicit
 * sign-in.
 */

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { createUserWithEmailAndPassword, updateProfile } from '@react-native-firebase/auth';
import FlameIcon from '../components/FlameIcon';
import {
  auth,
  beginSignUpTransition,
  endSignUpTransition,
  getAuthErrorMessage,
  signOut,
} from '../services/firebaseAuth';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { AuthStackParamList } from '../navigation/AuthNavigator';
import { theme, withAlpha } from '../theme';
import { ageCheckMessage, checkMinimumAge } from '../utils/ageCheck';
import { submitAgeVerification } from '../services/ageVerificationService';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';

const FONT_SERIF_REGULAR = 'PlayfairDisplay-Regular';
const FONT_SERIF_SEMIBOLD = 'PlayfairDisplay-SemiBold';
const FONT_SANS_REGULAR = 'Inter-Regular';
const FONT_SANS_MEDIUM = 'Inter-Medium';
const FONT_SANS_SEMIBOLD = 'Inter-SemiBold';
const FONT_SANS_BOLD = 'Inter-Bold';

type SignUpNavigationProp = NativeStackNavigationProp<RootStackParamList & AuthStackParamList>;

export default function SignUpScreen() {
  const navigation = useNavigation<SignUpNavigationProp>();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Date of birth as three separate fields rather than one free-text date.
  // A single box invites "18/08/2005" vs "08/18/2005" ambiguity, and getting
  // that wrong on an age gate is not a cosmetic problem.
  const [birthDay, setBirthDay] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthYear, setBirthYear] = useState('');

  const handleCreateAccount = async () => {
    setErrorMessage(null);

    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage('Please fill in every field.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    // The 21+ gate runs BEFORE createUserWithEmailAndPassword, deliberately.
    // Checking afterwards would mean a minor's account exists, however
    // briefly, and would then need deleting — this way it is never created.
    // Dr. Brinkley, 2026-08-17: "the only people who should be able to
    // register are people who are 21 and up."
    const birth = {
      year: birthYear.trim() ? Number(birthYear.trim()) : undefined,
      month: birthMonth.trim() ? Number(birthMonth.trim()) : undefined,
      day: birthDay.trim() ? Number(birthDay.trim()) : undefined,
    };
    const ageCheck = checkMinimumAge(birth);
    if (!ageCheck.ok) {
      setErrorMessage(ageCheckMessage(ageCheck));
      return;
    }

    setSubmitting(true);
    // createUserWithEmailAndPassword signs the new user in automatically;
    // suppress AppNavigator's session listener for that one transient event
    // so Main never mounts before we sign back out below.
    beginSignUpTransition();
    try {
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(credential.user, { displayName: fullName.trim() });
      // Recorded, not decided — the gate above already accepted it. Written
      // before signing out, while this session still has permission to.
      await submitAgeVerification(credential.user.uid, {
        year: birth.year as number,
        month: birth.month as number,
        day: birth.day as number,
      }).catch(() => {
        // An account with no verification record reads as unverified, which is
        // the safe direction — it does not become a way in.
      });
      await signOut(auth);
      Alert.alert('Account Created', 'Please sign in with your new credentials.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      endSignUpTransition();
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

      <ScrollView {...keyboardAwareScrollProps}
        style={styles.main}
        contentContainerStyle={styles.mainContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------- Back button ---------------- */}
        {/* The "Sign In" footer link at the bottom of this form already gets
            you back to Login, but it sits below the fold on a long scrolling
            form — this matches ForgotPasswordScreen's top-left back button so
            both Auth screens behave the same way. */}
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

        {/* ---------------- Create Account Card ---------------- */}
        <View style={styles.card}>
          <LinearGradient
            colors={[withAlpha(theme.colors.white, 0.06), withAlpha(theme.colors.white, 0)]}
            style={styles.cardSheen}
            pointerEvents="none"
          />
          <Text style={styles.heading2}>Create Account</Text>

          {/* ---- Form ---- */}
          <View style={styles.form}>
            {/* Date of Birth — the 21+ gate. Three fields rather than one
                free-text date, because "18/08" and "08/18" are both plausible
                readings of the same input and guessing wrong on an age gate is
                not a cosmetic error. */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Date of Birth</Text>
              <View style={styles.dobRow}>
                <View style={[styles.inputWrapper, styles.dobField]}>
                  <TextInput
                    accessibilityLabel="Day of birth"
                    style={styles.dobInput}
                    placeholder="DD"
                    placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
                    value={birthDay}
                    onChangeText={text => setBirthDay(text.replace(/\D/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={[styles.inputWrapper, styles.dobField]}>
                  <TextInput
                    accessibilityLabel="Month of birth"
                    style={styles.dobInput}
                    placeholder="MM"
                    placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
                    value={birthMonth}
                    onChangeText={text => setBirthMonth(text.replace(/\D/g, '').slice(0, 2))}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <View style={[styles.inputWrapper, styles.dobFieldYear]}>
                  <TextInput
                    accessibilityLabel="Year of birth"
                    style={styles.dobInput}
                    placeholder="YYYY"
                    placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
                    value={birthYear}
                    onChangeText={text => setBirthYear(text.replace(/\D/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    maxLength={4}
                  />
                </View>
              </View>
              <Text style={styles.dobHint}>You must be 21 or over to join.</Text>
            </View>

            {/* Full Name field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Full Name</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconSlot}>
                  <Icon name="person-outline" size={16} color={withAlpha(theme.colors.secondarySilver, 0.6)} />
                </View>
                <TextInput
        accessibilityLabel="Enter your full name"
                  style={styles.input}
                  placeholder="Enter your full name"
                  placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
                  value={fullName}
                  onChangeText={setFullName}
                  autoCapitalize="words"
                />
              </View>
            </View>

            {/* Email field */}
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

            {/* Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Password</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconSlot}>
                  <Icon name="lock-closed-outline" size={16} color={withAlpha(theme.colors.secondarySilver, 0.6)} />
                </View>
                <TextInput
        accessibilityLabel="••••••••"
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                />
                <Pressable
                  style={styles.inputTrailingIconSlot}
                  onPress={() => setShowPassword(prev => !prev)}
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

            {/* Confirm Password field */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Confirm Password</Text>
              <View style={styles.inputWrapper}>
                <View style={styles.inputIconSlot}>
                  <Icon name="lock-closed-outline" size={16} color={withAlpha(theme.colors.secondarySilver, 0.6)} />
                </View>
                <TextInput
        accessibilityLabel="••••••••"
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={withAlpha(theme.colors.secondarySilver, 0.4)}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                />
                <Pressable
                  style={styles.inputTrailingIconSlot}
                  onPress={() => setShowConfirmPassword(prev => !prev)}
                  hitSlop={8}
                >
                  <Icon
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={16}
                    color={withAlpha(theme.colors.secondarySilver, 0.6)}
                  />
                </Pressable>
              </View>
            </View>

            {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

            {/* Create Account button */}
            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && styles.primaryButtonPressed,
                submitting && styles.primaryButtonDisabled,
              ]}
              onPress={handleCreateAccount}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color={theme.colors.primaryBlack} />
              ) : (
                <Text style={styles.primaryButtonText}>Create Account</Text>
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
                  'Sign up with Apple will be available in a future update. Please use email and password for now.',
                )
              }
            >
              <Icon name="logo-apple" size={18} color={theme.colors.white} />
              <Text style={styles.socialButtonText}>Apple</Text>
            </Pressable>
            <Pressable
              style={styles.socialButton}
              onPress={() =>
                Alert.alert(
                  'Coming Soon',
                  'Sign up with Google will be available in a future update. Please use email and password for now.',
                )
              }
            >
              <Icon name="logo-google" size={14} color={theme.colors.white} />
              <Text style={styles.socialButtonText}>Google</Text>
            </Pressable>
          </View>
        </View>

        {/* ---------------- Footer ---------------- */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Already a member?{' '}
            <Text style={styles.footerLink} onPress={() => navigation.navigate('Login')}>
              Sign In
            </Text>
          </Text>
        </View>
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

  // ---- Back button (matches ForgotPasswordScreen) ----
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
    paddingTop: 32,
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
  dobRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  dobField: {
    flex: 1,
    paddingHorizontal: theme.spacing.sm,
  },
  dobFieldYear: {
    flex: 1.4,
    paddingHorizontal: theme.spacing.sm,
  },
  dobInput: {
    flex: 1,
    ...theme.typography.body,
    fontSize: 15,
    color: theme.colors.white,
    textAlign: 'center',
  },
  dobHint: {
    ...theme.typography.medium,
    fontSize: 11,
    color: theme.colors.mutedGray,
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

  // ---- Divider ----
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.2),
  },
  dividerText: {
    fontFamily: FONT_SANS_REGULAR,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: withAlpha(theme.colors.secondarySilver, 0.5),
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
    backgroundColor: withAlpha(theme.colors.surface, 0.4),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.2),
    borderRadius: 12,
  },
  socialButtonText: {
    fontFamily: FONT_SANS_MEDIUM,
    fontSize: 14,
    color: theme.colors.white,
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
