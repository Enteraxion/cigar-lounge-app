/**
 * AISettingsScreen
 *
 * Matches design-reference/Settings & AI Feedback.pdf (top half): header,
 * an Experience Modes toggle (Business/Vacation), a Max Travel Distance
 * slider + Preferred Atmosphere chip row, read-only Detailed Profiles
 * cards (Cigar Brands, Favorite Drinks), and System Preferences switches
 * (Accessibility Mode, Lounge Alerts). Reached via the gear icon on
 * ProfileScreen; the message-square icon in the header opens
 * AIFeedbackScreen. Mock data only (see src/data/mockAISettings.ts) — no
 * backend/real AI personalization wired up yet.
 */

import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, View, Image, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Accessibility,
  Bell,
  Briefcase,
  ChevronLeft,
  Cigarette,
  LogOut,
  MessageSquareText,
  TreePalm,
  User,
  Wine,
} from 'lucide-react-native';
import { theme } from '../theme';
import DistanceSlider from '../components/DistanceSlider';
import { auth, signOut } from '../services/firebaseAuth';
import { useUserProfile } from '../hooks/useUserProfile';
import {
  atmosphereOptions,
  defaultExperienceMode,
  defaultMaxTravelDistance,
  defaultSelectedAtmosphereIds,
  defaultSystemPreferences,
  detailedProfiles,
  experienceModes,
  type ExperienceMode,
} from '../data/mockAISettings';
import type { ProfileStackParamList } from '../navigation/ProfileNavigator';

type AISettingsNavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

const MODE_ICON: Record<ExperienceMode['id'], React.ComponentType<{ size?: number; color?: string }>> = {
  business: Briefcase,
  vacation: TreePalm,
};

export default function AISettingsScreen() {
  const navigation = useNavigation<AISettingsNavigationProp>();
  const { profile } = useUserProfile();

  const [experienceMode, setExperienceMode] = useState<ExperienceMode['id']>(defaultExperienceMode);
  const [maxDistance, setMaxDistance] = useState(defaultMaxTravelDistance);
  const [selectedAtmosphereIds, setSelectedAtmosphereIds] = useState<Set<string>>(
    new Set(defaultSelectedAtmosphereIds),
  );
  const [accessibilityMode, setAccessibilityMode] = useState(
    defaultSystemPreferences.accessibilityMode,
  );
  const [loungeAlerts, setLoungeAlerts] = useState(defaultSystemPreferences.loungeAlerts);

  const handleLogOut = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => {
          signOut(auth).catch(() => {
            // Sign-out is local-first and effectively never rejects; if it
            // somehow does, onAuthStateChanged won't fire and the member
            // simply stays signed in — nothing further to reconcile here.
          });
        },
      },
    ]);
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
          <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
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
                  <Icon size={22} color={selected ? theme.colors.primaryNavy : theme.colors.secondarySilver} />
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
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        {/* ---------------- Detailed Profiles ---------------- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detailed Profiles</Text>
          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <Cigarette size={18} color={theme.colors.accentGold} />
            </View>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoTitle}>Cigar Brands</Text>
              <Text style={styles.infoSubtitle}>{detailedProfiles.cigarBrands}</Text>
            </View>
          </View>
          <View style={styles.infoRow}>
            <View style={styles.infoIconBox}>
              <Wine size={18} color={theme.colors.accentGold} />
            </View>
            <View style={styles.infoTextGroup}>
              <Text style={styles.infoTitle}>Favorite Drinks</Text>
              <Text style={styles.infoSubtitle}>{detailedProfiles.favoriteDrinks}</Text>
            </View>
          </View>
        </View>

        {/* ---------------- System Preferences ---------------- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>System Preferences</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Accessibility size={18} color={theme.colors.secondarySilver} />
              <Text style={styles.toggleLabel}>Accessibility Mode</Text>
            </View>
            <Switch
              value={accessibilityMode}
              onValueChange={setAccessibilityMode}
              trackColor={{ false: theme.colors.surfaceNavy, true: theme.colors.secondarySilver }}
              thumbColor={theme.colors.white}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleLeft}>
              <Bell size={18} color={theme.colors.secondarySilver} />
              <Text style={styles.toggleLabel}>Lounge Alerts</Text>
            </View>
            <Switch
              value={loungeAlerts}
              onValueChange={setLoungeAlerts}
              trackColor={{ false: theme.colors.surfaceNavy, true: theme.colors.secondarySilver }}
              thumbColor={theme.colors.white}
            />
          </View>
        </View>

        {/* ---------------- Log Out ---------------- */}
        <View style={[styles.section, styles.lastSection]}>
          <Pressable style={styles.logOutButton} onPress={handleLogOut}>
            <LogOut size={18} color={theme.colors.danger} />
            <Text style={styles.logOutButtonText}>Log Out</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: 120,
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
    borderColor: 'rgba(192, 192, 192, 0.3)',
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.surfaceNavy,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTextGroup: {
    flex: 1,
  },
  headerCaption: {
    ...theme.typography.caption,
    color: theme.colors.mutedGray,
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
    backgroundColor: theme.colors.surfaceNavy,
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
    backgroundColor: theme.colors.surfaceNavy,
    borderWidth: 1,
    borderColor: 'rgba(192, 192, 192, 0.15)',
  },
  modeCardSelected: {
    backgroundColor: theme.colors.white,
    borderColor: theme.colors.white,
  },
  modeLabel: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.secondarySilver,
  },
  modeLabelSelected: {
    color: theme.colors.primaryNavy,
  },

  // ---- Atmosphere & Radius ----
  card: {
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
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
    borderColor: 'rgba(192, 192, 192, 0.25)',
  },
  chipSelected: {
    backgroundColor: theme.colors.secondarySilver,
    borderColor: theme.colors.secondarySilver,
  },
  chipText: {
    ...theme.typography.medium,
    fontSize: 13,
    color: theme.colors.secondarySilver,
  },
  chipTextSelected: {
    fontFamily: theme.fontFamily.semibold,
    color: theme.colors.primaryNavy,
  },

  // ---- Detailed Profiles ----
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.radius.large,
    backgroundColor: theme.colors.surfaceNavy,
    ...theme.shadows.soft,
  },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.medium,
    backgroundColor: 'rgba(234, 179, 8, 0.12)',
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
    backgroundColor: theme.colors.surfaceNavy,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  toggleLabel: {
    ...theme.typography.medium,
    fontSize: 14,
    color: theme.colors.white,
  },

  // ---- Log Out ----
  logOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    height: 52,
    borderRadius: theme.radius.medium,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  logOutButtonText: {
    ...theme.typography.medium,
    fontFamily: theme.fontFamily.semibold,
    fontSize: 14,
    color: theme.colors.danger,
  },
});
