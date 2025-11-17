Create interactive explorer for normalize-timestamps example:

1. Create docs/data-transformation/normalize-timestamps-full.stages.ts with 3 stages:
   - Stage 1: Original - Mixed formats (ISO, Unix epoch, custom)
   - Stage 2: Parse Formats - Detect and parse multiple formats
   - Stage 3: Normalize to UTC - Convert to ISO 8601 UTC + metadata

2. Create docs/data-transformation/normalize-timestamps/explorer.mdx

3. Update sidebars.ts to include the explorer
