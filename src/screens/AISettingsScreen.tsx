/**
 * AISettingsScreen
 *
 * Matches design-reference/Settings & AI Feedback.pdf (top half): header,
 * an Experience Modes toggle (Business/Vacation), a Max Travel Distance
 * slider + Preferred Atmosphere chip row, read-only Detailed Profiles
 * cards (Cigar Brands, Favorite Drinks), and System Preferences switches
 * (Accessibility Mode, Lounge Alerts). Reached via the gear icon on
 * ProfileScreen; the message-square icon in the header opens
 * AIFeedbackScreen. Every preference on this screen is real: it persists to
 * the member's profile and is sent to the concierge on every request, so
 * what they choose here changes the recommendations they get. Only the
 * option vocabularies (atmospheres, brands, drinks) are curated lists — no
 * backend/real AI personalization wired up yet.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  Image,
  Linking,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Bell,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Cigarette,
  LogOut,
  MessageSquareText,
  Trash2,
  TreePalm,
  UserX,
  User,
  Wine,
} from 'lucide-react-native';
import { theme, withAlpha } from '../theme';
import DistanceSlider from '../components/DistanceSlider';
import { auth, signOut } from '../services/firebaseAuth';
import { deleteMyAccount } from '../services/accountService';
import { PRIVACY_POLICY_URL, TERMS_URL } from '../config/legal';
import { useUserProfile } from '../hooks/useUserProfile';
import { saveAiPreferences } from '../services/conciergeMemoryService';
import { getBlockedMembers, unblockMember } from '../services/moderationService';
import {
  askForPushPermission,
  isDeviceRegisteredForPush,
  unregisterDeviceForPush,
} from '../services/pushService';
import { CIGAR_BRANDS } from '../data/cigarBrands';
import { DRINK_OPTIONS } from '../data/drinks';
import type { AiExperienceMode } from '../types/firestore';
import {
  atmosphereOptions,
  defaultExperienceMode,
  defaultMaxTravelDistance,
  defaultSelectedAtmosphereIds,
  experienceModes,
  type ExperienceMode,
} from '../data/mockAISettings';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';
import { canOpenAppSettings, openAppSettings } from '../utils/appSettings';
import { isPushSupported } from '../services/pushSupport';
import { TAB_BAR_SCROLL_CLEARANCE } from '../utils/tabBarLayout';

type AISettingsNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

const MODE_ICON: Record<ExperienceMode['id'], React.ComponentType<{ size?: number; color?: string }>> = {
  business: Briefcase,
  vacation: TreePalm,
};

export default function AISettingsScreen() {
  const navigation = useNavigation<AISettingsNavigationProp>();
  const { profile, reload } = useUserProfile();

  const userId = auth.currentUser?.uid;
  const saved = profile?.aiPreferences;

  const [experienceMode, setExperienceMode] = useState<ExperienceMode['id']>(defaultExperienceMode);
  const [maxDistance, setMaxDistance] = useState(defaultMaxTravelDistance);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [cigarBrands, setCigarBrands] = useState<string[]>([]);
  const [drinks, setDrinks] = useState<string[]>([]);
  // Which multi-select sheet is open, if any. One sheet serves both rows —
  // they differ only in their option list.
  const [picker, setPicker] = useState<null | 'brands' | 'drinks'>(null);
  const [selectedAtmosphereIds, setSelectedAtmosphereIds] = useState<Set<string>>(
    new Set(defaultSelectedAtmosphereIds),
  );

  /**
   * Lounge Alerts reflects whether THIS device is registered to receive push,
   * not merely whether iOS granted permission — see isDeviceRegisteredForPush.
   * `null` while we are still asking, so the switch never flickers through a
   * guessed position on the way to the real one.
   */
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [blockedMembers, setBlockedMembers] = useState<{ id: string; name: string }[]>([]);

  // Hydrate from the member's stored preferences once the profile arrives.
  // Without this the screen always opened on the defaults and quietly
  // discarded whatever they had chosen last time.
  useEffect(() => {
    if (!saved) return;
    setExperienceMode(saved.experienceMode);
    setMaxDistance(saved.maxTravelDistanceMiles);
    setSelectedAtmosphereIds(new Set(saved.atmospheres));
    setCigarBrands(saved.cigarBrands ?? []);
    setDrinks(saved.drinks ?? []);
  }, [saved]);

  /**
   * Read the real state on mount, and again whenever the app comes back to
   * the foreground — someone sent to iOS Settings to undo a denial returns
   * here, and the switch has to agree with what they just did there.
   */
  useEffect(() => {
    if (!userId) return undefined;

    let cancelled = false;
    const refresh = () => {
      isDeviceRegisteredForPush(userId).then(enabled => {
        if (!cancelled) setPushEnabled(enabled);
      });
    };

    refresh();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, [userId]);

  /**
   * iOS gives an app exactly one permission prompt for the life of the
   * install. Once refused, requestPermission returns "denied" without showing
   * anything, so switching this on would appear to do nothing at all — the
   * member must be sent to Settings instead, and told why.
   */
  const onTogglePush = async (next: boolean) => {
    if (!userId || pushBusy) return;
    setPushBusy(true);
    try {
      if (next) {
        const granted = await askForPushPermission(userId);
        setPushEnabled(granted);
        if (!granted) {
          // Three different reasons this can fail, and the wrong remedy for
          // any of them sends the member looking for a setting that is not
          // there. Unavailable comes first because it is not a refusal at all
          // — an iPhone Safari tab has no push API until the site is on the
          // Home Screen, so there is nothing for them to have said no to.
          if (!(await isPushSupported())) {
            Alert.alert(
              'Notifications are not available here',
              'On iPhone, open the Share menu and choose “Add to Home Screen”, then open Lounge Locator from there and switch Lounge Alerts on.',
            );
          } else if (canOpenAppSettings) {
            Alert.alert(
              'Notifications are off for this app',
              'Turn them on in Settings and Lounge Alerts will switch on here.',
              [
                { text: 'Not now', style: 'cancel' },
                { text: 'Open Settings', onPress: () => openAppSettings() },
              ],
            );
          } else {
            Alert.alert(
              'Notifications are off for this site',
              'Allow them from the padlock or ⓘ in the address bar, then switch Lounge Alerts back on.',
            );
          }
        }
      } else {
        await unregisterDeviceForPush(userId);
        setPushEnabled(false);
      }
    } finally {
      setPushBusy(false);
    }
  };

  useEffect(() => {
    if (!userId) return;
    getBlockedMembers(userId).then(setBlockedMembers);
  }, [userId]);

  const onUnblock = async (blockedUserId: string) => {
    if (!userId) return;
    await unblockMember(userId, blockedUserId).catch(() => {});
    setBlockedMembers(previous => previous.filter(member => member.id !== blockedUserId));
  };

  const atmosphereLabels = useMemo(
    () =>
      atmosphereOptions
        .filter(option => selectedAtmosphereIds.has(option.id))
        // The model reads labels, not our internal ids.
        .map(option => option.label),
    [selectedAtmosphereIds],
  );

  const dirty =
    !!saved &&
    (saved.experienceMode !== experienceMode ||
      saved.maxTravelDistanceMiles !== maxDistance ||
      saved.atmospheres.join('|') !== atmosphereLabels.join('|') ||
      (saved.cigarBrands ?? []).join('|') !== cigarBrands.join('|') ||
      (saved.drinks ?? []).join('|') !== drinks.join('|'));
  const neverSaved = !saved;

  const onSave = async () => {
    if (!userId || saveState === 'saving') return;
    setSaveState('saving');
    try {
      await saveAiPreferences(userId, {
        experienceMode: experienceMode as AiExperienceMode,
        maxTravelDistanceMiles: maxDistance,
        atmospheres: atmosphereLabels,
        cigarBrands,
        drinks,
      });
      await reload?.();
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  };

  const [deleting, setDeleting] = useState(false);

  const handleLogOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: async () => {
          // Forget this device BEFORE signing out, while the member's uid and
          // their Firestore permissions are both still available — afterwards
          // the delete would be refused by the rules. Without it the next person
          // to sign in on this phone keeps receiving the previous member's
          // notifications, which on an owner's device leaks who booked what.
          const uid = auth.currentUser?.uid;
          if (uid) {
            await unregisterDeviceForPush(uid).catch(() => {});
          }
          signOut(auth).catch(() => {
            // Sign-out is local-first and effectively never rejects; if it
            // somehow does, onAuthStateChanged won't fire and the member
            // simply stays signed in — nothing further to reconcile here.
          });
        },
      },
    ]);
  };

  /**
   * Delete account. Apple guideline 5.1.1(v) requires this to exist in the app
   * and to be reachable without contacting support, which is why it sits beside
   * Log Out rather than behind a web form.
   *
   * Two confirmations, not one. Log Out is a destructive-styled button whose
   * worst case is signing back in; this one cannot be undone, and the two are
   * adjacent — a mis-tap on the wrong red row should not end an account. The
   * second step lists what actually goes, because "your data" means nothing.
   */
  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete account?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: () =>
            Alert.alert(
              'Delete everything?',
              'Your account, reviews, photos, saved lounges, collections and table reservations will be permanently deleted, along with any ID document you uploaded. This cannot be undone.',
              [
                { text: 'Keep my account', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    setDeleting(true);
                    const result = await deleteMyAccount();
                    if (!result.ok) {
                      setDeleting(false);
                      Alert.alert('Account not deleted', result.message);
                      return;
                    }
                    // Sign out explicitly. On a phone the native SDK notices
                    // the deletion quickly and onAuthStateChanged returns the
                    // member to sign-in on its own, which is what this used to
                    // rely on. The web SDK does not: it holds a valid ID token
                    // for up to an hour and only discovers the account is gone
                    // at the next refresh, so the member was left sitting in a
                    // working-looking app with no account behind it (measured
                    // in a browser, 2026-09-17).
                    //
                    // Safe on both: signOut only clears the local session and
                    // fires the listener — it makes no call against the user,
                    // which is what the earlier reasoning here got wrong.
                    signOut(auth).catch(() => {
                      // Nothing to recover: the account is already deleted, and
                      // the session it refers to cannot outlive its next token
                      // refresh in any case.
                    });
                  },
                },
              ],
            ),
        },
      ],
    );
  };

  const toggleAtmosphere = (id: string) => {
    setSelectedAtmosphereIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* ---------------- Header ---------------- */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel="Go back" hitSlop={12}>
            <ChevronLeft size={24} color={theme.colors.white} />
          </Pressable>
          {profile?.avatarUri ? (
            <Image source={{ uri: profile.avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <User size={20} color={theme.colors.secondarySilver} />
            </View>
          )}
          <View style={styles.headerTextGroup}>
            <Text style={styles.headerCaption}>Personalize</Text>
            <Text style={styles.headerTitle}>AI Settings</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Give feedback on the Concierge"
            style={styles.headerButton}
            onPress={() => navigation.navigate('AIFeedback')}
            hitSlop={8}
          >
            <MessageSquareText size={18} color={theme.colors.secondarySilver} />
          </Pressable>
        </View>

        {/* ---------------- Experience Modes ---------------- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Experience Modes</Text>
          <View style={styles.modeRow}>
            {experienceModes.map(mode => {
              const Icon = MODE_ICON[mode.id];
              const selected = experienceMode === mode.id;
              return (
                <Pressable
                  key={mode.id}
                  style={[styles.modeCard, selected && styles.modeCardSelected]}
                  onPress={() => setExperienceMode(mode.id)}
                >
                  <Icon size={22} color={selected ? theme.colors.primaryBlack : theme.colors.secondarySilver} />
                  <Text style={[styles.modeLabel, selected && styles.modeLabelSelected]}>
                    {mode.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ---------------- Atmosphere & Radius ---------------- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Atmosphere & Radius</Text>
          <View style={styles.card}>
            <View style={styles.distanceHeaderRow}>
              <Text style={styles.fieldLabel}>Max Travel Distance</Text>
              <Text style={styles.distanceValue}>{maxDistance} mi</Text>
            </View>
            <DistanceSlider value={maxDistance} onChange={setMaxDistance} />

            <Text style={[styles.fieldLabel, styles.atmosphereLabel]}>Preferred Atmosphere</Text>
            <View style={styles.chipRow}>
              {atmosphereOptions.map(option => {
                const selected = selectedAtmosphereIds.has(option.id);
                return (
                  <Pressable
                    key={option.id}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleAtmosphere(option.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={option.label}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* These preferences are sent to the concierge on every request,
                so an unsaved change is a real difference in the answers the
                member gets — the button says so rather than autosaving
                silently. */}
            <Pressable
              style={[
                styles.saveButton,
                (!dirty && !neverSaved) || saveState === 'saving' ? styles.saveButtonIdle : null,
              ]}
              onPress={onSave}
              disabled={(!dirty && !neverSaved) || saveState === 'saving'}
              accessibilityRole="button"
              accessibilityLabel="Save concierge preferences"
              accessibilityState={{ disabled: (!dirty && !neverSaved) || saveState === 'saving' }}
            >
              <Text
                style={[
                  styles.saveButtonText,
                  (!dirty && !neverSaved) || saveState === 'saving'
                    ? styles.saveButtonTextIdle
                    : null,
                ]}
              >
                {saveState === 'saving'
                  ? 'Saving…'
                  : dirty || neverSaved
                    ? 'Save preferences'
                    : 'Preferences saved'}
              </Text>
            </Pressable>
            {saveState === 'error' ? (
              <Text style={styles.saveError}>
                Couldn't save. Check your connection and try again.
              </Text>
            ) : null}
          </View>
        </View>

        {/* ---------------- Detailed Profiles ---------------- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Profiles</Text>
          {/* These were static text showing three invented brands to every
              member. They are real preferences now, and they go to the model
              with the rest — so what a member picks here changes what the
              concierge recommends. */}
          <Pressable
            style={styles.infoRow}
            onPress={() => setPicker('brands')}
            accessibilityRole="button"
            accessibilityLabel="Edit your cigar brands"
          >
            <View style={styles.infoIconBox}>
              <Cigarette size={18} color={theme.colors.accentGold} />
            </View>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoTitle}>Cigar Brands</Text>
              <Text style={styles.infoSubtitle}>
                {cigarBrands.length ? cigarBrands.join(', ') : 'Tap to choose'}
              </Text>
            </View>
            <ChevronRight size={16} color={theme.colors.mutedGray} />
          </Pressable>
          <Pressable
            style={styles.infoRow}
            onPress={() => setPicker('drinks')}
            accessibilityRole="button"
            accessibilityLabel="Edit your favorite drinks"
          >
            <View style={styles.infoIconBox}>
              <Wine size={18} color={theme.colors.accentGold} />
            </View>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoTitle}>Favorite Drinks</Text>
              <Text style={styles.infoSubtitle}>
                {drinks.length ? drinks.join(', ') : 'Tap to choose'}
              </Text>
            </View>
            <ChevronRight size={16} color={theme.colors.mutedGray} />
          </Pressable>
        </View>

        {/* ---------------- Notifications ----------------
            "Accessibility Mode" used to sit above this and has been removed.
            It was a switch over nothing: no line of the app ever read it, and
            iOS already owns accessibility — the app honours Reduce Motion and
            ships VoiceOver labels whatever this said. Offering our own switch
            implied those were off until you opted in, which was the opposite
            of the truth. (Rohith, 2026-09-13.) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Bell size={18} color={theme.colors.secondarySilver} />
              <View style={styles.toggleTextGroup}>
                <Text style={styles.toggleLabel}>Lounge Alerts</Text>
                <Text style={styles.toggleHint}>
                  {pushEnabled === null
                    ? 'Checking…'
                    : pushEnabled
                      ? 'Reservations, reviews and claim updates on this device.'
                      : 'Turn on to be told about reservations and claim updates.'}
                </Text>
              </View>
            </View>
            <Switch
              value={pushEnabled === true}
              onValueChange={onTogglePush}
              disabled={pushEnabled === null || pushBusy}
              trackColor={{ false: theme.colors.surface, true: theme.colors.secondarySilver }}
              thumbColor={theme.colors.white}
            />
          </View>
        </View>

        {/* ---------------- Legal ---------------- */}
        {/* Apple requires a reachable privacy policy, and ours has to be findable
            from inside the app rather than only in the store listing — a member
            who wants to know what happens to the photograph of their driving
            licence should not have to leave the app to find out. */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Legal</Text>
          <Pressable
            style={styles.legalRow}
            onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})}
            accessibilityRole="link"
          >
            <Text style={styles.legalRowText}>Privacy Policy</Text>
            <ChevronRight size={17} color={theme.colors.mutedGray} />
          </Pressable>
          <Pressable
            style={styles.legalRow}
            onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}
            accessibilityRole="link"
          >
            <Text style={styles.legalRowText}>Terms of Service</Text>
            <ChevronRight size={17} color={theme.colors.mutedGray} />
          </Pressable>
        </View>

        {/* ---------------- Blocked members ----------------
            A block a member cannot undo is a trap, not a control: people
            block in irritation and change their minds, and with nowhere to
            reverse it the only way back is to stop using the app. Shown only
            when there is something in it, so it does not advertise a feature
            most members never touch. (Guideline 1.2, 2026-09-14.) */}
        {blockedMembers.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Blocked Members</Text>
            {blockedMembers.map(member => (
              <View key={member.id} style={styles.toggleRow}>
                <View style={styles.toggleLeft}>
                  <UserX size={18} color={theme.colors.secondarySilver} />
                  <View style={styles.toggleTextGroup}>
                    <Text style={styles.toggleLabel}>{member.name}</Text>
                    <Text style={styles.toggleHint}>
                      You do not see this member&rsquo;s reviews.
                    </Text>
                  </View>
                </View>
                <Pressable
                  onPress={() => onUnblock(member.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Unblock ${member.name}`}
                  hitSlop={8}
                >
                  <Text style={styles.unblockText}>Unblock</Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {/* ---------------- Account ----------------
            Log Out and Delete Account used to be a red-bordered button with
            bare red text loose underneath it: two red things of similar
            weight, the second looking like something that had come adrift.
            Red now means one thing on this screen. Logging out is routine and
            reversible, so it reads as neutral; deleting is the only
            destructive act and the only thing in danger colour.

            Both are the same card the rest of this screen is built from, so
            the section below Notifications does not change shape.

            Apple guideline 5.1.1(v): an app that lets you create an account
            must let you delete it in-app. It stays under Log Out because that
            is where a member looks for it, and where a reviewer looks for
            it. */}
        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.sectionTitle}>Account</Text>

          <Pressable
            style={({ pressed }) => [styles.infoRow, pressed && styles.rowPressed]}
            onPress={handleLogOut}
            accessibilityRole="button"
            accessibilityLabel="Log out on this device"
          >
            <View style={styles.neutralIconBox}>
              <LogOut size={18} color={theme.colors.secondarySilver} />
            </View>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoTitle}>Log Out</Text>
              <Text style={styles.infoSubtitle}>
                Signs you out on this device. Nothing is deleted.
              </Text>
            </View>
            <ChevronRight size={16} color={theme.colors.mutedGray} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.infoRow, pressed && styles.rowPressed]}
            onPress={handleDeleteAccount}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete my account permanently"
          >
            <View style={styles.dangerIconBox}>
              {deleting ? (
                <ActivityIndicator size="small" color={theme.colors.danger} />
              ) : (
                <Trash2 size={18} color={theme.colors.danger} />
              )}
            </View>
            <View style={styles.infoTextGroup}>
              <Text style={styles.dangerTitle}>
                {deleting ? 'Deleting your account…' : 'Delete Account'}
              </Text>
              <Text style={styles.infoSubtitle}>
                Permanently removes your account, reviews, reservations, saved
                lounges and verification documents. This cannot be undone.
              </Text>
            </View>
            {!deleting ? <ChevronRight size={16} color={theme.colors.mutedGray} /> : null}
          </Pressable>
        </View>
      </ScrollView>
      <Modal
        visible={picker !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setPicker(null)}>
          <Pressable style={styles.sheet} onPress={event => event.stopPropagation()}>
            <Text style={styles.sheetTitle}>
              {picker === 'brands' ? 'Cigar Brands' : 'Favorite Drinks'}
            </Text>
            <Text style={styles.sheetHint}>
              The concierge uses these when it recommends somewhere.
            </Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {(picker === 'brands' ? CIGAR_BRANDS : DRINK_OPTIONS).map(option => {
                  const list = picker === 'brands' ? cigarBrands : drinks;
                  const setList = picker === 'brands' ? setCigarBrands : setDrinks;
                  const selected = list.includes(option);
                  return (
                    <Pressable
                      key={option}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() =>
                        setList(
                          selected ? list.filter(item => item !== option) : [...list, option],
                        )
                      }
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={option}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
            <Pressable
              style={styles.saveButton}
              onPress={() => setPicker(null)}
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: withAlpha(theme.colors.background, 0.6),
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '80%',
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.large,
    borderTopRightRadius: theme.radius.large,
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sheetTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 16,
    color: theme.colors.white,
  },
  sheetHint: {
    ...theme.typography.body,
    fontSize: 12,
    color: theme.colors.mutedGray,
    marginTop: 2,
    marginBottom: theme.spacing.md,
  },
  saveButton: {
    marginTop: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accentGold,
    alignItems: 'center',
  },
  saveButtonIdle: {
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.12),
  },
  saveButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.primaryBlack,
  },
  saveButtonTextIdle: {
    color: theme.colors.secondarySilver,
  },
  saveError: {
    ...theme.typography.body,
    fontSize: 12,
    color: theme.colors.mutedGray,
    marginTop: theme.spacing.sm,
    textAlign: 'center',
  },
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: TAB_BAR_SCROLL_CLEARANCE,
    gap: theme.spacing.xl,
  },

  // ---- Header ----
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingTop: theme.spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.3),
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerCaption: {
    ...theme.typography.caption,
    color: theme.colors.accentGold,
  },
  headerTitle: {
    ...theme.typography.headingSmall,
    color: theme.colors.white,
    marginTop: 2,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ---- Sections ----
  section: {
    gap: theme.spacing.md,
  },
  lastSection: {
    marginBottom: 0,
  },
  sectionTitle: {
    ...theme.typography.caption,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: theme.colors.mutedGray,
  },

  // ---- Experience Modes ----
  modeRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modeCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.15),
  },
  modeCardSelected: {
    backgroundColor: theme.colors.accentGold,
    borderColor: theme.colors.white,
  },
  modeLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.secondarySilver,
  },
  modeLabelSelected: {
    color: theme.colors.primaryBlack,
  },

  // ---- Atmosphere & Radius ----
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    gap: theme.spacing.sm,
    ...theme.shadows.soft,
  },
  distanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  distanceValue: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  atmosphereLabel: {
    marginTop: theme.spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  chip: {
    paddingHorizontal: theme.spacing.md,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: withAlpha(theme.colors.accentGold, 0.25),
  },
  chipSelected: {
    backgroundColor: theme.colors.accentGold,
    borderColor: theme.colors.secondarySilver,
  },
  chipText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  chipTextSelected: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryBlack,
  },

  // ---- Detailed Profiles ----
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
    ...theme.shadows.soft,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.accentGold, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTextGroup: {
    flex: 1,
    gap: 2,
  },
  infoTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.white,
  },
  infoSubtitle: {
    ...theme.typography.medium,
    fontSize: 12,
    color: theme.colors.mutedGray,
  },

  // ---- System Preferences ----
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surface,
  },
  toggleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    paddingRight: theme.spacing.md,
  },
  toggleTextGroup: {
    flex: 1,
    gap: 2,
  },
  toggleHint: {
    ...theme.typography.body,
    fontSize: 11.5,
    lineHeight: 16,
    color: theme.colors.mutedGray,
  },
  toggleLabel: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ---- Legal ----
  legalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: withAlpha(theme.colors.secondarySilver, 0.15),
  },
  legalRowText: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ---- Account ----
  // Both rows reuse infoRow above; only the icon wash and the title colour
  // differ, which is what separates "routine" from "destructive" here.
  rowPressed: {
    opacity: 0.7,
  },
  neutralIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.secondarySilver, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: withAlpha(theme.colors.danger, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
  },
  unblockText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 13,
    color: theme.colors.accentGold,
  },
  dangerTitle: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.danger,
  },
});
