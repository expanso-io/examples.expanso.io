const path = require('path');

module.exports = function posthogAnalyticsPlugin() {
  return {
    name: 'posthog-analytics',
    injectHtmlTags() {
      return {
        headTags: [
          {
            tagName: 'script',
            innerHTML:
              "if (/^(docs|examples)\\.expanso\\.io$/.test(window.location.hostname)) { window['ga-disable-G-X1RJ0QGN3Z'] = true; }",
          },
        ],
      };
    },
    getClientModules() {
      return [path.resolve(__dirname, '../src/clientModules/posthog.ts')];
    },
  };
};
