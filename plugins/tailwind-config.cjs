module.exports = function (context, options) {
  return {
    name: 'tailwind-config',
    configurePostCss(postcssOptions) {
      postcssOptions.plugins.push(
        require('@tailwindcss/postcss'),
        require('autoprefixer')
      );
      return postcssOptions;
    },
  };
};
