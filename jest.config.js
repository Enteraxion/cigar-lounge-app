/**
 * Two suites, deliberately separated.
 *
 * `unit` runs the pure business logic — the passport/route/wishlist/search
 * maths and the Cloud Function helpers. It touches no native module and no
 * network, so it runs in milliseconds and can gate every commit.
 *
 * `integration` runs against the real Firestore project through the Admin
 * SDK. It is separated because it needs `serviceAccountKey.json` (gitignored)
 * and real network, so it cannot run in CI without credentials — but it is
 * the only thing that catches the class of bug that broke Member Events in
 * production: a query that is syntactically perfect and fails on a missing
 * index. Run with `npm run test:integration`.
 *
 * `rules` runs firestore.rules against the real rules engine in the Firestore
 * emulator. Separate from `integration` because it needs the emulator (and
 * therefore Java) rather than credentials, and because `npm run test:rules`
 * has to start that emulator around it. It exists for security properties
 * that cannot be checked by reading the rules file — see integration/
 * rules.test.ts.
 *
 * React component rendering is not covered here — see REPORT.md for why that
 * is a deliberate, documented gap rather than an oversight.
 */
const typescriptTransform = {
  '^.+\\.tsx?$': ['babel-jest', { presets: ['module:@react-native/babel-preset'] }],
};

module.exports = {
  projects: [
    {
      displayName: 'unit',
      preset: '@react-native/jest-preset',
      testMatch: ['<rootDir>/src/**/__tests__/**/*.test.ts', '<rootDir>/functions/src/**/*.test.ts'],
      setupFiles: ['<rootDir>/jest.setup.js'],
      transformIgnorePatterns: [
        'node_modules/(?!(@react-native|react-native|@react-navigation|lucide-react-native)/)',
      ],
      moduleNameMapper: {
        '\\.(png|jpg|jpeg|gif|svg)$': '<rootDir>/jest.setup.js',
      },
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/integration/**/*.test.ts'],
      // The rules suite needs an emulator, not credentials — excluded so
      // `npm run test:integration` doesn't fail on a machine without one.
      testPathIgnorePatterns: ['<rootDir>/integration/rules\\.test\\.ts$'],
      transform: typescriptTransform,
    },
    {
      displayName: 'rules',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/integration/rules.test.ts'],
      transform: typescriptTransform,
    },
  ],
};
