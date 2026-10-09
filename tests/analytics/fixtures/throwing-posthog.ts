// A stand-in for posthog-js whose init throws, as the real SDK can when a
// blocker or locked-down storage breaks it. tests/analytics/collector.test.ts
// builds a second test page script with posthog-js aliased to this file.
const posthog = {
  __loaded: false,
  init(): never {
    throw new Error('blocked');
  },
};

export default posthog;
