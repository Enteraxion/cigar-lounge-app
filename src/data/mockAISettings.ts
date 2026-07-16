/**
 * Mock data for AISettingsScreen and AIFeedbackScreen — matches
 * design-reference/Settings & AI Feedback.pdf. Photography pulled from
 * src/data/mockImages.ts (there is no bundled assets/images/lounges/ set
 * in this project — see mockImages.ts for why). No backend/real AI
 * personalization wired up yet.
 */

import { loungeInteriors } from './mockImages';

export type ExperienceMode = {
  id: 'business' | 'vacation';
  label: string;
};

export const experienceModes: ExperienceMode[] = [
  { id: 'business', label: 'Business' },
  { id: 'vacation', label: 'Vacation' },
];

export const defaultExperienceMode: ExperienceMode['id'] = 'business';

export const defaultMaxTravelDistance = 25;

export type AtmosphereOption = {
  id: string;
  label: string;
};

export const atmosphereOptions: AtmosphereOption[] = [
  { id: 'lively-jazz', label: 'Lively Jazz' },
  { id: 'quiet-study', label: 'Quiet Study' },
  { id: 'rooftop', label: 'Rooftop' },
  { id: 'classic-pub', label: 'Classic Pub' },
];

export const defaultSelectedAtmosphereIds = ['lively-jazz'];

export const detailedProfiles = {
  cigarBrands: 'Padrón, Davidoff, Arturo Fuente',
  favoriteDrinks: 'Single Malt, Old Fashioned',
};

export const defaultSystemPreferences = {
  accessibilityMode: false,
  loungeAlerts: true,
};

export const lastRecommendation = {
  loungeName: 'Heritage Oak Room',
  image: loungeInteriors[0],
};

export type ImprovementReason = {
  id: string;
  label: string;
};

export const improvementReasons: ImprovementReason[] = [
  { id: 'wrong-vibe', label: 'Wrong Vibe' },
  { id: 'too-expensive', label: 'Too Expensive' },
  { id: 'too-far-away', label: 'Too Far Away' },
  { id: 'out-of-stock', label: 'Out of Stock' },
];
