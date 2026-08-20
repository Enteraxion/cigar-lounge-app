/**
 * The email-verification hook's session tracking.
 *
 * This exists because of a specific bug, on 2026-08-20: the app hung on the
 * splash screen forever after a fresh sign-up or sign-in, and there was no error
 * anywhere to point at it.
 *
 * The cause was effect wiring rather than logic. `refresh` is memoised with no
 * dependencies, so it is created once — at mount, when nobody is signed in — and
 * `useEffect(refresh, [refresh])` therefore ran exactly once, set `emailVerified`
 * to undefined and never ran again. AppNavigator reads undefined as "not known
 * yet" and answers it with the splash, so a member who signed in after mount was
 * held there permanently. Anyone already signed in when the app launched was fine,
 * because the initial `useState` reads the cached user synchronously — which is
 * why it presented as a sign-up bug rather than what it was.
 *
 * Every assertion below fails against that version. The rest of the repo's tests
 * are pure functions (see jest.config.js's note on component rendering being a
 * documented gap); this one renders, because the defect was in the wiring and
 * nothing pure could have caught it.
 */

import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import {
  __resetEmailVerificationCache,
  useEmailVerification,
  type EmailVerificationState,
} from '../useEmailVerification';

type FakeUser = { uid: string; email: string; emailVerified: boolean } | null;

jest.mock('../../services/firebaseAuth', () => {
  const listeners: ((user: FakeUser) => void)[] = [];
  const authStub: { currentUser: FakeUser } = { currentUser: null };
  return {
    auth: authStub,
    onAuthStateChanged: (_auth: unknown, callback: (user: FakeUser) => void) => {
      listeners.push(callback);
      return () => {
        const index = listeners.indexOf(callback);
        if (index >= 0) {
          listeners.splice(index, 1);
        }
      };
    },
    refreshEmailVerified: jest.fn(async () => authStub.currentUser?.emailVerified ?? false),
    sendVerificationEmail: jest.fn(async () => true),
    // Test handles, so a test can move the session the way Firebase would.
    __listeners: listeners,
    __auth: authStub,
  };
});

const mocked = jest.requireMock('../../services/firebaseAuth') as {
  __listeners: ((user: FakeUser) => void)[];
  __auth: { currentUser: FakeUser };
  refreshEmailVerified: jest.Mock;
};

/** Renders the hook and exposes its latest value. */
function renderHook() {
  const captured: { current: EmailVerificationState | null } = { current: null };
  function Probe() {
    captured.current = useEmailVerification();
    return null;
  }
  let tree: ReturnType<typeof create> | null = null;
  act(() => {
    tree = create(createElement(Probe));
  });
  return {
    get state() {
      if (!captured.current) {
        throw new Error('hook did not render');
      }
      return captured.current;
    },
    unmount: () => act(() => tree?.unmount()),
  };
}

/** Drives the session the way Firebase's own listener would. */
async function signIn(user: NonNullable<FakeUser>) {
  mocked.__auth.currentUser = user;
  await act(async () => {
    mocked.__listeners.forEach(listener => listener(user));
  });
}

async function signOut() {
  mocked.__auth.currentUser = null;
  await act(async () => {
    mocked.__listeners.forEach(listener => listener(null));
  });
}

beforeEach(() => {
  mocked.__auth.currentUser = null;
  mocked.__listeners.length = 0;
  mocked.refreshEmailVerified.mockClear();
  // The cache is module-level and therefore survives between tests.
  __resetEmailVerificationCache();
});

describe('useEmailVerification', () => {
  it('reports unknown while nobody is signed in', () => {
    // undefined is "not known yet", and the navigator shows the splash for it.
    const hook = renderHook();
    expect(hook.state.emailVerified).toBeUndefined();
    hook.unmount();
  });

  it('resolves once a member signs in after mount', async () => {
    // THE REGRESSION. Mounted signed-out, then a session appears — which is every
    // sign-in and every sign-up. Before the fix this stayed undefined forever and
    // the app sat on the splash with nothing logged.
    const hook = renderHook();
    expect(hook.state.emailVerified).toBeUndefined();

    await signIn({ uid: 'u1', email: 'new@example.com', emailVerified: false });

    expect(hook.state.emailVerified).toBe(false);
    hook.unmount();
  });

  it('resolves to true for a member whose address is already confirmed', async () => {
    const hook = renderHook();
    await signIn({ uid: 'u2', email: 'admin@example.com', emailVerified: true });
    expect(hook.state.emailVerified).toBe(true);
    hook.unmount();
  });

  it('goes back to unknown on sign-out', async () => {
    // Not `false`: signed out is not "unconfirmed", and treating it as such would
    // show an email wall to somebody with no session at all.
    const hook = renderHook();
    await signIn({ uid: 'u3', email: 'a@example.com', emailVerified: true });
    expect(hook.state.emailVerified).toBe(true);

    await signOut();

    expect(hook.state.emailVerified).toBeUndefined();
    hook.unmount();
  });

  it('tracks a second sign-in after a sign-out', async () => {
    // A subscription that fired once and detached would pass the test above and
    // still strand the next member.
    const hook = renderHook();
    await signIn({ uid: 'u4', email: 'a@example.com', emailVerified: true });
    await signOut();
    await signIn({ uid: 'u5', email: 'b@example.com', emailVerified: false });
    expect(hook.state.emailVerified).toBe(false);
    hook.unmount();
  });

  it('re-reads the account, in case the link was tapped elsewhere', async () => {
    // The cached flag on the token can be stale — somebody confirming on a laptop
    // does not change the token this app is holding.
    const hook = renderHook();
    await signIn({ uid: 'u6', email: 'a@example.com', emailVerified: false });
    expect(mocked.refreshEmailVerified).toHaveBeenCalled();
    hook.unmount();
  });

  it('detaches its listener on unmount', () => {
    const hook = renderHook();
    expect(mocked.__listeners.length).toBe(1);
    hook.unmount();
    expect(mocked.__listeners.length).toBe(0);
  });

  describe('sharing state between instances', () => {
    // The second bug of 2026-08-20, which presented as a dead button. Five
    // components call this hook. React state is per instance, so the wall
    // screen's refresh() updated only the wall screen — while AppNavigator, which
    // actually decides the gate, held a separate copy that never changed. A member
    // who had genuinely confirmed their address tapped "I've confirmed" and stayed
    // exactly where they were, with nothing failing and nothing logged.
    //
    // Firebase gives no help: user.reload() mutates the user but does not fire
    // onAuthStateChanged, so there is no event for other instances to hear.

    it('propagates one instance\'s refresh to every other instance', async () => {
      const navigator = renderHook();
      const wall = renderHook();

      await signIn({ uid: 'u7', email: 'a@example.com', emailVerified: false });
      expect(navigator.state.emailVerified).toBe(false);
      expect(wall.state.emailVerified).toBe(false);

      // The member taps the link in their inbox, so the server now says verified.
      mocked.__auth.currentUser = { uid: 'u7', email: 'a@example.com', emailVerified: true };

      // Only the wall refreshes — as only the wall has a button.
      await act(async () => {
        await wall.state.refresh();
      });

      // The assertion that was failing: the navigator has to see it too, or the
      // gate never drops and the button looks dead.
      expect(navigator.state.emailVerified).toBe(true);
      expect(wall.state.emailVerified).toBe(true);

      navigator.unmount();
      wall.unmount();
    });

    it('resolves refresh with what it found, so the caller need not guess', async () => {
      // The screen alerts "not confirmed yet" only on a definite false. The old
      // version slept 1200ms and then re-read, reporting failure whenever the
      // network was slower than the guess.
      const hook = renderHook();
      await signIn({ uid: 'u8', email: 'a@example.com', emailVerified: false });

      let result: boolean | undefined = true;
      await act(async () => {
        result = await hook.state.refresh();
      });
      expect(result).toBe(false);

      mocked.__auth.currentUser = { uid: 'u8', email: 'a@example.com', emailVerified: true };
      await act(async () => {
        result = await hook.state.refresh();
      });
      expect(result).toBe(true);

      hook.unmount();
    });

    it('does not leak a stale value into a later instance after sign-out', async () => {
      const first = renderHook();
      await signIn({ uid: 'u9', email: 'a@example.com', emailVerified: true });
      expect(first.state.emailVerified).toBe(true);
      await signOut();
      first.unmount();

      // A module-level cache could hand a fresh instance the previous member's
      // answer, which on this gate would wave an unconfirmed member straight in.
      const second = renderHook();
      expect(second.state.emailVerified).toBeUndefined();
      second.unmount();
    });
  });
});
