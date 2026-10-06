const path = require('path');

module.exports = function posthogAnalyticsPlugin() {
  return {
    name: 'posthog-analytics',
    getClientModules() {
      return [path.resolve(__dirname, '../src/clientModules/posthog.ts')];
    },
  };
};
