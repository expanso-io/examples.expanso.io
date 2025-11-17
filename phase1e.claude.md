Create interactive explorer for transform-formats example:

1. Create docs/data-transformation/transform-formats-full.stages.ts with 4 stages:
   - Stage 1: Original - JSON input
   - Stage 2: JSON to Avro - Schema evolution, compression
   - Stage 3: Avro to Parquet - Columnar storage
   - Stage 4: Auto-Detection - Detect format, apply transformation

2. Create docs/data-transformation/transform-formats/explorer.mdx

3. Update sidebars.ts to include the explorer
