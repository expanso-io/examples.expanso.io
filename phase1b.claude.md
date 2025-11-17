Create interactive explorer for enforce-schema example:

1. Create docs/data-security/enforce-schema-full.stages.ts with 4 stages:
   - Stage 1: Original - No validation, accepts any JSON
   - Stage 2: Define Schema - JSON Schema with required fields
   - Stage 3: Validate & Route - Valid messages pass, invalid to DLQ
   - Stage 4: Monitor Quality - Track validation metrics and violations

2. Create docs/data-security/enforce-schema/explorer.mdx with:
   - DataPipelineExplorer component
   - Modern button styling
   - Proper frontmatter

3. Update sidebars.ts to include the explorer

Focus on showing schema validation visually in the output.
