module.exports = {
  '*.{ts,tsx}': 'tsc-files --noEmit',
  'examples/**/*-complete.yaml': 'npx tsx scripts/validate-complete-yaml.ts',
};
