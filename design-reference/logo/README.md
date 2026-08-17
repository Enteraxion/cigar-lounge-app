# Logo assets

`lounge-locator-logo-source-1254.png` — the logo as supplied (1254x1254, no
alpha). Keep it here so the icon set can be regenerated rather than recovered
from someone's Downloads folder.

## Regenerating the app icon

The supplied logo has a gold border ring and rounded corners baked in. iOS
applies its own squircle mask to every app icon, so a baked border gets clipped
at the corners and baked corners read as double-rounded. `make-app-icon.swift`
handles both:

1. Scales and centres the logo so the ring's **straight** segments fall outside
   the frame.
2. Fills the four corners with the logo's own black, because the ring's
   **corner arcs** curve much further inward than its straight segments —
   measured, the arc comes within ~55px of the corner while the straight edge
   is already 52px outside the frame. Scaling far enough to clear the arcs
   would crop the artwork badly.
3. Writes an opaque PNG with no alpha channel, which App Store processing
   requires.

```sh
swift make-app-icon.swift \
  lounge-locator-logo-source-1254.png /tmp/appicon-1024.png \
  1024 57 14 0.195 --preview /tmp/preview-masked.png
```

`--preview` renders it clipped to iOS's mask, which is the only honest way to
check the corners before shipping. Then resize into
`ios/CigarLoungeApp/Images.xcassets/AppIcon.appiconset/` — see the sizes in that
folder's `Contents.json`.

## Known limitation

One master is used for every size. At 20pt (40px) the "LOUNGE LOCATOR" wordmark
is not legible — only the L and pin read. That is normal for a logo with a
wordmark, and Apple's guidance is to supply a simplified mark for small sizes.
If it matters, the fix is a second source image with the wordmark removed, used
for the 20pt and 29pt slots.
