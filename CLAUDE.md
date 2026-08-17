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
- `owner-portal/` — separate Vite + React + TS web app, the shop-owner dashboard (login,
  claim status, edit listing) — same Firebase project/Auth/Firestore as the mobile app, deployed
  to its own Hosting site (see Deploys note below). Independent `npm install`/`npm run build`.

## Setup notes
- `android/app/google-services.json` and `ios/CigarLoungeApp/GoogleService-Info.plist` are gitignored
  (contain Firebase project config/keys) — get these from Firebase console and place locally before building.
- `serviceAccountKey.json` (Firebase Admin SDK key) is gitignored — required only for `npm run seed:firestore`.
- `firestore.rules` is the real deployed security boundary (added 2026-08-09) — the Firebase CLI
  isn't installed globally in this environment; use `npx firebase-tools <command>` (e.g.
  `npx firebase-tools deploy --only firestore:rules`) rather than a bare `firebase` command.
- `owner-portal/` deploys to its own Hosting site/target (`owner-portal` → `reserve-owner-portal`,
  configured via `firebase.json`'s hosting array + `.firebaserc`'s `targets`) — deploy with
  `cd owner-portal && npm run build && cd .. && npx firebase-tools deploy --only hosting:owner-portal`.
  This is separate from the default Hosting site (`public/`, the privacy policy) — don't deploy
  `--only hosting` unqualified expecting just one of them, it does both.

## Session log (Claude Code)
- 2026-07-15: Set up the GitHub remote for this repo — installed/authenticated `gh`,
  fixed a root-owned `~/.config` permissions issue blocking it, added the Firebase
  config files above to `.gitignore` (they were untracked and contained keys), then
  created `rohith-reddy-akepati/cigar-lounge-app` (public) and pushed the existing
  codebase as the initial commit of source.
- 2026-08-05: Built the Claim Lounge flow (Dr. Brinkley's top priority from the
  Lounge Locator Feedback meeting) as a two-step flow gated on a real Stripe
  payment: `ClaimListingScreen.tsx` (step 1, business info) now hands off to new
  `ClaimListingPaymentScreen.tsx` (step 2, $49 verification fee via Stripe's
  PaymentSheet). Added Cloud Function `createClaimPaymentIntent` in
  `functions/src/index.ts` to create the PaymentIntent server-side; Firestore
  claim (`ownerService.claimLounge`, now requires `paymentIntentId`) is only
  written after Stripe confirms the charge succeeded. Added
  `@stripe/stripe-react-native` (native dep, `pod install` + full rebuild done,
  verified boots clean) and `src/config/stripe.ts` for the publishable key.
  Both Stripe keys are currently placeholders (same "build real, flip on with
  real keys later" pattern as `YELP_API_KEY`) — **blocked on Rohith creating a
  real Stripe account** and providing the real publishable key (client config)
  and secret key (`firebase functions:secrets:set STRIPE_SECRET_KEY`, run by
  him, never pasted into chat). The $49 fee is a placeholder pending real
  pricing confirmation with Dr. Brinkley/Lakhan.
- 2026-08-07: Reworked the Claim Lounge flow per Rohith's request to go
  design-lead-level: payment now only submits a claim (`claimStatus: 'pending'`,
  `claimantUserId`) instead of granting instant ownership — added
  `ownerService.getPendingClaims`/`approveLoungeClaim`/`rejectLoungeClaim`,
  a `ClaimSubmittedScreen` (replacing an `Alert.alert` success message with a
  real "under review" screen), and an admin-only `AdminClaimReviewScreen`
  (reached from Profile, gated by `src/config/admins.ts`'s `ADMIN_EMAILS`).
  `EditListingScreen` turned out to already exist from earlier in the project.
  Also drafted (as a claude.ai Artifact, not yet built) a concept mockup of a
  separate web Owner Portal for Dr. Brinkley's review, using the app's real
  Playfair Display + Inter brand fonts — distinct from the in-app admin
  claim-review screen above (owner-facing vs. admin-facing).
- 2026-08-09: Firebase emailed that the project's default Firestore "test
  mode" rules (wide open) were expiring in 3 days, which would have denied
  every client request once they did. Wrote real `firestore.rules` covering
  every collection/write the app's `src/services/*.ts` actually performs
  (lounges, reviews, users and all its subcollections, the claim/approve/
  reject paths, cross-user notification writes) and deployed it via
  `npx firebase-tools deploy --only firestore:rules` (the `firebase` CLI
  isn't installed globally in this environment — see Setup notes above).
  `isAdmin()` in the rules mirrors `src/config/admins.ts`'s email list by
  hand, since rules can't import app code — keep both in sync when adding
  admins. Updated stale comments in `ownerService.ts`/`AdminClaimReviewScreen.tsx`/
  `admins.ts` that previously documented "no firestore.rules file exists yet"
  as their trust model.
- 2026-08-10: Ran a full functional sweep of the app per Julian's "make sure
  it's functional or operational" mandate — fixed dead navigation (Notifications/
  Voice Search were navigating to a screen name that doesn't exist at their
  level in the nav tree), wired the Home screen's still-fake "Reserve a Table"
  button to the real flow, rebuilt `RatingsBreakdownScreen` to take a `loungeId`
  param and show real per-lounge data (computing star distribution from actual
  reviews) instead of hardcoded numbers regardless of which lounge you came
  from, made "Report Issue" actually persist (`users/{userId}/issueReports`)
  instead of faking a success message, added error/retry states + validation to
  Edit Listing and Admin Claim Review, and added keyboard avoidance + a
  double-submit guard to several forms. Deliberately left the AI Concierge,
  Trip Planner, weather widget, and social sign-in buttons alone — all
  genuinely mock/unbuilt and out of scope for a quick pass.
- 2026-08-10: Julian replied in the team chat with two changes: (1) use Yelp
  **and** Google Places together, each fills the other's gaps (Google gives
  real structured hours cheaply; Yelp has no hours without a paid Business
  Details call — see functions/src/index.ts's `refreshCityLounges`, which now
  fetches both and merges by name+distance match, adding Google-only results
  as new `google-<place_id>` docs); (2) **Claim Business has no in-app
  payment** — the real plan is $399/month with a free 43" kiosk for the
  subscription's life, closed by a human sales rep, not Stripe. Removed Stripe
  entirely (native dep uninstalled + `pod install`, `createClaimPaymentIntent`
  function deleted, `src/config/stripe.ts` deleted). `ClaimListingScreen` is
  now a single-step inquiry form (pricing card + contact info) that still
  creates a `claimStatus: 'pending'` claim for admin review (unchanged) and
  separately emails sales via new function `sendClaimInquiryEmail`. Both new
  functions need real credentials before they do anything for real —
  `GOOGLE_PLACES_API_KEY` and `SENDGRID_API_KEY` are placeholder secrets (same
  pattern as `YELP_API_KEY`), and `sendClaimInquiryEmail`'s destination
  address is a placeholder (`SALES_INQUIRY_EMAIL` in `functions/src/index.ts`)
  pending Julian's reply on which real inbox to use.
- 2026-08-10: Built and deployed the shop-owner web dashboard (`owner-portal/`)
  rather than wait idle on Julian confirming the concept mockup sent earlier —
  matches that concept closely (same navy/gold brand, same Playfair Display +
  Inter font pairing) so a rework should be small if he wants changes. New
  Vite + React + TS app, own `package.json`. Registered a Firebase Web app
  (`Owner Portal`, in the same `the-reserve-app-c44ed` project) to get the
  public web SDK config — real access control is still firestore.rules, not
  this key. Three pages: Login (Firebase Auth email/password — same accounts
  as the mobile app), Dashboard (queries lounges by `claimantUserId`, shows a
  Pending/Approved pill), Edit Listing (same fields/rule-path as the mobile
  app's `EditListingScreen`/`isOwnListingEdit` — no separate backend logic
  needed). Deployed to its own Hosting site `reserve-owner-portal` (see Setup
  notes above for the deploy command) — live at
  https://reserve-owner-portal.web.app. Verified serving correctly (200s on
  HTML/JS/fonts) but not click-tested end-to-end in a real browser yet.
- 2026-08-16: Made the Cigar Passport real. It had been the most mock part of
  the app — Lounges Visited / States Explored / Miles Traveled / Check-ins all
  read a placeholder "Soon", every "Exploration Stat" tile was "Soon", Journey
  Highlights were three hardcoded rows, and the Travel Timeline was a fixed
  list of invented trips (Rome, Mayfair) that every member saw identically.
  All of it was blocked on the same missing thing: a record of which lounges a
  member had actually been to. That record already existed — `ReviewDocument`
  carries a `visitDate` the member picks themselves in `WriteReviewScreen`,
  which is a first-hand "I was here on this day". **Treating a review as a
  visit made the whole section real with no new feature, no new collection,
  no new Firestore index and nothing extra for a member to learn.**
  New `src/utils/passport.ts` (pure — `buildPassport`, `groupVisitsByRecency`,
  `suggestNextLounge`, Monday-based week streak, `regionOf` state parsing from
  "City, ST") and `src/services/passportService.ts` (`getPassport(userId)`,
  one call assembling reviews + lounge docs + home-city coordinates, also
  returning `visitedLounges` so JourneyMap needs no second round trip).
  Distances are anchored to the member's profile home city via new
  `findCityCoordinates()` in `cityAutocomplete.ts` — when the home city isn't
  recognized every distance is deliberately `null` ("—") rather than computed
  from a guessed origin, which would invent travel the member never did.
  `PassportScreen` stat grids, exploration stats and Journey Highlights are
  now derived; `TravelTimelineScreen` renders real visits grouped Today /
  Yesterday / Earlier this Month / month name, each card tapping through to
  the lounge; `JourneyMap` now pins lounges actually **visited** (falling back
  to favorites only when there are no visits yet) instead of favorites always.
  Dropped the tags/tiles that could never be real: "14°C" (no weather data
  anywhere in the app), "Business Trip"/"Road Trip"/"Vacation Visit" (no
  concept of a visit type). Deleted `src/data/mockPassport.ts` entirely — its
  last live export, `StatCard`, moved into `src/utils/passport.ts`. Typecheck,
  ESLint and a full Metro bundle all clean.
- 2026-08-16 (night): Autonomous pass over the remaining "Coming Soon"
  features, per Rohith's "finish everything while I'm out". Five commits:
  * **Home** — Cigar of the Week was one hardcoded cigar shown every week
    forever; new `src/data/cigars.ts` is 30 real cigars with real wrapper/
    strength/burn time, picked by a Monday-based week index (same member
    sees the same cigar that week, turns over predictably, no cron).
    Member Events showed two invented events; owners could already post
    real ones from the Owner Portal and nothing read them across lounges —
    added `eventService.getUpcomingEventsAcrossLounges` (one collectionGroup
    query) plus the matching collection-group READ rule (writes stay on the
    per-lounge path). The per-event "+" promised members could add events,
    which the rules forbid — rows now open the lounge. The FAB is a real
    quick-actions sheet.
  * **AI Concierge** — was the largest mock surface: every reply a hardcoded
    string, chat pre-loaded with an invented Mayfair exchange. Now a real
    `askConcierge` Cloud Function (**never in the app — an Anthropic key in
    a RN bundle is a published key**) using `claude-opus-5` at low effort.
    Grounded: the function pulls real candidate lounges from Firestore and
    asks Claude to recommend *from that list only*, returning ids, via a
    json_schema structured output; ids are filtered against what we offered
    before reaching the UI, so a recommendation always opens a real lounge.
    Thinking stays on — disabling it on Opus 5 can leak `<thinking>` tags
    into the visible reply. `ANTHROPIC_API_KEY` is a **placeholder secret**
    (same dormant pattern as YELP/GOOGLE_PLACES) — fully built, needs the
    real key to switch on.
  * **Trip Planner** — was a prefilled London→Edinburgh route with invented
    stopovers. New `src/utils/routePlanner.ts` finds lounges inside a
    corridor around the line between two real cities, spaced along the
    journey. Deliberately a great-circle corridor, not driving directions
    (that needs a paid API + Julian's call), so the UI says "12 mi from
    start / on your route" instead of the mock's fake "ETA: 11:30 AM".
  * **Travel Wishlist header** — "European Grand Tour" etc. replaced by
    `src/utils/wishlist.ts`, derived from the member's own saved lounges.
    `src/data/mockWishlist.ts` deleted.
  * **Search's Featured Travel Guide** — fixed "Traveling to Nashville?"
    replaced by the best-covered real city with its real lounge count; the
    button runs a real search.
  Deleted: `mockWishlist.ts`, the invented route in `mockTripPlanner.ts`,
  the travel-guide block in `mockSearch.ts`. Typecheck, ESLint (0 errors)
  and a full Metro bundle clean at every commit.
  **Still blocked, not done:** social sign-in (Google/Apple) needs OAuth
  client IDs from the Firebase console and an Apple Sign In capability on
  the provisioning profile — neither obtainable from here. Concierge
  Inspiration/Results/SavedConversations and the AI Settings toggles are
  still mock (they hang off the concierge feature set, not data wiring).
- 2026-08-17: Performance, the owner flow, and the black/gold rebrand.
  * **Every tab was downloading all 8,294 lounges.** `getAllLounges` fetched
    the whole collection (~6.8 MB, 7.4s wired) and nine call sites across five
    tabs called it; SearchScreen's four loaders each re-fetched, ~33k doc reads
    per tap. Fixed with `src/utils/asyncCache.ts` (TTL + **in-flight
    de-duplication** — the dedup is what fixes Search, since all four loaders
    miss before any resolves) and `src/utils/geoQuery.ts` (Firestore can range
    one field, so narrow to a latitude band server-side and finish the circle
    in JS). Home/Map 8,294 -> 961 docs; Search reads one pre-computed doc
    (`aggregates/cityStats`, built by `npm run build:city-stats` — **re-run it
    after any import that adds lounges** or the city counts drift).
    `getLoungesNear` escalates 60 -> 180 -> 480 -> 500mi rather than falling
    back to a full scan. MapScreen capped at 150 markers (it was mounting a
    native view per lounge).
  * **Claim flow: approval was silent and irreversible.** Added
    `claim_approved`/`claim_rejected`/`ownership_revoked` notifications,
    `MyShopsScreen` (the only route to the long-existing EditListingScreen),
    and `revokeLoungeOwnership` — approval used to delete `claimStatus`, the
    field getPendingClaims filters on, so an approved lounge fell off the admin
    screen forever. `rejectLoungeClaim` never cleared `ownerId`; the claim
    fields are now one shared `CLAIM_FIELDS` constant so that can't recur.
    Claim notification types are **admin-only in firestore.rules** — a member
    able to forge "your business has been approved" is a ready-made scam.
  * **New `rules` jest project**: `npm run test:rules` runs firestore.rules
    against the real engine in the Firestore emulator (needs Java). 24 cases.
    Excluded from `test:all`, which needs credentials rather than an emulator.
  * **Theme is now black/gold/silver**, per Dr. Brinkley ("only the theme, logo
    and theme"). Values sampled from `design-reference/kiosk-v1/`:
    background `#0a0a0c`, surface `#18181c`, gold `#c8a868`. Silver `#c0c0c0`
    unchanged — it's already the logo's silver. `primaryNavy`/`surfaceNavy`
    renamed to `primaryBlack`/`surface`. **The palette was previously
    unchangeable in practice**: 93 translucent shades were hand-written as raw
    `rgba(...)` literals across 61 files, so `withAlpha(token, opacity)` now
    exists and every one goes through it. Login/SignUp/ForgotPassword had no
    theme import at all before this. owner-portal repointed to match.
  * **App icon** regenerated from the Lounge Locator logo —
    `design-reference/logo/` holds the source and `make-app-icon.swift`, which
    handles the baked border/corners iOS would otherwise clip. See that
    folder's README before touching the icon.
  * **Not done, deliberately:** primary buttons are still white-on-black (the
    kiosk design uses gold; it changes hierarchy everywhere, so it wants a
    look first), and MapScreen's `userInterfaceStyle="dark"` does **not** work
    — the map renders light even on a dark device, and the header comment
    claiming otherwise is wrong. Much more visible against black than navy.
  * The kiosk V1 designs are for an **in-shop 43" kiosk**, a separate product
    (attract loop, "Start Over" session model, QR send-to-phone, staff
    assistance, live humidor stock) — not a restyle of this app.
