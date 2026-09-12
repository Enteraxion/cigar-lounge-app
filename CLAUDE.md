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
- 2026-08-19: Reworked the 21+ ID upload from "upload a photo of your ID"
  into a real two-step document flow, per Rohith's ask to design it "like a
  pro" with passport/driving licence/state ID and front-and-back. New
  `src/utils/idDocument.ts` owns which sides each document needs (cards need
  both — DOB on the front, security features on the back; a passport needs
  only its photo page) and `src/components/IdDocumentCapture.tsx` is the
  shared capture UI used by both the post-sign-up wall and the voluntary
  Profile route. Frames are drawn at the documents' true proportions (ID-1
  85.6x54, passport data page 125x88) with viewfinder corner marks.
  **Photos are held locally until every required side is in hand, then
  uploaded together** — uploading each side as taken would write a record
  missing a side, which is exactly what the app gate refuses, pinning the
  member at the wall with our own half-written record. `deriveAgeGateState`
  now tests *completeness* rather than "an image exists"; a record with no
  `documentType` counts as complete so accounts that verified before this
  existed are not sent back through it. Sides already on file are reused when
  the document is unchanged, so a member told "the back was blurry" retakes
  only the back. `attachIdImage` became `attachIdDocument`, which clears the
  previous decision (making a rejection recoverable) and clears a stale back
  image when switching to a passport. AdminAgeReviewScreen stacks and labels
  each side and will not approve an incomplete submission. **firestore.rules
  and storage.rules needed no change** — verified against the emulator,
  including a member attaching both sides with `status: 'verified'` smuggled
  alongside (still refused). Also surfaced the cigar/hookah/THC filter that
  was already built but collapsed three taps deep in the Filter sheet: it is
  now a chip row on SearchResultsScreen writing into the same
  `appliedFilters.loungeTypes`, and the sheet's section opens by default.
  Verified by driving the running simulator: step 1 picker, two-sided State
  ID capture, single-page passport capture, and the legacy "currently on
  file" block all render. tsc clean, ESLint 0 errors, 241 unit tests, 34
  rules tests, production iOS bundle clean.
- 2026-08-21/22: Built the admin portal (`admin-portal/`, live at
  https://reserve-admin-portal.web.app) and took admin out of the members' app.
  Seven sections: Dashboard, Approvals (ID verifications, business claims,
  claimed listings), Lounges, Members, Reports, Reviews, Operations. Same stack
  and stylesheet as `owner-portal/`, own Hosting target `reserve-admin-portal`.
  Deleted `AdminAgeReviewScreen`, `AdminClaimReviewScreen` and
  `src/config/admins.ts` from the app — that last one shipped the admin's email
  address inside every member's bundle, readable from a downloaded build
  (verified afterwards: 0 occurrences in a production bundle). MyShops and
  EditListing deliberately stay in the app; they are owner-facing.
  New admin-only Cloud Functions: `adminDeleteMember` (Auth + Firestore +
  Storage, in that order — Auth last because it is the only thing that makes a
  uid findable), `adminBackfillCities`, `adminRebuildCityStats`.
  `firestore.rules` gained an admin read plus a collection-group read for
  `users/{uid}/issueReports`, which the app had been writing since 2026-08-10
  and **nothing had ever read**.
  * **The directory was never US-only.** Reported to Julian as such on 08-20 and
    that was wrong: 408 international lounges across 43 cities — Berlin 166,
    London 92, Munich 35, Toronto 33 — Germany, the UK and Canada. 344 came from
    the Yelp import with city values intact, invisible only because Yelp's region
    codes ("Berlin, BE", "Munich, BY") were unrecognisable in the city list. The
    other 64 were Google-sourced with **no `city` field at all**, which was true
    of all 3,328 Google documents — 39% of the directory absent from every city
    search. Backfilled `city` on all 3,328 by parsing the address (no API calls,
    no cost; took four passes to reach 100% — US-only regex, then international,
    then an optional leading comma for addresses with no street part, then a
    district-chain rule for "München-Altstadt-Lehel"). Then normalised all 408
    international labels from region codes to country names, because the backfill
    had used "City, Country" while Yelp used codes and the same city was
    appearing two or three times in search. 2,017 cities in the index now.
  * **`refreshCityLounges` was silently wiping owner edits.** It writes with
    `merge: true`, which only protects fields the incoming object does not
    mention — and both builders mentioned four of the five fields
    `isOwnListingEdit` lets an owner change, as empty values (`description: ''`,
    `amenities: []`, `humidorItems: []`, `priceRange: ''`). So a refresh of a
    city blanked whatever its owners had filled in; `humidorItems` is only ever
    populated by an owner, so the import could only ever destroy it. Latent (3
    claimed lounges, no refresh since) but very hard to diagnose after the fact.
    Fixed: those fields are no longer written at all, `hours` is written only
    when real, and real-but-owner-editable data (Yelp price tier, Google
    amenities) is withheld from claimed lounges — which needed one `getAll` per
    city to know who is claimed.
  * Found while measuring, and corrected in TEST-REPORT.md: **4,163 lounges have
    no photograph** (only 20 of 3,328 Google documents do). The original report
    marked this PASS because it queried `imageUrl`; the field is `images`.
  * Still open: phone absent on all 8,496 and 5,080 placeholder hours, both
    fixed by `npm run backfill:google -- --confirm` (~$192, Julian approved
    Google over Yelp at $299/month); `GOOGLE_PLACES_API_KEY` is still a
    placeholder secret so Operations cannot run it from the portal yet. Reviews
    cannot be deleted from the portal — the rules only permit a review's author,
    and widening that is a deliberate decision not yet taken.
- 2026-08-23/31: QA's eight bugs, verification by code, the App Store pass,
  and the move to Azure OpenAI. The through-line of the week: several features
  had been **written but never read** — the code ran, nothing consumed it.
  * **Deepak's eight QA bugs, all cleared.** The worst two were both "the read
    was never built": reservations were written to `lounges/{id}/reservations`
    and shown in the Owner Portal, but the member who booked could not see their
    own booking anywhere (new `MyReservationsScreen` + `getMyReservations`), and
    collections could be created but never renamed, deleted, or emptied — the
    rules had always permitted all three, there was simply no caller. The
    blocker: **every Search filter chip navigates with no query**, which meant
    `getAllLounges()` — 8,496 docs — then a card AND a native map marker per
    result. Now a bounded radius, 30 at a time, markers capped at 150 (MapScreen
    was capped in August for this exact reason; this screen has its own MapView
    and was missed).
  * **Found while investigating, worse than what QA reported:** the admin
    portal's `adminRebuildCityStats` wrote `{city, count, image}` against an app
    reading `{id, name, count, imageUri}`. It type-checked, linted and deployed
    clean — and every one of the 2,017 cities on the Search tab rendered as the
    literal word **"undefined"** for a day. Reader now accepts both shapes and
    DROPS an entry it cannot name; `normalizeCityStats` is extracted and tested
    (4 of 6 tests fail against the old reader). **The portal is a separate
    tsconfig project, so nothing type-checks its idea of a document against the
    app's** — this bit twice in a week (see issueReports below). Copy types from
    `src/types/firestore.ts`; do not write down what a field ought to be called.
  * **Email verification is a 6-digit code now, not a link** — and so is password
    reset. Firebase has no email-OTP, so both are Cloud Functions that email a
    code and then set Firebase's own `emailVerified` (or password), which is why
    the 46 app files, 16 rules checks and both portals needed no changes. The
    reset endpoints are **unauthenticated by nature**, so they answer identically
    for a known and unknown address (enumeration), and rate-limit per address AND
    per IP. Codes are hashed, uid-salted, 5 attempts, 10 minutes, and
    `firestore.rules` denies both code collections to everyone including admins —
    a leaked hash of a 6-digit secret is instantly brute-forced, so the attempt
    limit IS the defence. 55 rules tests.
  * **`FROM_EMAIL` had been the string `no-reply@REPLACE_WITH_REAL_DOMAIN.com`
    since 2026-08-10**, so no email function in this project had ever sent.
    `sendClaimInquiryEmail` had been failing silently for three weeks; claims were
    saved, sales were never told. Sarthad added five SendGrid CNAMEs to GoDaddy;
    `enteraxion.com` is domain-authenticated and everything sends from
    `no-reply@enteraxion.com`. **Do not add the `_dmarc` TXT SendGrid also
    lists** — one already exists and a second breaks DMARC for the whole company.
  * **App Store pass.** Built in-app account deletion (Apple 5.1.1(v), a certain
    rejection without it) — which exposed that `adminDeleteMember` was itself
    incomplete, leaving members' names, review text and phone numbers across the
    directory; both now share `purgeMember`. iPad support withdrawn
    (`TARGETED_DEVICE_FAMILY` was "1,2" with no screen designed for it). **The
    cannabis type was deleted after measuring it**: 34 of 8,496, not one from a
    real category — all name-guesses, and mostly wrong ("Kush Cigar House" is a
    cigar shop). Removing it fixed 26 misclassifications AND cleared guideline
    1.4.3. Every "Coming Soon" dialog is gone. Privacy policy rewritten — it
    predated the ID feature and described no identity documents at all — and
    terms of service written from scratch; both linked from Settings and at
    sign-up. Build 6 archived.
  * **The AI Concierge is live, on Azure OpenAI.** It sat switched off from
    2026-08-18 waiting on an Anthropic key that needed a new vendor and a budget
    approval; Abhilash pointed out the company already runs Azure OpenAI on a
    funded account. Endpoint `https://lounge-locator-ai.openai.azure.com/`,
    deployment **`gpt-4.1-mini`** (Azure refuses new `gpt-4o-mini` deployments —
    ServiceModelDeprecating), key in `AZURE_OPENAI_API_KEY`. Only the API call
    changed: the grounding — real candidates from Firestore, model constrained to
    that list, returned ids filtered against what was offered — is
    provider-agnostic. Verified live: a Houston question returned two real
    Houston lounges. **Azure access lives in Dr. Brinkley's tenant
    (`julianlbrinkleyyahoo.onmicrosoft.com`); Sarthak can grant it.** Note that
    Azure directory membership and role assignment are separate — a role
    assigned to someone not yet invited into the directory does nothing, and the
    portal does not warn you.
  * **Where the Concierge lives:** the Search tab, under the search bar. It was
    on the Map (too hidden), then the top of Home, then the bottom of Home, and
    looked wrong in all three — Home is a browsing surface and a text input has
    nothing to do with what surrounds it. Search is where someone has already
    decided they are looking. It also stopped presenting itself as **a person
    called "Julian Rossi" with a stock portrait**; it is software, and that gets
    more misleading the better the answers get.
  * **`users/{uid}/issueReports` were unreadable in the portal** for the same
    invented-shape reason (`message`/`subject` vs the app's `description`), and
    "Mark resolved" had never worked — read was granted to admins, write was not.
  * Fixed too: the Map showed a Nebraska lounge while centred on Texas (two
    queries in flight, the slower one from the default US-centre viewport landing
    last — now a request token); LoungeDetail never refetched, so a submitted
    claim still offered "Claim this business"; seven form screens had their
    bottom hidden by the floating tab bar; the splash logo sat as a visible box
    (the supplied PNG has **no alpha** and its black corners baked in — do not
    try to flood-fill it, it eats the badge; match the screen instead).
  * **Still open:** AI-based ID verification (Julian asked 2026-08-25, reversing
    the 2026-08-19 "stays manual" decision) — `src/utils/idBarcode.ts` is built
    and tested but unwired, and the plan is barcode + vision cross-check with
    auto-approve only on full agreement, everything else to the existing manual
    queue. **The privacy policy says "no third party sees them" and must be
    updated before that ships.** Also open: the Google Places backfill (~$192,
    phone absent on all 8,496, 5,080 placeholder hours, 4,163 no photo), social
    sign-in OAuth, and the four mock Concierge screens (Inspiration, Results,
    Saved Conversations, Trip Planner) which nothing routes to.
- 2026-08-31 (night): Tab bar polish, and the AI ID review's first live run.
  * **The floating tab bar is translucent now** (`floatingTabBarStyle` in
    `MainNavigator.tsx`), after Rohith compared it to Instagram's. Alpha, not a
    blur — a real blur means a native lib, a pod install and a rebuild, and on a
    background this dark the gain is small. 0.82 deliberately: much lower and the
    icons compete with what scrolls under them. A hairline border came with it,
    or the pill's edge dissolves over dark content. **Shrink-on-scroll — the bit
    he actually noticed — is NOT done**: custom tab bar + Reanimated + scroll
    position out of all five tabs, and it can wait until after submission.
  * **"Awaiting review" on his phone was not a bug in the review.** The function
    works — three real decisions the same night (approve, refer, reject). Two
    other things were true. First, **the installed Debug build was running JS
    baked on 24 August** and was not reaching Metro, so `reviewIdDocument`
    (shipped that day) was not in the bundle at all: `grep -ac` gave 0 against 2
    for `attachIdDocument`, and the function log had no call at the submission's
    timestamp. Rebuilt and reinstalled; the fresh bundle greps 1. **Grep the
    installed `main.jsbundle` for the symbol before believing a device report** —
    a Debug build carries a fallback bundle and runs stale JS silently.
  * Second, and still open: **a mistyped date of birth cannot be corrected by
    anyone.** His account declares `2001-09-08`, his licence prints `08/27/2001`;
    `reviewDocument` refers a mismatch rather than rejecting it (usually a typo,
    and auto-rejecting an honest member is worse), so the screen stays on
    "Awaiting review" — correct behaviour that reads exactly like a hang.
    `dateOfBirth` is written once at sign-up and only ever displayed
    (`AgeVerificationScreen.tsx:138`); no app screen and no admin-portal field
    edits it. So a typo means a permanent referral, every resubmission. Invisible
    before this, because everything went to a human anyway. Needs either a
    member-facing correction at resubmit or an admin edit — not yet decided.
  * 5 pending submissions, 3 stale (`test@`, `qa@`, Julian's, 24-26 Aug) with no
    `documentType` — they predate the two-sided flow, so the automated review
    cannot act on them and they need clearing by hand.
- 2026-09-01: The ID review learned to explain itself, and to check in the
  right order. Two commits after the first live run.
  * **Every failure now names itself and says what will fix it.** A referral
    used to write nothing at all, so "we read your document and want a second
    opinion", "Azure rejected our key" and "this code is not deployed" all
    produced the identical "Awaiting review" card — which is exactly why the
    stale bundle went unnoticed. Each outcome now carries a member-facing
    sentence AND a named remedy, stored separately in
    `ageVerification.resolution` because they disagree more often than you would
    expect: "we have no date of birth on your account" is a problem with the
    account, not the photograph, and offering that member the camera points them
    at the wrong thing. Values are `retake`, `fix_date_of_birth`, `none`.
  * **A mistyped date of birth is fixable now** — `updateDeclaredDateOfBirth`
    writes the corrected date, requeues to `pending` and re-runs the review
    against the photographs already on file, so nothing is retaken. The rules
    always permitted a member to move their own record TO pending (never to
    `verified`); two new rules tests pin that, including the abuse of sending
    the correction and the verdict together. 57 rules tests.
  * **Order of checks matters and was wrong.** Rohith spotted it: the mismatch
    was compared before the age, so an under-21 document whose date disagreed
    with the account was answered with "correct your date of birth" — inviting
    someone we were about to refuse to adjust their answer. Everything that
    disqualifies the document now runs first (readable, in date, 21+), and only
    then is the account reconciled. That ordering is what makes the date field
    safe to expose at all.
  * The date we read is **never quoted back** — the member can read their own
    document, and echoing our OCR is free calibration for a borrowed ID.
  * Also corrected two statements that had stopped being true: the sign-up wall
    said "Reviewed by a person on our team" and promised a browse "while our
    team checks it".
  * `DateOfBirthFields` extracted to `src/components/`. **SignUpScreen still has
    its own copy on purpose** — highest-risk screen in the app, days before
    submission; whoever is next in there with time should adopt the shared one.
- 2026-09-12: The Concierge keyboard, and teaching it what it is for.
  * **"The keyboard is not opening" was two bugs, and the first was layout.**
    `ConciergeConversationScreen`'s ScrollView had no `style` prop, only
    `contentContainerStyle`, so it sized to its CONTENT inside a flex column:
    an empty conversation left the input bar jammed under the header, and a long
    one pushed it off the bottom of the screen. Tapping where the input should be
    hit nothing. **`flex: 1` on a ScrollView in a flex column is load-bearing.**
  * **KeyboardAvoidingView cannot fix this screen** — established over two failed
    attempts. It measures its own frame RELATIVE TO ITS PARENT and compares that
    against keyboard coordinates in ABSOLUTE SCREEN SPACE; the Concierge is
    presented as a modal, so those are different coordinate systems and the
    computed inset is zero. Wrapping the bar failed; wrapping the whole screen
    failed identically. It now listens to `keyboardWillShow`/`WillHide` and pads
    the flex column by the reported height minus `insets.bottom` — absolute, no
    frame of reference to reconcile. `will` not `did`, so the bar travels with
    the keyboard. Dropped `automaticallyAdjustKeyboardInsets` here or the
    keyboard is compensated for twice.
  * **The Concierge answered everything, and the app not at all.** Its prompt
    gave it two jobs — recommend from the candidate list, or answer cigar
    knowledge — so "how do I claim my business?" matched neither and it
    recommended lounges instead. It now carries the app's real facts (claiming,
    reserving, verification, reviews, collections, Passport) and, separately, a
    hard scope: lounges, cigars, and this app. The line doing the work is
    **"that includes questions you could easily answer"** — without it a model
    reads a description of its expertise as a description of its *limits* and
    still explains Java, because it can. Pricing is deliberately NOT in the
    prompt: an AI quoting $399/month is a commitment that outlives the price.
  * Also written this week: a full technical handover for Abhilash
    (`~/Desktop/Lounge-Locator-Handover.docx`, ~10k words) and a short personal
    overview. **43 commits were still unpushed when they were written** — that
    remains the single biggest risk to this project.
