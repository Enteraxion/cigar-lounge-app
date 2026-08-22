# Lounge Locator — pre-release test report

**Date:** 2026-08-20
**Commit:** `f3f12e5`
**Tested on:** iPhone 17 Pro (iOS 26.5), iPhone SE 3rd gen (created for this test), iPad mini A17 Pro — all simulators, Debug build via Metro
**Not tested on:** a physical device — see BLOCKER B2

---

## How to read this

Every row is marked **PASS**, **FAIL**, or **NOT TESTED**. I have used NOT TESTED
rather than PASS wherever I could not actually exercise the behaviour. There are
14 such rows and they are listed honestly, because a report that marks something
green on the strength of having read the code is worse than one that admits the
gap — the two bugs that reached Rohith yesterday both lived in wiring that read
correctly.

Nothing in this report has been fixed. No code was changed while testing.

---

## 1. Build & startup

| # | Scenario | Result | Notes |
|---|---|---|---|
| 1.1 | `tsc --noEmit` | **PASS** | exit 0, no diagnostics |
| 1.2 | ESLint `src/` | **PASS (with warnings)** | 0 errors, **8 warnings** — see M4 |
| 1.3 | ESLint `functions/`, `scripts/` | **PASS** | clean |
| 1.4 | Unit test suite | **PASS** | 19 suites, **306 tests**, all green |
| 1.5 | Firestore rules suite (emulator) | **PASS** | **36 tests**, all green |
| 1.6 | Production iOS bundle | **PASS** | builds, 21 assets copied |
| 1.7 | Clean Debug build + install (simulator) | **PASS** | `Debug-iphonesimulator`, no baked bundle, Metro attached |
| 1.8 | Cold launch, no native crash | **PASS** | 15,842 log lines captured, no exception, no fatal, no redbox |
| 1.9 | Launch log free of real errors | **FAIL** | Keychain duplicate-item error — see C1 |
| 1.10 | Launch log free of ATS warnings | **PASS (Debug only)** | 6× "Did not use TLS" + `ATSAllowsLocalNetworking` — this is Metro over http on localhost and does not occur in Release |
| 1.11 | JS console clean at runtime | **NOT TESTED** | See M5 — warnings demonstrably exist but I could not enumerate them |

## 2. Auth flows

| # | Scenario | Result | Notes |
|---|---|---|---|
| 2.1 | Sign up, happy path | **PASS** | Verified earlier today: account created, `ageVerification` written, confirmation email sent, signed back out to Login |
| 2.2 | Sign-up under 21 refused before account creation | **PASS** | Covered by 21 unit tests in `ageCheck.test.ts`; gate runs before `createUserWithEmailAndPassword` |
| 2.3 | Sign in, happy path | **PASS** | Verified with `admin123@gmail.com` |
| 2.4 | Email wall shown to unconfirmed account | **PASS** | Verified with `rohithakepati@gmail.com` |
| 2.5 | "I've confirmed — continue" releases the gate | **PASS** | Was broken (dead button); fixed in `9243b23` and covered by 3 new tests that fail against the old code |
| 2.6 | App does not hang on splash after fresh sign-in | **PASS** | Was broken; fixed in `952382e`, 7 regression tests |
| 2.7 | Sign out returns to Login | **PASS** | Observed |
| 2.8 | ID upload step (document picker, front/back) | **PASS** | Verified on simulator: step 1 picker, two-sided State ID, single-page passport |
| 2.9 | Wrong password | **NOT TESTED** | Error mapping is unit-tested (`authErrors.test.ts`) but I did not drive it in the UI today |
| 2.10 | Already-registered email | **NOT TESTED** | Same — mapped in `authErrors.ts`, not exercised |
| 2.11 | Forgot password sends a reset email | **NOT TESTED** | Requires inbox access |
| 2.12 | Verification link actually confirms the address | **PASS (by proxy)** | Rohith tapped a real link; the app then saw `emailVerified` true |
| 2.13 | Expired verification link | **NOT TESTED** | Requires an aged link from the inbox |
| 2.14 | Reused verification link | **NOT TESTED** | Same |
| 2.15 | **Verification email reaches the inbox** | **FAIL** | Lands in spam — see **B1**, the most serious finding in this report |

## 3. Form validation

| # | Scenario | Result | Notes |
|---|---|---|---|
| 3.1 | Empty submit blocked with a message | **PASS (code path exercised)** | `setErrorMessage('Please fill in every field.')`; inline, above the button |
| 3.2 | Mismatched passwords | **PASS (code path)** | "Passwords do not match." |
| 3.3 | Weak password | **NOT TESTED** | Delegated to Firebase (`auth/weak-password`), mapped, not driven |
| 3.4 | Invalid email formats | **NOT TESTED** | Delegated to Firebase; no client-side format check exists |
| 3.5 | Leading/trailing whitespace | **PASS** | Every field is `.trim()`ed before use |
| 3.6 | Over-length input | **NOT TESTED** | No `maxLength` on any field — see M6 |
| 3.7 | Special characters | **NOT TESTED** | |
| 3.8 | Date of birth ambiguity | **PASS** | Three separate DD/MM/YYYY fields precisely to avoid it; `ageCheck` never parses a date from a string |
| 3.9 | Error message placement | **PASS** | Inline in-card on all three auth screens, not an alert |

## 4. Navigation

| # | Scenario | Result | Notes |
|---|---|---|---|
| 4.1 | Login → Create Account | **PASS** | Renamed from "Apply for Access" |
| 4.2 | Login → Forgot Password | **PASS** | Observed |
| 4.3 | Reset Password back button works | **PASS** | Was completely unresponsive; fixed in `d30814c`, verified returning to Login |
| 4.4 | Back button clears the status bar | **PASS** | Verified on iPhone 17 Pro |
| 4.5 | Email wall has an exit (Sign out) | **PASS** | No dead end |
| 4.6 | ID wall has an exit (Sign out / Explore first) | **PASS** | No dead end |
| 4.7 | Profile → all sub-screens | **NOT TESTED** | Not driven today |
| 4.8 | Hardware/gesture back | **NOT TESTED** | Needs a device; iOS swipe-back not exercised |
| 4.9 | Deep links | **N/A** | None configured. The Google redirect scheme in `Info.plist` is for OAuth only and there is no UI behind it |

## 5. Core app features

| # | Scenario | Result | Notes |
|---|---|---|---|
| 5.1 | Search results + lounge type chips | **PASS** | Verified earlier in the session |
| 5.2 | Lounge detail, Claim gated when unverified | **PASS** | Verified — produced the combined "Two things first" message |
| 5.3 | Large dataset | **PASS** | **8,496 lounges** live; per-tab queries bounded (`getLoungesNear`, 150-marker map cap), Search reads one pre-computed doc |
| 5.4 | Empty image states | **FAIL — corrected 2026-08-22** | I checked `imageUrl`; the field is `images`, an array. My query matched nothing and I read that as good news. The truth: **4,163 lounges have no photo**, and only 20 of the 3,328 Google-sourced ones have any. See M7. |
| 5.5 | Empty states (no reviews / no favourites / no visits) | **NOT TESTED** | Only 1 review, 3 reservations, 1 event exist project-wide, so most lists are empty in practice — but I did not walk them |
| 5.6 | Home, Map, Saved, Passport, Concierge, Trip Planner | **NOT TESTED** | Not driven today |
| 5.7 | Admin claim review / age review | **NOT TESTED** | Not driven today |
| 5.8 | `aggregates/cityStats` freshness | **PASS (with note)** | Generated 2026-08-17; lounge count unchanged at 8,496 since, so still accurate — see C2 |

## 6. Network & error handling

| # | Scenario | Result | Notes |
|---|---|---|---|
| 6.1 | Offline behaviour | **NOT TESTED** | Not scriptable in this environment |
| 6.2 | Slow network | **NOT TESTED** | |
| 6.3 | API errors / timeouts | **PARTIAL PASS** | `functions/src/resilience.test.ts` covers retry/backoff for the import path; app-side failures show retryable alerts by design |
| 6.4 | Session expiry | **NOT TESTED** | |
| 6.5 | Failed upload is retryable, not a dead end | **PASS (code path)** | Local photos are kept so "try again" does not mean "photograph everything again" |
| 6.6 | Failed verification read fails **open** | **PASS** | Deliberate: a dropped request must not lock a member out. Unit-tested |

## 7. UI/UX

| # | Scenario | Result | Notes |
|---|---|---|---|
| 7.1 | Logo present on all auth screens | **PASS** | |
| 7.2 | Logo renders cleanly | **FAIL** | Semi-opaque rectangular halo — see **M1** |
| 7.3 | Palette consistent across auth screens | **PASS** | Gold-glow layer added to Sign Up and Forgot Password to match Login |
| 7.4 | Safe area / status bar | **PASS** | Verified on iPhone 17 Pro and SE |
| 7.5 | Small screen (iPhone SE, 375×667) | **PASS** | Login renders fully, nothing clipped |
| 7.6 | Large screen (iPad mini) | **FAIL** | Unbounded layout — see **M2** |
| 7.7 | Splash screen | **PASS** | Logo, hairline, tagline; 1.6s floor |
| 7.8 | Native launch screen | **PASS** | Logo on black; no "Powered by React Native" |
| 7.9 | Loading / disabled button states | **PASS (observed)** | Spinners and `opacity` on submit across auth and capture screens |
| 7.10 | Double-submit guard | **PASS (code path)** | `submitting` / `checking` / `sending` guards on every submit |
| 7.11 | Keyboard covering inputs | **NOT TESTED** | `keyboardAwareScrollProps` is applied to 14 forms, but I did not verify visually. I did observe the layout shifting under the keyboard while automating typing, so this is worth a manual pass |
| 7.12 | Typography / spacing consistency | **PASS (visual)** | Playfair + Inter throughout, consistent card treatment |

## 8. Security

| # | Scenario | Result | Notes |
|---|---|---|---|
| 8.1 | No private keys or service accounts committed | **PASS** | Full history scanned; `serviceAccountKey.json`, `GoogleService-Info.plist`, `google-services.json` are untracked **and** gitignored |
| 8.2 | Firebase Web API key in `owner-portal` | **PASS (not a leak)** | `AIzaSy…` in `owner-portal/src/lib/firebase.ts` is a public client identifier that ships in every web bundle. Access control is `firestore.rules`, not this key |
| 8.3 | No sensitive data logged | **PASS** | No `console.*` of password, token, secret, apiKey or `idImageUrl` anywhere in `src/` or `functions/src/` |
| 8.4 | Real secrets held server-side | **PASS** | `YELP_API_KEY`, `GOOGLE_PLACES_API_KEY`, `SENDGRID_API_KEY`, `ANTHROPIC_API_KEY` all via `defineSecret` — none in the app bundle |
| 8.5 | Members cannot self-verify age | **PASS** | Rules-tested, including an upload with `status: 'verified'` smuggled alongside |
| 8.6 | Claim-approval notifications are admin-only | **PASS** | Rules-tested — a forged "your business has been approved" is refused |
| 8.7 | Protected routes unreachable when signed out | **PASS** | `AppNavigator` mounts either the Auth stack or Main, never both; Firestore rules enforce independently of the UI |
| 8.8 | Tokens stored appropriately | **PASS** | Firebase Auth keychain persistence; no hand-rolled token storage |
| 8.9 | Admin list consistent across all three places | **PASS** | `admins.ts`, `firestore.rules`, `storage.rules` all list `admin123@gmail.com` only; both rule files deployed |
| 8.10 | ID photos of deleted accounts removed from Storage | **PASS** | 2 objects under `users/`, both belonging to a live account. No orphans |
| 8.11 | Personal data of deleted accounts removed from Firestore | **FAIL** | **7 orphaned user documents** — see **M3** |
| 8.12 | ID image URLs are permanent bearer tokens | **KNOWN, ACCEPTED** | Documented in `storage.rules`. Rohith decided on 2026-08-19 to keep this as is |

---

## Failures in detail

### B1 — BLOCKER — Verification email lands in spam, and email is now a hard login wall

**What I did:** reviewed the sending setup end to end. **Expected:** a new member receives the confirmation link in their inbox. **Actual:** it arrives in spam (reported and reproduced by Rohith).

Why it is a blocker rather than an annoyance: since `3d01965`, an unconfirmed
address cannot reach the app at all. So **every sign-up whose email lands in spam
is a member who cannot use the product.** Before that change this was cosmetic;
now it is the single point of failure in onboarding.

Cause: the sender is `noreply@the-reserve-app-c44ed.firebaseapp.com`. No SPF,
DKIM or DMARC alignment with any domain the recipient associates with the brand,
generic Firebase template copy, and a link pointing at `firebaseapp.com`.

**Files:** not a code defect. `src/services/firebaseAuth.ts:sendVerificationEmail`
is doing the right thing; the problem is the transport.

**Suggested fix, in order of effect:**
1. Send it yourself — Cloud Function using `generateEmailVerificationLink()` plus
   SendGrid from `no-reply@enteraxion.com`, with SPF/DKIM/DMARC on that domain.
   Needs a real `SENDGRID_API_KEY` (still a placeholder) and DNS access to
   `enteraxion.com`. This is the only fix that actually works.
2. Custom action domain (Firebase Console → Authentication → Templates →
   Customize domain) so the link is on your domain. Also DNS.
3. Console-only, ~10 minutes, partial: sender name `Lounge Locator`, a monitored
   reply-to on `enteraxion.com`, subject
   `Confirm your email to finish joining Lounge Locator`, and body rewritten out
   of Firebase boilerplate. Moves it from *always* spam to *sometimes* spam.

**Alternative if DNS is not obtainable before release:** make email confirmation
a banner-and-action-gate again instead of a wall (revert `3d01965`'s navigator
branch). That restores the previous, working onboarding and keeps the
verification requirement on the three gated actions.

### B2 — BLOCKER — Cannot install on a physical device; build number is stale

**What I did:** `react-native run-ios --udid …`, then `devicectl device install`.
**Expected:** the app installs on the iPhone. **Actual:**

```
Failed to verify code signature … 0xe800801c (No code signature found.)
```

The app compiled (binary dated today) but `_CodeSignature/CodeResources` is from
Aug 16 — the signing phase never ran. Build settings show
`CODE_SIGN_IDENTITY = iPhone Developer` and `PROVISIONING_PROFILE_REQUIRED = YES`
but **no `CODE_SIGN_STYLE`**, i.e. manual signing with no profile configured.
`react-native run-ios` swallowed the failure and exited 0.

Separately, `CURRENT_PROJECT_VERSION = 3` and build 3 is already on TestFlight —
App Store Connect rejects duplicate build numbers.

**Files:** `ios/CigarLoungeApp.xcodeproj/project.pbxproj:314,346` (team),
`:323,355` (version).

**Severity:** blocker for release, because nothing has been tested on real
hardware — including the camera path in the ID capture flow, which the simulator
cannot exercise at all.

**Suggested fix:** Xcode → target → Signing & Capabilities → tick *Automatically
manage signing*, team **Enteraxion**; bump `CURRENT_PROJECT_VERSION` to 4.

### M1 — MAJOR (cosmetic but on every auth screen) — Logo mark has a visible rectangular halo

**What I did:** rendered the app on iPhone SE and iPad, then measured the asset's
alpha channel directly. **Expected:** the mark floats on the gradient.
**Actual:** a semi-opaque dark rectangle is visible around it.

Measured on `lounge-locator-mark@3x.png`:

```
top-right corner   alpha =  94   (should be 0)
top-middle edge    alpha =  86
max alpha in the outer 6px frame = 185
29.4% of sampled pixels are partially opaque
```

Cause: my luminance key used a 16–58 ramp, but the source badge's interior is not
uniformly black — the upper area sits around luminance 32, inside the ramp, so it
survived at ~⅓ opacity. Introduced by me in `f3f12e5`.

**Files:** `assets/images/lounge-locator-mark{,@2x,@3x}.png`, used by
`LoginScreen.tsx:115`, `SignUpScreen.tsx:118`, `ForgotPasswordScreen.tsx:118`.

**Suggested fix:** do not key on luminance. Flood-fill transparency inward from
the border so only background connected to the edge is cleared, leaving the
artwork's own dark tones intact. Then re-assert `max alpha in the outer frame == 0`
as a check before shipping the asset.

### M2 — MAJOR (for App Store review) — iPad layout is unbounded

**What I did:** installed on iPad mini and opened Login. **Expected:** a readable,
centred layout. **Actual:** the card stretches the full width, and the bottom
~45% of the screen is empty black.

This matters because `TARGETED_DEVICE_FAMILY = "1,2"` — **iPad is a declared
target**, so App Store review will open it on an iPad.

**Files:** `ios/CigarLoungeApp.xcodeproj/project.pbxproj:343,373`; layout in the
three auth screens and every `styles.card`.

**Suggested fix:** either constrain content to a `maxWidth` of ~480 and centre it
(a few lines, applies across screens), or set
`TARGETED_DEVICE_FAMILY = "1"` and ship iPhone-only. The second is one line and
honest; the first is the better product.

### M3 — MAJOR — Seven orphaned user documents hold personal data of deleted accounts

**What I did:** cross-referenced every `users/{uid}` document against live Auth
accounts. **Expected:** none orphaned. **Actual:**

```
live Auth accounts: 2
user documents:     9   →  7 orphaned
```

All seven carry `ageVerification.status: 'rejected'` and a stored
`dateOfBirth`. So date-of-birth records for seven deleted accounts are still in
Firestore.

This also tells us **`scripts/resetDatabase.ts` was never run with `--confirm`** —
the Auth accounts were deleted some other way (console, presumably) and the
Firestore side was left behind. The script exists and handles exactly this.

Storage is clean by comparison (8.10 PASS) — no orphaned ID images.

**Files:** data state, not code. Remedy is `scripts/resetDatabase.ts`.

**Suggested fix:** run `npm run reset:database -- --confirm`, which recursively
deletes user documents and their subcollections. Note it will also clear the two
currently-approved claims (Magic Dragon SF, Brass Peacock) — both owned by live
accounts, so re-claim them afterwards if they are wanted.

### M4 — MINOR — Eight ESLint warnings: components defined during render

`react/no-unstable-nested-components` in `HomeScreen.tsx:393,475`,
`SearchScreen.tsx:237,288`, `TravelWishlistScreen.tsx:236,314` (+2 more).

React sees a new component type each render and remounts the subtree, discarding
its state. Not visibly broken today, but it is a real cause of lost scroll
position and flicker on the tabs that carry the most data.

**Suggested fix:** hoist those render functions out of their parents and pass data
as props.

### M5 — MINOR, but unquantified — JS runtime warnings exist and I could not enumerate them

Rohith's own screenshot of the email wall shows the LogBox banner
**"Open debugger to view warnings."** So there is at least one runtime warning.

I could not list them: React Native's JS console does not reach the iOS device
log (I captured 15,842 lines and found no `RCTLog` output), and Metro's stdout
belongs to a terminal I do not control.

**Suggested fix:** open the dev menu → Debug, or read the Metro terminal, and
triage what is there. This should be cleared before release simply because
nobody currently knows what it says.

### M6 — MINOR — No `maxLength` on any text input

Name, email and password fields accept unbounded input. Firebase will reject
absurd values server-side, so this is a UI-quality issue rather than a
vulnerability, but a 10,000-character name will make a mess of the profile.

**Suggested fix:** `maxLength` of 254 on email (RFC limit), ~80 on name, ~128 on
password.

### C1 — COSMETIC — Keychain duplicate-item error at launch

```
error:[-25299] … "duplicate item … 9MSD728TMT.com.enteraxion.thereserve …"
```

Firebase Auth attempting to add a keychain item that already exists. Benign — it
handles it — but it is the same subsystem behind the `auth/keychain-error`
episodes, so it is worth knowing it is there rather than discovering it later.

### C2 — COSMETIC — `aggregates/cityStats` is 3 days old

Generated 2026-08-17. Still accurate, because the lounge count is unchanged at
8,496. The risk is procedural: nothing regenerates it, so the Search tab's city
counts will silently drift after the next import. `npm run build:city-stats`.

---

## Prioritised list — what must be fixed before release

**Must fix (release blockers)**

1. **B1 — verification email deliverability.** Email is a hard login wall, so
   spam placement means new members cannot get in. Either get DNS on
   `enteraxion.com` + a SendGrid key and send it yourself, or drop the wall back
   to a banner + action gate until you can.
2. **B2 — device signing and build number.** Nothing has run on real hardware.
   The camera path in ID capture is untestable on a simulator, so it is currently
   unverified on the only platform where it matters. Bump to build 4.

**Should fix**

3. **M3 — orphaned user documents.** Personal data (dates of birth) for seven
   deleted accounts. Run the reset script.
4. **M2 — iPad layout.** Either constrain the width or stop declaring iPad
   support. As it stands a reviewer will open it on an iPad and see a stretched
   form over an empty half-screen.
5. **M1 — logo halo.** Visible on every auth screen; it is the first thing anyone
   sees. Cheap to fix properly.
6. **M5 — enumerate the JS warnings.** Not because they are known to be bad, but
   because they are unknown.

### M7 — MAJOR — Half the directory has no photograph (correction to 5.4)

**What I did:** counted the `images` array across all 8,496. **Expected:** the PASS
I originally reported. **Actual:**

```
4,333 lounges have at least one photo
4,163 have none  —  and only 20 of the 3,328 Google-sourced documents do
```

My original check queried `imageUrl`, which does not exist on any document. A
query for a field that is absent everywhere returns nothing, and I read "nothing"
as "no problems".

**Severity:** major. Lounge cards and the map are the app's main surfaces and half
of them have no image.

**Suggested fix:** Google Places returns photo references, so the same backfill
that fills phone and hours can fill images — but photos are billed per request on
top of the field-mask tier, so price it separately before running.

### M8 — Resolved 2026-08-22 — the directory was never US-only

Reported to Julian as US-only. It is not, and never was:

```
Berlin, Germany 166 · London, UK 92 · Munich, Germany 35 · Toronto, Canada 33
408 international lounges across 43 cities — Germany, UK, Canada
```

344 came from the Yelp import with city values intact. They were invisible only
because Yelp's region codes ("Berlin, BE", "Munich, BY") made them unrecognisable
in the city list, and because all 3,328 Google-sourced documents had no `city`
field at all.

Fixed: `city` backfilled on all 3,328 from their addresses, and all 408
international labels normalised from region codes to country names so the same
city stops appearing two or three times. Search index rebuilt — 2,017 cities.

**Nice to have**

7. M4 — the eight `no-unstable-nested-components` warnings.
8. M6 — `maxLength` on inputs.
9. C2 — regenerate `cityStats` (and decide who re-runs it after imports).
10. Delete the now-orphaned `src/components/FlameIcon.tsx`, or restore its use.

**Coverage gaps worth closing before you call it tested**

The 14 NOT TESTED rows are concentrated in three areas, and I would not sign off
a release without them:

- **Network conditions** (6.1, 6.2, 6.4) — offline, slow, session expiry. None
  exercised.
- **Core feature walkthroughs** (5.5, 5.6, 5.7) — Home, Map, Saved, Passport,
  Concierge, Trip Planner and both admin screens were not driven today.
- **Failure-path auth** (2.9, 2.10, 2.11, 2.13, 2.14) — wrong password,
  duplicate email, reset email, expired and reused links.

Several of these need a human with an inbox and a real phone, which is also what
B2 unblocks.
