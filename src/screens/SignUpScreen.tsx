/**
 * SignUpScreen
 *
 * "Create Account" screen for The Reserve (Cigar Lounge Locator).
 * Matches LoginScreen's visual system (same fonts, colours, card sheen,
 * input/button styles) — see that file for the design source of truth. Both the
 * missing gold-glow gradient layer and the back button sitting under the status
 * bar were fixed on 2026-08-20; see ForgotPasswordScreen's header for the
 * detail, it had the same two faults. Wired to real Firebase Authentication (createUserWithEmailAndPassword,
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
  Image,
  Linking,
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
import Icon from '../components/AuthIcon';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { createUserWithEmailAndPassword, updateProfile } from '@react-native-firebase/auth';
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
import AuthTextInput from '../components/AuthTextInput';
import { ageCheckMessage, checkMinimumAge } from '../utils/ageCheck';
import { submitAgeVerification } from '../services/ageVerificationService';
import { keyboardAwareScrollProps } from '../utils/keyboardAware';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../config/legal';

const FONT_SERIF_REGULAR = 'PlayfairDisplay-Regular';
const FONT_SERIF_SEMIBOLD = 'PlayfairDisplay-SemiBold';
const FONT_SANS_REGULAR = 'Inter-Regular';
const FONT_SANS_MEDIUM = 'Inter-Medium';
const FONT_SANS_SEMIBOLD = 'Inter-SemiBold';
const FONT_SANS_BOLD = 'Inter-Bold';

type SignUpNavigationProp = NativeStackNavigationProp<RootStackParamList & AuthStackParamList>;

/** How long the "Account created" confirmation stays up before it moves on. */
const CONFIRMATION_MS = 2200;

export default function SignUpScreen() {
  const navigation = useNavigation<SignUpNavigationProp>();
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(false);
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
      // No verification email is sent here any more.
      //
      // Verification is a 6-digit code now (2026-08-23), and the endpoint that
      // sends one requires a signed-in caller — which this member is about to
      // stop being, two lines below. Sending a code here would also start its
      // 10-minute expiry and its 60-second resend cooldown before the member had
      // even reached the sign-in form, so someone who took five minutes to type
      // their password would arrive at a wall holding a code that had already
      // died.
      //
      // The wall asks for the code itself, once, when the member is actually
      // standing in front of it. One tap, and no state to keep in step across a
      // sign-out.

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
      // The age-verification record is written above, while this session still
      // has permission to. Signing out first would leave the account with no
      // record, which every read treats as unverified — safe, but it would put
      // the member behind a wall with nothing to show a reviewer.
      await signOut(auth);

      // A confirmation that clears itself, rather than an Alert waiting to be
      // dismissed. Julian, 2026-08-25: the modal did not go away on its own, so
      // the flow stalled on a message that told the member nothing they had to
      // act on.
      //
      // It is shown for CONFIRMATION_MS and then the navigator is released, which
      // lands on the sign-in form — so the member reads it and arrives where they
      // need to be without tapping anything. Long enough to read, short enough
      // not to feel stuck.
      setCreated(true);
      await new Promise(resolve => setTimeout(resolve, CONFIRMATION_MS));

      // Navigate EXPLICITLY. The first version of this relied on the root
      // navigator switching back to the Auth stack once auth.currentUser was
      // null and assumed that would land on the sign-in form. It does not: this
      // screen already lives inside the Auth stack, pushed on top of Login, so
      // the switch changes nothing and the member sat looking at the
      // confirmation forever. Rohith hit it immediately.
      //
      // popTo rather than navigate, so Login is the screen already underneath
      // rather than a second copy pushed on top — same reasoning as the
      // confirmation screens fixed on 2026-08-23.
      navigation.popTo('Login');
      setCreated(false);
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
                <AuthTextInput
                  accessibilityLabel="Enter your full name"
                  placeholder="Enter your full name"
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
                <AuthTextInput
                  accessibilityLabel="Enter your email"
                  placeholder="Enter your email"
                  textContentType="username"
                  autoComplete="email"
                  autoCorrect={false}
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
                <AuthTextInput
                  accessibilityLabel="Choose a password"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="new-password"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
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
                <AuthTextInput
                  accessibilityLabel="Confirm your password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  textContentType="newPassword"
                  autoComplete="new-password"
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={showConfirmPassword ? "Hide password" : "Show password"}
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

            {/* Consent, at the point consent is actually given. Under the button
                rather than above it, because that is where it is read, and worded
                as a statement of what the tap means rather than a checkbox — the
                terms say a member must be 21, which is the same thing the date
                field above already enforces. */}
            <Text style={styles.consent}>
              By creating an account you agree to our{' '}
              <Text
                style={styles.consentLink}
                accessibilityRole="link"
                onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
              >
                Terms of Service
              </Text>{' '}
              and{' '}
              <Text
                style={styles.consentLink}
                accessibilityRole="link"
                onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
              >
                Privacy Policy
              </Text>
              , and confirm you are 21 or over.
            </Text>
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

      {/* Account-created confirmation. Covers the form so the half-filled fields
          are not visible behind it, and clears itself — see CONFIRMATION_MS. */}
      {created && (
        <View style={styles.createdOverlay}>
          <View style={styles.createdBadge}>
            <Icon name="checkmark" size={32} color={theme.colors.accentGold} />
          </View>
          <Text style={styles.createdTitle}>Account created</Text>
          <Text style={styles.createdBody}>
            Sign in below, and we&rsquo;ll email you a 6-digit code to confirm your address.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  consent: {
    ...theme.typography.medium,
    fontSize: 11.5,
    lineHeight: 17,
    color: theme.colors.mutedGray,
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  consentLink: {
    color: theme.colors.accentGold,
    textDecorationLine: 'underline',
  },

  createdOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.primaryBlack,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.sm,
  },
  createdBadge: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.35),
    marginBottom: theme.spacing.xs,
  },
  createdTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.bold,
    fontSize: 20,
    color: theme.colors.white,
  },
  createdBody: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.secondarySilver,
    textAlign: 'center',
    lineHeight: 20,
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
