# The Reserve — Production Readiness Audit

Date: 2026-08-16
Auditor: automated end-to-end pass (senior full-stack / QA / product-design lens)
Commit audited: `721eea3`

This document records the state of the codebase **before** any changes in this
pass. Findings are ordered by severity. Everything here was verified by running
something — a query, a build, a scan — not by reading code and inferring.

---

## 0. What this application is

| Layer | Technology |
|---|---|
| Client | React Native 0.86 / React 19, New Architecture, iOS + Android |
| Navigation | React Navigation 7 (bottom tabs + native stacks), `headerShown: false` throughout |
| Backend | Firebase Cloud Functions v2 (`onCall`), Node 20, TypeScript |
| Database | Cloud Firestore (`the-reserve-app-c44ed`), 8,285 lounge documents |
| Auth | Firebase Auth (email/password) |
| Web | `owner-portal/` — separate Vite + React + TS app on Firebase Hosting |
| External APIs | Yelp Fusion, Google Places (New), SendGrid, Anthropic (dormant) |

There is **no** REST/GraphQL layer, no SQL, and no ORM. "Endpoints" means
callable Cloud Functions; "queries" means Firestore SDK calls. Sections of the
brief that assume a web stack (SQL injection, N+1 joins, 1440px breakpoints,
keyboard tab-order) are mapped onto their real equivalents and called out where
they do not apply.

---

## P0 — Broken in production

### P0-1 The test suite does not run at all
```
$ npx jest
● Validation Error: Preset @react-native/jest-preset not found.
```
`jest.config.js` names a preset that is not installed; `@react-native/jest-preset`
is absent from `node_modules` while `react-native/jest-preset.js` exists. So the
single existing test (`__tests__/App.test.tsx`) has never executed in this
environment. **The project has zero working test coverage**, not low coverage.

### P0-2 Home's "Member Events" query fails at runtime, silently
Verified against the live database:
```
collectionGroup(events): FAILED -> 9 FAILED_PRECONDITION: The query requires a
COLLECTION_GROUP_ASC index for collection events and field startsAt.
```
Firestore auto-creates single-field indexes at *collection* scope but **not** at
*collection-group* scope. `eventService.getUpcomingEventsAcrossLounges` therefore
throws on every call. The caller catches and sets an empty array, so the rail
renders its empty state forever and no error is ever surfaced — the worst
failure mode: broken, silent, and indistinguishable from "no events yet".

### P0-3 No `firestore.indexes.json` in the repository
Index configuration exists only as whatever was clicked into the Firebase
console. It is not versioned, not reviewable, and not reproducible into another
project. P0-2 is the first symptom; any future composite query is a live
incident waiting to happen.

---

## P1 — Static data still shipping in the app

15 mock modules totalling 1,391 lines remain in `src/data/`. Six are dead
(0 importers) and should be deleted; nine are still live:

| Module | Importers | Status |
|---|---|---|
| `mockConcierge` | 6 | **Live fiction** — curated experiences, tonight's event, luxury experience, saved conversations |
| `mockMap` | 5 | `defaultRegion` — a fixed London coordinate used as the location fallback |
| `mockImages` | 3 | Legitimate — curated photography where no real photo exists |
| `mockAISettings` | 2 | **Live fiction** — `lastRecommendation`, improvement reasons |
| `mockFilters` | 2 | Filter chip vocabulary (now gated by viability — acceptable) |
| `mockSort` | 2 | Sort option labels — acceptable, they drive real sorting |
| `mockTripPlanner` | 2 | Preference chips (real) + `savedConversations` (**fiction**) |
| `mockCollections` | 1 | `collectionCategories` — a fixed category list |
| `mockReviews` | 1 | `detailedRatingCategories` — acceptable, drives real rating writes |
| `mockSearchResults` | 1 | `quickFilterChips` — acceptable, runs real queries |
| `mockSuggestions` | 1 | `cigarBrandSuggestions` — **fiction**, shown as if real suggestions |
| `mockSearch` | 1 | `filterChips` — acceptable |
| `mockFavorites`, `mockHome`, `mockLoungeDetail` | 0 | **Dead code** |

### P1-1 Concierge satellite screens are entirely mock
`ConciergeInspirationScreen`, `ConciergeResultsScreen`, `SavedConversationsScreen`,
`AISettingsScreen`, `AIFeedbackScreen` render invented content. The core chat is
real (`askConcierge` Cloud Function); everything around it is not.

### P1-2 17 `Coming Soon` alerts remain
Buttons that look interactive and do nothing but raise a modal.

### P1-3 `defaultRegion` is a London coordinate used as a global fallback
Map, Search and the filter sheet still sort by distance from `51.509, -0.147`
when no device fix is available, presenting the result as "near you". Home was
fixed in a prior commit; the other three were not.

---

## P2 — Backend

### P2-1 No input validation on three of four callable functions
| Function | Auth | Input validation | try/catch |
|---|---|---|---|
| `refreshCityLounges` | ✅ | city string only | ❌ |
| `sendClaimInquiryEmail` | ✅ | none beyond presence | ❌ |
| `sendReservationEmail` | ✅ | none beyond presence | ❌ |
| `askConcierge` | ✅ | ✅ | ✅ |

Auth is enforced everywhere — good. But an unvalidated `city` reaches an
outbound HTTP call, and email payloads are interpolated into message bodies
without length or shape checks.

### P2-2 Unhandled rejections leak as generic 500s
Three functions have no `try/catch` around external API calls. A Yelp or
SendGrid outage surfaces to the client as `internal` with the raw error
attached to the log — and `HttpsError('internal', ...)` on an uncaught throw
returns a stack-trace-derived message to the caller.

### P2-3 `FROM_EMAIL` is still `no-reply@REPLACE_WITH_REAL_DOMAIN.com`
Both email functions are wired, deployed, and cannot send. SendGrid rejects
unverified senders, so claim inquiries and reservation confirmations fail
silently in production **today**.

### P2-4 Firestore rules coverage is good; one gap
Every collection the client touches has a rule. `isAdmin()` duplicates the email
list from `src/config/admins.ts` by hand — a known, documented drift risk. No
rules tests exist to catch a regression.

### N+1 / raw SQL
Not applicable — no SQL. The Firestore equivalent (`getLoungesByIds` issuing
parallel `getDoc`s) is deliberate and documented; at favorites-list scale it is
correct. `getAllLounges()` reading all 8,285 documents on several screens is the
real performance concern (see P3-4).

---

## P3 — Frontend and design

### P3-1 Accessibility is effectively absent
| Prop | Occurrences |
|---|---|
| `accessibilityLabel` | 1 |
| `accessibilityRole` | 1 |
| `accessibilityHint` | 0 |
| `accessible` | 0 |

Against **277 `<Pressable>`**, **31 `<TextInput>`**, **58 `<Image>`**. Icon-only
buttons (back chevrons, hearts, share) announce as unlabelled to VoiceOver. This
is the single largest quality gap in the app and is App Store review-relevant.

### P3-2 18 screens are missing at least one async state
Loading / error / empty coverage by screen (see the table generated in the fix
pass). Notable: `SearchScreen` and `SearchSuggestionsScreen` have none of the
three; `ProfileScreen` has no loading or error state.

### P3-3 Design system drift
- 53 hardcoded hex colours outside the theme
- 244 `rgba(...)` literals, **48 distinct values**, none named
- 124 numeric padding/margin literals bypassing `theme.spacing`

One design system was intended; in practice there are several.

### P3-4 No responsive/tablet handling
`useWindowDimensions`/`Dimensions.get` appears 4 times in the whole app. Layouts
are fixed-width phone designs. On iPad this renders as a stretched phone UI.
(The brief's 375/768/1440 breakpoints are web; the RN equivalent is phone /
tablet / landscape.)

### P3-5 Form validation is inconsistent
Every form has a double-submit guard — good. But only `SignUpScreen` and
`ClaimListingScreen` do real inline field validation. `WriteReviewScreen`,
`CreateCollectionScreen`, `EditListingScreen`, `EditProfileScreen` submit
whatever is typed.

### P3-6 27 `.then()` chains with no `.catch()`
Each is a potential unhandled rejection warning and a silent failure path.

---

## P4 — Dead code and hygiene

- 6 mock modules with zero importers (~460 lines)
- 4 `TODO`/`FIXME` markers
- `scripts/` contains one-off import/backfill scripts mixed with operational ones
- No CI: no GitHub Actions, no fastlane, no pre-commit hooks

---

## What I will NOT be able to fully verify in this pass

Stated up front so the report is honest:

1. **End-to-end tests on a real device/simulator.** No Detox or Maestro is
   installed. Adding a full E2E harness to a React Native app with native
   Firebase modules requires a signed build and a booted simulator per run;
   that is a multi-day infrastructure task, not a code change. I will instead
   build a runnable integration layer against the real Firestore and document
   the gap precisely.
2. **Cloud Function behaviour end-to-end.** `askConcierge` cannot execute
   without a real `ANTHROPIC_API_KEY`; the email functions cannot send without
   a verified sender domain. Both are blocked on credentials I must not create.
3. **Anything requiring deploy.** I will not deploy functions, rules or indexes
   without the owner present — but I will commit the configuration so a deploy
   is one command.
