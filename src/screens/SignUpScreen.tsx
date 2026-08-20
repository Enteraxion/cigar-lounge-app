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
  sendVerificationEmail,
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
      // Ask Firebase to email the confirmation link. Fire-and-forget by design:
      // sendVerificationEmail never throws, because a failure here would surface
      // as "couldn't create your account" over an account that was created. The
      // member can resend from the banner, and an unconfirmed address is a state
      // the app already handles rather than an error.
      await sendVerificationEmail();

      // Signed back out on purpose, per Rohith 2026-08-20: a new member returns
      // to the sign-in form and enters the credentials they just chose, rather
      // than being carried into the app on the session
      // createUserWithEmailAndPassword opens implicitly.
      //
      // It costs a step, and the reason to accept that is what it buys: typing
      // the password once more is the only point in the flow that proves they
      // can reproduce it. Otherwise a member is carried in on an implicit session
      // and only discovers a typo'd password days later, when the session lapses
      // and there is nothing to recover the account with — the confirmation email
      // being the other thing they may not have received.
      //
      // The age-verification record and the confirmation email are both written
      // above, while this session still has permission to. Signing out first
      // would leave the account with no record, which every read treats as
      // unverified — safe, but it would put the member behind a wall with
      // nothing to show a reviewer.
      await signOut(auth);
      Alert.alert(
        'Account created',
        'We’ve emailed you a link to confirm your address — check your spam folder if it isn’t there. Sign in below to finish setting up your account.',
      );
      // `endSignUpTransition` in the finally block releases the navigator. With
      // the sign-out above, `auth.currentUser` is null by then, so it lands on
      // the Auth stack — the sign-in form — rather than the app.
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
          <Text style={styles.heading1}>LOUNGE LOCATOR</Text>
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

          {/* Apple and Google buttons removed 2026-08-19. They existed only to
              raise a "Coming Soon" alert, which on the sign-up screen is a
              promise the app cannot keep at the moment somebody is deciding
              whether to join — and the first thing a reviewer taps.

              The groundwork is done and kept: Google is enabled in Firebase, the
              redirect scheme is declared in Info.plist and both client IDs are in
              src/config/googleSignIn.ts. What is NOT done is the reason this is
              not simply switched on — a Google or Apple account carries no date
              of birth, and the 21+ gate reads one from this form. Such an account
              looks identical to a grandfathered pre-feature account and would
              walk straight past the gate, so social sign-in needs its own
              date-of-birth step before it can ship. Restore these buttons then,
              wired, rather than as placeholders. */}
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
