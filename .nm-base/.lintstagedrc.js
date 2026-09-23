module.exports = {
  '*.{ts,tsx}': () => 'npm run typecheck -- --noEmit',
  'examples/**/*-complete.yaml': 'npx tsx scripts/validate-complete-yaml.ts',
};
