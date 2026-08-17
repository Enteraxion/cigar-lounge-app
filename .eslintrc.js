module.exports = {
  root: true,
  extends: '@react-native',
  overrides: [
    {
      // Test files and the jest setup run in the jest environment, which the
      // base React Native config does not declare — without this, `describe`,
      // `it`, `expect` and `jest` are all reported as undefined.
      files: [
        '**/__tests__/**/*.{ts,tsx}',
        '**/*.test.{ts,tsx}',
        'integration/**/*.ts',
        'jest.setup.js',
      ],
      env: { jest: true, node: true },
    },
  ],
};
