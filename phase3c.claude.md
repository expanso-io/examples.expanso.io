Add validation and testing infrastructure:

1. Create scripts/validate-stages.ts:
   - Check all *-full.stages.ts files import Stage type
   - Validate all stages have required properties
   - Check inputLines/outputLines formatting
   - Validate YAML code
   - Check for duplicate stage IDs

2. Add npm script: "validate:stages": "ts-node scripts/validate-stages.ts"

3. Create src/components/DataPipelineExplorer/__tests__/index.test.tsx:
   - Test stage navigation (prev/next)
   - Test keyboard shortcuts
   - Test data rendering
   - Test transformer with legacy formats

4. Create .github/workflows/validate-examples.yml:
   - Run on every PR
   - Execute validate:stages
   - Run tests
   - Report failures

5. Add test dependencies to package.json if needed
