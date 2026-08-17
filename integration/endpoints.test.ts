/**
 * Endpoint integration tests — real HTTP against the four callable Cloud
 * Functions running in the Firebase emulator.
 *
 * These invoke the deployed handler over the wire, so they exercise the
 * whole path: the callable protocol, the auth gate, the validation helpers,
 * and the error guard. That is the difference between "the validator
 * function returns the right thing" (covered by the unit suite) and "a
 * malformed request to this endpoint gets a 400 and not a 500".
 *
 * Requires the emulator:
 *     npx firebase-tools emulators:start --only functions,firestore
 *
 * The suite skips itself with a warning if the emulator is not up, rather
 * than failing — a missing emulator is an environment gap, not a defect,
 * and a red suite that means "you forgot to start something" trains people
 * to ignore red suites.
 */

const BASE = 'http://127.0.0.1:5001/the-reserve-app-c44ed/us-central1';

type CallResult = { status: number; body: Record<string, unknown> };

/**
 * The callable protocol wraps payloads in `{data: ...}` and expects the same
 * back. An unauthenticated call simply omits the bearer token — which is how
 * the auth-gate tests below exercise the real gate rather than a mock.
 */
async function call(fn: string, data: unknown, authenticated = true): Promise<CallResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authenticated) {
    // The emulator accepts an unsigned JWT with alg=none for callable auth.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: 'test-user',
        user_id: 'test-user',
        email: 'test@example.com',
        aud: 'the-reserve-app-c44ed',
        iss: 'https://securetoken.google.com/the-reserve-app-c44ed',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');
    headers.Authorization = `Bearer ${header}.${payload}.`;
  }
  const response = await fetch(`${BASE}/${fn}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ data }),
  });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body };
}

function errorOf(result: CallResult): { status?: string; message?: string } {
  return (result.body.error ?? {}) as { status?: string; message?: string };
}

let emulatorUp = false;

beforeAll(async () => {
  try {
    const probe = await fetch(`${BASE}/askConcierge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: {} }),
    });
    emulatorUp = probe.status > 0;
  } catch {
    emulatorUp = false;
  }
  if (!emulatorUp) {
    console.warn('Functions emulator not reachable — endpoint suite skipped.');
  }
}, 30000);

const itIfUp = (name: string, fn: () => Promise<void>, timeout = 30000) =>
  it(name, async () => {
    if (!emulatorUp) return;
    await fn();
  }, timeout);

describe('auth gate — every callable rejects an unauthenticated request', () => {
  const endpoints = [
    'refreshCityLounges',
    'sendClaimInquiryEmail',
    'sendReservationEmail',
    'askConcierge',
  ];

  for (const fn of endpoints) {
    itIfUp(`${fn} refuses an anonymous caller`, async () => {
      const result = await call(fn, {}, false);
      expect(errorOf(result).status).toBe('UNAUTHENTICATED');
    });
  }
});

describe('refreshCityLounges validation', () => {
  itIfUp('rejects a missing city with invalid-argument, not a 500', async () => {
    const result = await call('refreshCityLounges', {});
    expect(errorOf(result).status).toBe('INVALID_ARGUMENT');
    expect(errorOf(result).message).toMatch(/city/i);
  });

  itIfUp('rejects a blank city', async () => {
    expect(errorOf(await call('refreshCityLounges', { city: '   ' })).status).toBe(
      'INVALID_ARGUMENT',
    );
  });

  itIfUp('rejects an over-long city rather than forwarding it upstream', async () => {
    const result = await call('refreshCityLounges', { city: 'x'.repeat(300) });
    expect(errorOf(result).status).toBe('INVALID_ARGUMENT');
  });

  itIfUp('rejects a city containing characters a city name never has', async () => {
    // This value reaches an outbound query string, so shape matters.
    for (const bad of ['Austin<script>', 'Austin?q=1&x=2', 'Austin\n\nInjected']) {
      expect(errorOf(await call('refreshCityLounges', { city: bad })).status).toBe(
        'INVALID_ARGUMENT',
      );
    }
  });

  itIfUp('accepts legitimate city names including accents and punctuation', async () => {
    // Should get past validation. Without a real Yelp key it fails later —
    // the assertion is only that it is NOT rejected as invalid input.
    for (const good of ['Austin, TX', "Coeur d'Alene, ID", 'Zürich']) {
      const status = errorOf(await call('refreshCityLounges', { city: good })).status;
      expect(status).not.toBe('INVALID_ARGUMENT');
    }
  });
});

describe('sendClaimInquiryEmail validation', () => {
  const valid = {
    loungeId: 'lounge-1',
    ownerName: 'Jane Doe',
    ownerContactEmail: 'jane@example.com',
    ownerContactPhone: '5125551234',
  };

  itIfUp('rejects a missing loungeId', async () => {
    const rest: Record<string, unknown> = { ...valid };
    delete rest.loungeId;
    expect(errorOf(await call('sendClaimInquiryEmail', rest)).status).toBe('INVALID_ARGUMENT');
  });

  itIfUp('rejects a malformed email address', async () => {
    for (const bad of ['not-an-email', 'missing@tld', '@nolocal.com']) {
      const result = await call('sendClaimInquiryEmail', { ...valid, ownerContactEmail: bad });
      expect(errorOf(result).status).toBe('INVALID_ARGUMENT');
      expect(errorOf(result).message).toMatch(/email/i);
    }
  });

  itIfUp('rejects an over-long owner name', async () => {
    const result = await call('sendClaimInquiryEmail', { ...valid, ownerName: 'x'.repeat(200) });
    expect(errorOf(result).status).toBe('INVALID_ARGUMENT');
  });

  itIfUp('returns not-found for a lounge id that does not exist', async () => {
    // Previously this fell through to an outbound send with the raw id as
    // the lounge name — a 'not-found' is both correct and actionable.
    // NB: not '__missing__' — Firestore reserves ids wrapped in double
    // underscores and rejects them before the existence check runs.
    const result = await call('sendClaimInquiryEmail', { ...valid, loungeId: 'no-such-lounge' });
    expect(errorOf(result).status).toBe('NOT_FOUND');
  });
});

describe('sendReservationEmail validation', () => {
  const valid = {
    loungeId: 'lounge-1',
    guestName: 'Jane Doe',
    contactPhone: '5125551234',
    partySize: 4,
    date: '2026-09-01',
    timeSlot: '7:00 PM',
  };

  itIfUp('rejects each missing required field individually', async () => {
    for (const field of ['loungeId', 'guestName', 'contactPhone', 'date', 'timeSlot']) {
      const payload: Record<string, unknown> = { ...valid };
      delete payload[field];
      const result = await call('sendReservationEmail', payload);
      expect(errorOf(result).status).toBe('INVALID_ARGUMENT');
    }
  });

  itIfUp('rejects nonsensical party sizes that previously passed', async () => {
    // 0 was caught by the old truthiness check; these were not.
    for (const partySize of [-4, 0, 1.5, 1e9, 'four', null]) {
      const result = await call('sendReservationEmail', { ...valid, partySize });
      expect(errorOf(result).status).toBe('INVALID_ARGUMENT');
    }
  });

  itIfUp('accepts a sane party size', async () => {
    const status = errorOf(await call('sendReservationEmail', { ...valid, partySize: 2 })).status;
    expect(status).not.toBe('INVALID_ARGUMENT');
  });

  itIfUp('caps free-text notes rather than forwarding them into an email body', async () => {
    const result = await call('sendReservationEmail', { ...valid, notes: 'x'.repeat(2000) });
    expect(errorOf(result).status).toBe('INVALID_ARGUMENT');
  });
});

describe('askConcierge validation', () => {
  itIfUp('rejects a request with no messages', async () => {
    expect(errorOf(await call('askConcierge', {})).status).toBe('INVALID_ARGUMENT');
    expect(errorOf(await call('askConcierge', { messages: [] })).status).toBe('INVALID_ARGUMENT');
  });
});

describe('error hygiene', () => {
  itIfUp('never returns a stack trace or file path to the caller', async () => {
    // The guard exists so a third-party failure cannot leak internals.
    const probes = [
      call('refreshCityLounges', { city: 'Austin, TX' }),
      call('sendClaimInquiryEmail', {
        loungeId: 'x',
        ownerName: 'y',
        ownerContactEmail: 'a@b.co',
      }),
      call('askConcierge', { messages: [{ role: 'user', text: 'hi' }] }),
    ];
    for (const probe of probes) {
      const message = errorOf(await probe).message ?? '';
      expect(message).not.toMatch(/\bat \/|\.ts:\d+|node_modules|Error:\s+at/);
    }
  }, 60000);
});
