/**
 * The props every scrolling form needs so the keyboard doesn't sit on top of
 * the fields.
 *
 * Reported against Claim Lounge: on iPhone the keyboard covered the inputs and
 * the member couldn't see what they were typing. Auditing rather than patching
 * that one screen found **12 screens with text inputs and no keyboard handling
 * at all** — Sign Up (four fields), Forgot Password, Edit Listing, Edit
 * Profile, Create Collection, Trip Planner and more. Four other screens had
 * `KeyboardAvoidingView`, so the app had two standards and twelve gaps.
 *
 * Spread these onto the ScrollView instead:
 *
 *   <ScrollView {...keyboardAwareScrollProps} contentContainerStyle={...}>
 *
 * Why these three:
 *
 * `automaticallyAdjustKeyboardInsets` — iOS insets the scroll content by the
 *   keyboard's height, so the focused field scrolls into view and every field
 *   stays reachable. Preferred over wrapping in KeyboardAvoidingView: a KAV
 *   around a ScrollView fights the scroll view's own inset handling and needs
 *   a `keyboardVerticalOffset` tuned per screen against the header height,
 *   which is exactly the kind of per-screen number that drifts. This is
 *   iOS-only; Android handles it through `windowSoftInputMode` in the manifest.
 *
 * `keyboardShouldPersistTaps: 'handled'` — without it the first tap on a
 *   button while the keyboard is open only dismisses the keyboard, and the
 *   member has to tap Submit twice. No screen in the app set this, including
 *   the four that already had KeyboardAvoidingView.
 *
 * `keyboardDismissMode: 'interactive'` — dragging the list down pushes the
 *   keyboard away, which is what iOS users expect from a long form.
 */
export const keyboardAwareScrollProps = {
  automaticallyAdjustKeyboardInsets: true,
  keyboardShouldPersistTaps: 'handled' as const,
  keyboardDismissMode: 'interactive' as const,
};

/**
 * The same tap behaviour for a form that isn't in a scroll view, where a
 * KeyboardAvoidingView does the moving instead.
 */
export const keyboardAwareTapProps = {
  keyboardShouldPersistTaps: 'handled' as const,
};
