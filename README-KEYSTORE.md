# The Android upload key

Google Play identifies this app by the key its bundle is signed with. **If the
key or its password is lost, Lounge Locator can never be updated on Google Play
again** — not by us, not by Google. A new key means a new app listing and every
existing install is stranded.

Treat it the way you would treat the only copy of a legal document.

## Where things are

| | |
|---|---|
| Keystore file | `~/lounge-locator-upload.keystore` (Rohith's machine, 2026-09-15) |
| Credentials | `android/keystore.properties` — gitignored, never committed |
| Key alias | `lounge-locator` |

## Setting it up on a machine

Create `android/keystore.properties` with the real values:

```properties
storeFile=/absolute/path/to/lounge-locator-upload.keystore
storePassword=…
keyAlias=lounge-locator
keyPassword=…
```

`android/app/build.gradle` reads it and signs release builds with it. Without
the file, release builds fall back to the debug key — they still build, they
simply cannot be uploaded. That is deliberate: a fresh checkout should not fail
on a secret it was never given.

## What still needs doing

- **Back up the keystore file itself** somewhere that survives this laptop — a
  company password manager or encrypted company storage, not a personal note.
  The password alone is no use without the file.
- Google Play App Signing is worth enabling when the listing is created: Google
  then holds the *signing* key and this becomes only the *upload* key, which
  can be reset if lost. That materially reduces the risk above, and is the one
  mitigation available.
