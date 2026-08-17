/**
 * Geometry of the floating tab bar, in one place.
 *
 * The bar is an absolutely-positioned pill (see MainNavigator), so nothing
 * else in the app knows how much room to leave for it. That was fine while
 * both the pill's height and its offset were hardcoded — screens just used
 * a matching magic number. It stopped being fine once the offset became
 * the device's safe-area inset: MapScreen's info card sat at a literal
 * `bottom: 96`, which cleared a pill ending at 88 but collided with one
 * ending at 98 on a home-indicator phone.
 *
 * Anything that needs to sit above the tab bar should use
 * `tabBarClearance(insets.bottom)` rather than a number, so the two can
 * never drift apart again.
 */

const TAB_BAR_HEIGHT = 64;
/** Fallback gap on devices with no home indicator. */
const FALLBACK_BOTTOM_GAP = 24;
/** Breathing room between the pill and whatever sits above it. */
const CLEARANCE_GAP = 12;

export { TAB_BAR_HEIGHT };

/** Distance from the bottom of the screen to the top of the tab bar pill. */
export function tabBarTop(bottomInset: number): number {
  return (bottomInset > 0 ? bottomInset : FALLBACK_BOTTOM_GAP) + TAB_BAR_HEIGHT;
}

/** Where to anchor a floating element that must clear the tab bar. */
export function tabBarClearance(bottomInset: number): number {
  return tabBarTop(bottomInset) + CLEARANCE_GAP;
}

/**
 * Bottom padding for a scroll view that sits under the floating tab bar.
 *
 * A static value rather than an inset-derived one, because scroll padding
 * lives in StyleSheet.create and threading insets through 25 screens buys
 * nothing: this only has to clear the worst case. The bar's top edge is at
 * most 98pt from the bottom (34pt home-indicator inset + 64pt bar), so this
 * leaves a comfortable margin above it.
 *
 * Before this existed, screens each guessed: values ranged from 100 (2pt of
 * clearance — content effectively touching the bar) to 140. One shared value
 * means no screen can be accidentally too tight again.
 */
export const TAB_BAR_SCROLL_CLEARANCE = 140;
