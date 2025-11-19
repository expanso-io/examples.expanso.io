Build automation and health monitoring:

1. Create scripts/example-health.ts:
   - Generate report showing for each example:
     * Has interactive explorer (Y/N)
     * Stage file uses correct type (Y/N)
     * Buttons use shared component (Y/N)
     * Tests passing (Y/N)
   - Output as markdown table
   - Exit with error if any critical issues

2. Add npm script: "health": "ts-node scripts/example-health.ts"

3. Create .github/workflows/example-health.yml:
   - Run weekly
   - Post results as GitHub Issue if problems found
   - Label with "maintenance"

4. Create .github/workflows/update-dependencies.yml:
   - Monthly job
   - Update npm dependencies
   - Run validation suite
   - Create PR with changes if all pass
