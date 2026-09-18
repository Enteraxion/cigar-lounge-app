/**
 * `Alert.alert` on the web.
 *
 * react-native-web ships `class Alert { static alert() {} }` — an empty
 * function. Not a stub that warns, not one that falls back to window.confirm:
 * it does nothing and returns. The app calls Alert.alert 82 times across 25
 * files, and every one of them was being swallowed.
 *
 * That is invisible for a message ("Saved"), and fatal for a confirmation.
 * Log Out and Delete Account are both written as "ask first, act in the
 * button's onPress" — so with a dead Alert the button did nothing at all,
 * which is exactly what Rohith reported from his phone (2026-09-17).
 *
 * So this is a real implementation, matching the app's own dialogs rather
 * than the browser's: same near-black surface, same gold, same destructive
 * red. Built as plain DOM rather than a React component on purpose — the API
 * is imperative and is called from services and event handlers that are
 * nowhere near a React tree, which is why a provider-based dialog would mean
 * rewriting all 82 call sites.
 *
 * Deliberately NOT window.confirm: it cannot show three buttons, cannot mark
 * one destructive, and Safari renders it with the site's domain at the top,
 * which looks like a phishing prompt in a page that is otherwise the app.
 */
import theme, { withAlpha } from '../../theme';

const { colors } = theme;

type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export type AlertButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: AlertButtonStyle;
};

type Pending = { title: string; message?: string; buttons?: AlertButton[] };

/**
 * One dialog at a time, in the order they were asked for. Two overlapping
 * alerts is a real sequence in this app — a failed save reports itself while
 * a confirmation is still up — and without a queue the second would build its
 * own scrim over the first and strand whichever finished last.
 */
const queue: Pending[] = [];
let showing = false;

const FONT =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function styleOf(element: HTMLElement, rules: Partial<CSSStyleDeclaration>): void {
  Object.assign(element.style, rules);
}

function buttonColour(style: AlertButtonStyle): string {
  if (style === 'destructive') return colors.danger;
  if (style === 'cancel') return colors.gray;
  return colors.accentGold;
}

function present({ title, message, buttons }: Pending): void {
  showing = true;

  const scrim = document.createElement('div');
  styleOf(scrim, {
    position: 'fixed',
    inset: '0',
    // Room for the notch and the home indicator: a dialog centred in the
    // layout viewport still lands under them on a phone in landscape.
    padding: 'max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: withAlpha(colors.primaryBlack, 0.72),
    zIndex: '2147483647',
    font: `400 15px/1.45 ${FONT}`,
  });

  const card = document.createElement('div');
  styleOf(card, {
    width: '100%',
    maxWidth: '320px',
    maxHeight: '100%',
    overflowY: 'auto',
    boxSizing: 'border-box',
    background: colors.surface,
    border: `1px solid ${withAlpha(colors.secondarySilver, 0.12)}`,
    borderRadius: '18px',
    padding: '22px 20px 12px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.6)',
    textAlign: 'center',
  });
  card.setAttribute('role', 'alertdialog');
  card.setAttribute('aria-modal', 'true');

  const heading = document.createElement('h2');
  heading.textContent = title;
  styleOf(heading, {
    margin: '0',
    font: `600 17px/1.3 ${FONT}`,
    color: colors.white,
  });
  card.appendChild(heading);

  if (message) {
    const body = document.createElement('p');
    body.textContent = message;
    styleOf(body, {
      margin: '8px 0 0',
      font: `400 14px/1.5 ${FONT}`,
      color: colors.gray,
      whiteSpace: 'pre-wrap',
    });
    card.appendChild(body);
  }

  const row = document.createElement('div');
  styleOf(row, {
    display: 'flex',
    flexDirection: 'column',
    marginTop: '18px',
  });
  card.appendChild(row);

  // Matches the native default: no buttons at all means a single "OK".
  const resolved: AlertButton[] = buttons?.length ? buttons : [{ text: 'OK' }];

  let closed = false;
  const close = (): void => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown, true);
    scrim.remove();
    showing = false;
    const next = queue.shift();
    if (next) present(next);
  };

  const cancelButton = resolved.find(button => button.style === 'cancel');
  const dismiss = (): void => {
    close();
    cancelButton?.onPress?.();
  };

  function onKeyDown(event: KeyboardEvent): void {
    // Escape dismisses only when there is something safe to dismiss TO. With
    // no cancel button every choice is a real decision — silently picking one
    // would be worse than making the member look at it.
    if (event.key === 'Escape' && cancelButton) {
      event.preventDefault();
      dismiss();
    }
  }
  document.addEventListener('keydown', onKeyDown, true);

  resolved.forEach((button, index) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = button.text ?? 'OK';
    styleOf(element, {
      appearance: 'none',
      width: '100%',
      background: 'transparent',
      border: 'none',
      borderTop: `1px solid ${withAlpha(colors.secondarySilver, 0.1)}`,
      padding: '14px 8px',
      cursor: 'pointer',
      font: `${button.style === 'cancel' ? 400 : 600} 16px/1.2 ${FONT}`,
      color: buttonColour(button.style ?? 'default'),
    });
    element.addEventListener('click', () => {
      close();
      button.onPress?.();
    });
    row.appendChild(element);
    if (index === 0) {
      // Focus the first action so a keyboard or screen-reader user lands
      // inside the dialog rather than behind it.
      setTimeout(() => element.focus(), 0);
    }
  });

  scrim.addEventListener('click', event => {
    if (event.target === scrim) dismiss();
  });

  scrim.appendChild(card);
  document.body.appendChild(scrim);
}

const Alert = {
  alert(title: string, message?: string, buttons?: AlertButton[]): void {
    const pending = { title, message, buttons };
    if (showing) {
      queue.push(pending);
      return;
    }
    present(pending);
  },
};

export default Alert;
