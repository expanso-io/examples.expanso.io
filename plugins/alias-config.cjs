const path = require('path');

module.exports = function (context, options) {
  return {
    name: 'alias-config',
    configureWebpack(config, isServer, utils) {
      return {
        resolve: {
          alias: {
            '@': path.resolve(__dirname, '../src'),
          },
        },
      };
    },
  };
};
