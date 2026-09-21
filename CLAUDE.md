# CigarLoungeApp

React Native app for discovering cigar lounges — search, maps, reviews, collections,
a travel "passport" feature, and an AI concierge. **Also builds for the browser**
from the same `src/` (see Web build below).

## Stack
- React Native 0.86, React 19. Bare CLI, **not Expo** — four native modules
  (Firebase, maps, document scanner, voice) would have meant ejecting anyway.
- TypeScript 5.8 throughout, strict, including `functions/` and both portals.
- React Navigation (bottom tabs + native stack)
- Firebase (`@react-native-firebase`: app, auth, firestore, storage)
- react-native-maps, react-native-vector-icons, lucide-react-native
- Web: Vite 8 + react-native-web 0.21

## Structure
- `src/screens/` — one file per screen (home, search, map, reviews, passport, concierge, profile, auth, etc.)
- `src/navigation/` — stack/tab navigators per flow
- `src/components/` — shared UI (cards, sheets, filters, ratings)
- `src/services/` — Firebase auth, Firestore lounge data, storage, user actions
- `src/data/` — mock data used before/alongside live Firestore data
- `src/hooks/`, `src/types/`, `src/utils/`, `src/theme/`
- `scripts/` — one-off admin tasks against Firestore, all needing the gitignored
  `serviceAccountKey.json`: `importYelpLounges`, `backfillFromGoogle`, `buildCityStats`,
  `createAdmin`, `createReviewerAccount`. (`seedFirestore.ts` was deleted 2026-09-15 — it
  seeded ~17 invented lounges and the directory now holds 8,513 real ones.)
- `src/web/` — everything the browser build needs and the phone build never sees:
  `shims/` (one module per native dependency), `fonts.css`, the Vite env types.
  Nothing outside `src/web/` imports from it; the Vite aliases do the wiring.
- `docs/session-log.md` — the July–early-September history moved out of this file.
- `design-reference/` — Figma/design export PDFs for each screen
- `owner-portal/` — separate Vite + React + TS web app, the shop-owner dashboard (login,
  claim status, edit listing) — same Firebase project/Auth/Firestore as the mobile app, deployed
  to its own Hosting site (see Deploys note below). Independent `npm install`/`npm run build`.

## Setup notes
- `android/app/google-services.json` and `ios/CigarLoungeApp/GoogleService-Info.plist` are gitignored
  (contain Firebase project config/keys) — get these from Firebase console and place locally before building.
- `serviceAccountKey.json` (Firebase Admin SDK key) is gitignored — required by every
  script in `scripts/`, none of which run without it.
- `.env.local` is gitignored (added 2026-09-20; it was not, and `git add -A` would have
  swept it in). Holds `VITE_FIREBASE_VAPID_KEY` and `VITE_GOOGLE_MAPS_KEY`. Both are
  public by design — a `VITE_` value is compiled into the bundle — but keys live here,
  so keep it out of the repository.
- `firestore.rules` is the real deployed security boundary (added 2026-08-09) — the Firebase CLI
  isn't installed globally in this environment; use `npx firebase-tools <command>` (e.g.
  `npx firebase-tools deploy --only firestore:rules`) rather than a bare `firebase` command.
- `owner-portal/` deploys to its own Hosting site/target (`owner-portal` → `reserve-owner-portal`,
  configured via `firebase.json`'s hosting array + `.firebaserc`'s `targets`) — deploy with
  `cd owner-portal && npm run build && cd .. && npx firebase-tools deploy --only hosting:owner-portal`.
  This is separate from the default Hosting site (`public/`, the privacy policy) — don't deploy
  `--only hosting` unqualified expecting just one of them, it does both.

## Web build
- `npm run web` (dev server), `npm run web:build` → `web-build/`, `npm run web:preview`.
- **Same `src/` as the phone app.** `vite.config.ts` aliases `react-native` and every
  native dependency to `src/web/shims/*`; `.web.ts` files fork behaviour where the two
  platforms genuinely differ (`docListener`, `appSettings`, `pushSupport`).
- **Alias order in `vite.config.ts` is load-bearing** — aliases rewrite by prefix, so
  specific `react-native/Libraries/...` entries must come before the broad
  `react-native` one or they resolve to paths that do not exist.
- `public/` is copied into `web-build/`, which is how the privacy policy, terms and
  `firebase-messaging-sw.js` get served.
- **Not deployed anywhere yet** — it runs locally only, and there is no Hosting target
  for it. `VITE_GOOGLE_MAPS_KEY` is also still unset, so every map is a blank panel;
  the existing key is restricted to the Android package and cannot work in a browser.

## Session log (Claude Code)

Recent months only. **Everything before 2026-09-12 is in [`docs/session-log.md`](docs/session-log.md)** — moved there 2026-09-20 to keep
this file small, since it is loaded into context on every request. When adding
an entry here, move anything older than about a month across.

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
- 2026-09-13/14: A full audit, ten fixes, and build 7 on TestFlight.
  * **The Cigar Passport's achievements were real but mute.** Every badge is
    computed from live data — reviews, distinct lounges, cities, states, miles
    from the member's home city, a Monday-based week streak — but the screen
    told everyone to "Keep exploring" whatever the badge wanted. Host needs ten
    photographs; no amount of exploring unlocks it. Each badge now carries its
    requirement **next to its threshold** so the sentence and the number cannot
    drift, and tapping any badge says what it asks for. Note a "visit" is a
    review: there is no check-in feature, so somebody who visits fifty lounges
    and writes nothing earns nothing. Thresholds are a guess and want Lakhan's
    sign-off — 75% is reachable on five reviews.
  * **Write Review's "Visit Date" was a fake input** — bordered box, calendar
    icon, sat among the real fields, and submit always wrote `new Date()`.
    Presented as a timestamp now; a real picker is backlogged.
  * **Notifications only ever reached three events.** Push was sent from
    `notifyOwner`, so a reservation, a cancellation and a review on a lounge you
    own travelled to a phone and nothing else did — including "your business was
    approved", which is the one members wait for. Delivery now hangs off
    `onMemberNotificationCreated`, a trigger on the notification document
    itself, so the next type anyone adds is delivered without them knowing the
    push code exists. Every notification already carried its own title and body,
    so there is no second wording to maintain. **A push arriving while the app
    is foregrounded sets the badge and shows no banner** — iOS behaviour, not a
    bug; presenting it needs notifee (a native dep) or an in-app banner, both
    deferred.
  * **Edit Listing was registered only in the Search stack**, so opening it from
    Profile → My Shops hopped the member into Search and swiping back stranded
    them there. Registered in both stacks now: a screen belongs to whichever
    stack you walked in through.
  * **Lounge Alerts and Accessibility Mode were ornaments** — neither was in the
    save payload, neither identifier appeared anywhere else. Lounge Alerts now
    reflects whether *this device* is registered (`isDeviceRegisteredForPush` —
    iOS permission and "is this phone registered" come apart in both
    directions), requests permission, unregisters on off, and sends a member to
    Settings when iOS has already refused once. Accessibility Mode deleted
    rather than implemented: iOS owns accessibility and the app already honours
    it.
  * **Legal documents updated and deployed.** The automated ID check reads the
    printed *name* as well as the date of birth now, and the policy still said
    it read a date; push notification tokens were undocumented entirely. Terms
    gained sections on proving your age and on notifications. Account deletion's
    list now mentions the tokens (verified `recursiveDelete` really takes them).
  * **A full audit produced 21 findings** (Word doc on the Desktop,
    `Lounge-Locator-Audit.docx`). Ten fixed. The two that mattered:
    **24 photographs of government identity documents, and 19 user documents,
    survived accounts that no longer existed** — Auth had been emptied from the
    console during QA, so `purgeMember` never ran, and the privacy policy
    promises exactly that deletion. Purged against a fully paged `listUsers`,
    dry run first, manifest on the Desktop. Also fixed: Achievements and
    RatingsBreakdown spun for ever on any load failure (`.then().finally()` with
    no `.catch()`, and a `loading || !data` guard); **five unreachable Concierge
    screens** deleted, all mock, three still calling `getAllLounges()`;
    accented names and non-US phone numbers were refused, making all 273
    international lounges unbookable (now one tested `contactDetails` module);
    empty reviews counted as Passport visits; 17 lounges had no city, backfilled,
    cityStats drift now zero; 13 lint warnings to zero.
  * **The Google Places key was never a placeholder.** It works, on Places v1 —
    verified live with real hours and phone numbers. **Yelp is `TRIAL_EXPIRED`**,
    killing three scripts; `refreshCityLounges` degrades to Google alone exactly
    as its `.catch()` intended. The ~$192 backfill is deferred until Apple
    accepts the app (Rohith's call), leaving 8,396 lounges with no phone, 5,080
    reading "Hours not yet available" and 4,055 with no photograph.
  * **Build 7 uploaded, Complete, and with the internal testers.** First since
    24 August. New `npm run create:reviewer` makes
    `appreview@enteraxion.com` — pre-verified, no identity document, **not an
    admin** — because a reviewer who signs up fresh hits the 21+ wall and can
    reach nothing. The App Review notes must say so.
  * **Still open:** the App Store listing itself (screenshots at 6.9"/6.5",
    description, keywords, age rating, App Privacy); rotating
    `GOOGLE_PLACES_API_KEY`, exposed during the audit; `npm run seed:firestore`
    has been broken since August (imports four deleted mock files); accessibility
    roles on ~1 Pressable in 4; the Map still renders light on a dark device.

- 2026-09-15/20: Android parity, Apple's 1.4.3 rejection, and the web app.
  * **Android had never received a single push.** Every `fcmToken` document in the
    project read `platform: ios` — that was the tell. `POST_NOTIFICATIONS` is
    mandatory from Android 13 and was never declared; nothing arrived and nothing
    errored. Also added the `<queries>` entry for `RecognitionService` (needed from
    Android 11 or voice search finds no provider) and the Maps `meta-data` key.
    Three failed Maps authorisations before noticing **this project commits its own
    `android/app/debug.keystore`**, whose SHA-1 differs from `~/.android/`'s.
  * **Custom map markers were invisible on Android only.** Android rasterises a
    marker view to a bitmap and only does so while `tracksViewChanges` is true;
    iOS composites directly. Passing `false` from first render — the standard
    performance advice — yields no markers at all. `src/utils/mapMarker.ts` tracks
    for 600 ms then stops.
  * **Android 15 ignores `android:statusBarColor`.** Edge-to-edge is forced from
    SDK 35. A translucent bar is the answer; a colour is simply not read.
  * **An accessibility script wrote JSX attributes as children** on single-line
    tags — valid JSX that renders the attribute text on screen, and **tsc and
    ESLint both passed it**. Reverted with `git checkout`, rewrote to detect a tag
    closing on the same line, verified against a production bundle. 49 icon-only
    Pressables now have a role and a hand-written label.
  * **Apple rejected the app under guideline 1.4.3** — tobacco — on **concept**
    grounds: "the current concept is not appropriate". Not fixable by editing the
    app, which is the distinction that matters. Note the 2026-08-23/31 claim that
    removing the cannabis type "cleared 1.4.3" was wrong; the guideline covers
    tobacco, which is the premise. Dr. Brinkley's decision on a call: rebuild as a
    **mobile-first web app**, keep Google Play going in parallel (Play's policy
    targets the *sale* of tobacco, not apps that mention it).
  * **The web build works, from the same `src/`.** See the Web build section above
    for how. Four bugs found by actually opening it in a browser, only one of which
    raised an error: Vite alias order (deep paths rewritten to
    `react-native-web/Libraries/...`); the dev server's dependency optimiser not
    reading `resolve.extensions`, so react-native-screens' `TabsHost.web.js` was
    unreachable; **`#root` was `display: block`**, so every screen's `flex: 1`
    resolved to height 0 and the whole app rendered into a zero-height box — all
    the text in the DOM, a completely black page, no error; and `onSnapshot`, which
    lives on the reference in RN Firebase and is a top-level function in the web SDK.
  * **Then four more that were invisible for the same reason.** `require()` of a
    PNG compiles to a CommonJS namespace object, so `<Image source>` got
    `{default: url}` and silently rendered nothing — the splash logo and the mark on
    all three auth screens. **React Native names fonts by PostScript name**, which
    means nothing to a browser: `document.fonts` was empty and the entire app was
    rendering in the default serif. **`Alert.alert` in react-native-web is
    `static alert() {}`** — an empty function — so all 82 call sites were swallowed
    and Log Out and Delete Account were inert; `src/web/shims/alert.ts` is a real
    implementation in the app's own styling. And `Linking.openSettings` does not
    exist there at all, so it threw rather than no-oped.
  * **Web push is real and proven end to end**, not stubbed: service worker in
    `public/`, VAPID key in `.env.local`, token written with `platform: 'web'`, and
    `onMemberNotificationCreated` logged `sent:1 failed:0` against it. **The
    delivery function needed no change** — FCM sends to a web token exactly as to an
    APNs one. Two caveats that are Apple's, not ours: push on iPhone only works once
    the site is added to the Home Screen, and the ID document scanner becomes a
    plain photo upload, so more submissions reach the manual queue.
  * **Delete Account really deleted the account and left the member sitting in the
    app.** The code relied on `onAuthStateChanged` firing; true on a phone, false in
    a browser, where the SDK holds a valid ID token for up to an hour. It signs out
    explicitly now — `signOut` is local only, so the old comment's reasoning that
    this would be "a call against a user that no longer exists" was wrong.
  * **How the web app was verified**: headless Chrome driven over the DevTools
    Protocol at 390x844, signed in with a throwaway account (created and deleted
    each run), walking the tabs and the settings flows. Worth repeating rather than
    trusting a screenshot — `--virtual-time-budget --dump-dom` freezes before the
    splash finishes and reports an empty page every time.
  * **Still open:** no Hosting target for the web app and no URL — it runs on one
    laptop; `VITE_GOOGLE_MAPS_KEY` unset so all three maps are blank; no URL linking
    config, so every screen is at `/` and a refresh loses your place; review-with-
    photos, ID upload, reservations, Concierge and voice search untested in a
    browser; nothing run on real iPhone Safari or Android Chrome. Android
    `versionCode` is still 1 and Play is waiting on Tiffany verifying the developer
    account, which is waiting on enteraxion.com being live. And
    `GOOGLE_PLACES_API_KEY` still wants rotating — exposed during the 09-13 audit.
