# CigarLoungeApp

React Native app for discovering cigar lounges — search, maps, reviews, collections,
a travel "passport" feature, and an AI concierge.

## Stack
- React Native 0.86, React 19
- React Navigation (bottom tabs + native stack)
- Firebase (`@react-native-firebase`: app, auth, firestore, storage)
- react-native-maps, react-native-vector-icons, lucide-react-native

## Structure
- `src/screens/` — one file per screen (home, search, map, reviews, passport, concierge, profile, auth, etc.)
- `src/navigation/` — stack/tab navigators per flow
- `src/components/` — shared UI (cards, sheets, filters, ratings)
- `src/services/` — Firebase auth, Firestore lounge data, storage, user actions
- `src/data/` — mock data used before/alongside live Firestore data
- `src/hooks/`, `src/types/`, `src/utils/`, `src/theme/`
- `scripts/seedFirestore.ts` — seeds Firestore from mock data (needs `serviceAccountKey.json`, gitignored)
- `design-reference/` — Figma/design export PDFs for each screen

## Setup notes
- `android/app/google-services.json` and `ios/CigarLoungeApp/GoogleService-Info.plist` are gitignored
  (contain Firebase project config/keys) — get these from Firebase console and place locally before building.
- `serviceAccountKey.json` (Firebase Admin SDK key) is gitignored — required only for `npm run seed:firestore`.

## Session log (Claude Code)
- 2026-07-15: Set up the GitHub remote for this repo — installed/authenticated `gh`,
  fixed a root-owned `~/.config` permissions issue blocking it, added the Firebase
  config files above to `.gitignore` (they were untracked and contained keys), then
  created `rohith-reddy-akepati/cigar-lounge-app` (public) and pushed the existing
  codebase as the initial commit of source.
