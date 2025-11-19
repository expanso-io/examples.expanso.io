Create interactive explorer for filter-severity example:

1. Create docs/log-processing/filter-severity-full.stages.ts with 3 stages:
   - Stage 1: Original - All log levels mixed (DEBUG, INFO, WARN, ERROR)
   - Stage 2: Parse & Classify - Extract severity from log messages
   - Stage 3: Filter & Route - Drop DEBUG/TRACE, route ERROR/WARN/INFO

2. Create docs/log-processing/filter-severity/explorer.mdx

3. Update sidebars.ts to include the explorer
