Convert 9 legacy stage files to use correct Stage type:

Files to convert:
1. docs/data-routing/content-splitting-full.stages.ts
2. docs/data-routing/fan-out-pattern-full.stages.ts
3. docs/data-routing/priority-queues-full.stages.ts
4. docs/data-security/encrypt-data-full.stages.ts
5. docs/data-security/encryption-patterns-full.stages.ts
6. docs/data-transformation/aggregate-time-windows-full.stages.ts
7. docs/data-transformation/deduplicate-events-full.stages.ts
8. docs/data-transformation/parse-logs-full.stages.ts
9. docs/log-processing/enrich-export-full.stages.ts

For each file:
1. Add: import type { Stage } from '@site/src/components/DataPipelineExplorer/types';
2. Convert to proper Stage[] format with:
   - id: number
   - title: string
   - description: string
   - inputLines: JsonLine[]
   - outputLines: JsonLine[]
   - yamlCode: string
   - yamlFilename: string

3. Remove legacy properties (inputData, outputData, stage, input, output, etc.)

Use content-routing-full.stages.ts as the reference template.
Test each explorer after conversion to ensure it still works.
