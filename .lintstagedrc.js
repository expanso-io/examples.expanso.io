const validatePipeline = 'npm run validate-staged-pipelines --';

module.exports = {
  '*.{ts,tsx}': () => 'npm run typecheck -- --noEmit',
  'examples/**/*.{yaml,yml}': validatePipeline,
  'static/files/**/*.{yaml,yml}': validatePipeline,
  'static/pipelines/**/*.{yaml,yml}': validatePipeline,
  'docs/**/pipeline.{yaml,yml}': validatePipeline,
};
