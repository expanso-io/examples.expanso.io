# Contributing to Expanso Examples

Thank you for contributing to the Expanso Examples documentation! This guide will help you create high-quality interactive pipeline examples.

## Table of Contents

- [Interactive Examples Overview](#interactive-examples-overview)
- [Quick Start](#quick-start)
- [Creating a New Interactive Explorer](#creating-a-new-interactive-explorer)
- [File Structure](#file-structure)
- [Stage File Format](#stage-file-format)
- [Testing Your Example](#testing-your-example)
- [Best Practices](#best-practices)
- [Submitting Your Contribution](#submitting-your-contribution)

## Interactive Examples Overview

Interactive examples are step-by-step pipeline demonstrations that allow users to:

- **Navigate** through multiple stages using arrow keys or stage buttons
- **Compare** input and output data at each transformation step
- **Inspect** YAML pipeline configurations
- **Learn** from detailed stage descriptions

Each interactive example consists of:

1. **Stage file** (`*-full.stages.ts`) - TypeScript file defining pipeline stages
2. **Explorer page** (`explorer.mdx`) - MDX page with the DataPipelineExplorer component
3. **Supporting pages** - Introduction, setup guides, tutorials, complete solutions
4. **Sidebar entry** - Navigation structure in `sidebars.ts`

## Quick Start

The fastest way to create a new interactive example is using the CLI tool:

```bash
npm run create-explorer -- \
  --name "your-example-name" \
  --category "data-routing" \
  --stages 4 \
  --title "Your Example Title"
```

This generates all the boilerplate files you need to get started.

## Creating a New Interactive Explorer

### 1. Choose Your Category

Examples are organized into 4 categories:

- `data-routing` - Circuit breakers, content routing, fan-out, priority queues
- `data-security` - PII removal, encryption, schema enforcement
- `data-transformation` - Time windows, deduplication, format conversion
- `log-processing` - Filtering, enrichment, production pipelines

### 2. Generate Boilerplate

Run the create-explorer script with your chosen parameters:

```bash
npm run create-explorer -- \
  --name "load-balancing" \
  --category "data-routing" \
  --stages 4 \
  --title "Load Balancing Strategies"
```

**Parameters:**

- `--name`: URL-friendly kebab-case name (e.g., "circuit-breakers", "remove-pii")
- `--category`: One of the 4 categories above
- `--stages`: Number of pipeline stages (3-6 stages work best)
- `--title`: Human-readable title in title case

**What gets generated:**

- `docs/{category}/{name}-full.stages.ts` - Stage definitions template
- `docs/{category}/{name}/explorer.mdx` - Explorer page with TODOs
- `sidebars.ts` - Updated with new entry

### 3. Implement Stage Definitions

Edit the generated `*-full.stages.ts` file and replace all TODO markers:

```typescript
import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const YourExampleStages: Stage[] = [
  {
    id: 1,
    title: 'Stage 1: Initial State',
    description: 'Clear description of what this stage demonstrates',
    yamlFilename: 'step-0-initial.yaml',
    yamlCode: `# Complete YAML pipeline configuration
pipeline:
  processors:
    - mapping: |
        root = this
        # Your transformation logic here`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"field": "value",', indent: 1, key: 'field', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"field": "transformed",', indent: 1, key: 'field', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  // Additional stages...
];
```

**Key guidelines:**

- Use sequential IDs starting from 1
- Write clear, descriptive titles (shown in stage buttons)
- Provide detailed descriptions explaining the "why" not just the "what"
- Include complete, working YAML configurations
- Use `inputLines`/`outputLines` arrays (not legacy `input`/`output` strings)
- Highlight important changes with `type: 'highlighted'`, `type: 'removed'`, or `type: 'normal'`

### 4. Customize Explorer Page

Edit `docs/{category}/{name}/explorer.mdx` and:

- Update stage descriptions under "Understanding the Stages"
- Add 3-5 learning outcomes under "What You've Learned"
- Customize the "Deep Dive into Each Step" links
- Answer 2-4 common questions users might have

### 5. Create Supporting Pages

Create these additional pages in `docs/{category}/{name}/`:

- `index.mdx` - Introduction and overview (what problem does this solve?)
- `setup.mdx` - Environment setup guide (prerequisites, installation)
- `step-1-*.mdx`, `step-2-*.mdx`, etc. - Step-by-step tutorial pages
- `complete-*.mdx` - Complete working solution with download link

### 6. Update Sidebar Entry

The CLI tool automatically updates `sidebars.ts`, but verify the entry looks correct:

```typescript
{
  type: 'category',
  label: 'Your Example Title',
  collapsible: true,
  collapsed: true,
  items: [
    '{category}/{name}/index',
    '{category}/{name}/explorer',
    '{category}/{name}/setup',
    // Add step-by-step tutorial pages here
    '{category}/{name}/complete-solution',
  ],
}
```

## File Structure

After completing your example, the structure should look like:

```
docs/
└── {category}/
    ├── {name}-full.stages.ts          # Stage definitions
    └── {name}/
        ├── index.mdx                   # Introduction
        ├── explorer.mdx                # Interactive explorer
        ├── setup.mdx                   # Setup guide
        ├── step-1-*.mdx               # Tutorial step 1
        ├── step-2-*.mdx               # Tutorial step 2
        └── complete-*.mdx             # Complete solution
```

## Stage File Format

### Stage Type

Each stage must conform to the `Stage` type:

```typescript
type Stage = {
  id: number;              // Sequential: 1, 2, 3, ...
  title: string;           // Shown in stage buttons
  description: string;     // Detailed explanation
  yamlCode: string;        // Complete YAML pipeline config
  yamlFilename: string;    // Filename shown in UI
  inputLines: JsonLine[];  // Visual JSON representation (input)
  outputLines: JsonLine[]; // Visual JSON representation (output)
};
```

### JsonLine Type

Represents a single line of JSON for visual display:

```typescript
type JsonLine = {
  content: string;        // The actual line content (e.g., '"field": "value",')
  indent: number;         // Indentation level (0, 1, 2, ...)
  type?: 'removed' | 'highlighted' | 'normal';  // Visual highlight
  key?: string;           // Optional: the JSON key being shown
  valueType?: 'string' | 'number' | 'boolean' | 'null';  // Optional: value type
};
```

**Example JsonLine arrays:**

```typescript
inputLines: [
  { content: '{', indent: 0 },
  { content: '"user_id": 12345,', indent: 1, key: 'user_id', valueType: 'number' },
  { content: '"email": "user@example.com",', indent: 1, key: 'email', valueType: 'string' },
  { content: '"password": "secret123",', indent: 1, key: 'password', valueType: 'string', type: 'removed' },
  { content: '}', indent: 0 },
],
outputLines: [
  { content: '{', indent: 0 },
  { content: '"user_id": 12345,', indent: 1, key: 'user_id', valueType: 'number' },
  { content: '"email": "user@example.com",', indent: 1, key: 'email', valueType: 'string' },
  // password removed
  { content: '}', indent: 0 },
],
```

### Legacy Format (DO NOT USE)

❌ **Old format (deprecated):**

```typescript
{
  stage: 1,  // Should be 'id'
  yaml: `...`,  // Should be 'yamlCode'
  input: `{"field": "value"}`,  // Should be 'inputLines'
  output: `{"field": "transformed"}`,  // Should be 'outputLines'
}
```

✅ **New format (required):**

```typescript
{
  id: 1,
  yamlCode: `...`,
  inputLines: [...],
  outputLines: [...],
}
```

## Testing Your Example

### 1. Run TypeScript Type Check

```bash
npm run typecheck
```

Fix any TypeScript errors before proceeding.

### 2. Run Stage Validation

```bash
npm run validate-stages
```

This checks:

- ✅ Stage type imports
- ✅ Proper Stage[] exports
- ✅ Sequential stage IDs
- ✅ All required properties
- ✅ New format (not legacy)
- ✅ Valid JsonLine objects

### 3. Start Development Server

```bash
npm start
```

Navigate to your new explorer and verify:

- Stage navigation works (arrow keys, buttons)
- Input/output displays correctly
- YAML code is readable
- Descriptions are clear
- No console errors

### 4. Build for Production

```bash
npm run build
```

Ensure the build succeeds with no errors (broken link warnings are okay for incomplete examples).

## Best Practices

### Writing Stage Descriptions

✅ **Good:** "Delete the password field using `.without('password')` to comply with GDPR's data minimization principle. This reduces breach liability by 90%."

❌ **Bad:** "This stage removes the password."

**Guidelines:**

- Explain **why**, not just **what**
- Include business impact (compliance, cost savings, performance)
- Reference specific Bloblang functions or YAML features
- Use concrete numbers when possible

### Choosing Stage Count

- **3 stages:** Simple transformations (filtering, field deletion)
- **4-5 stages:** Moderate complexity (multi-step processing, validation)
- **6+ stages:** Complex production pipelines (parse → validate → enrich → filter → redact → route)

### Visual Highlighting

Use `type` property strategically:

- `type: 'removed'` - Fields deleted or filtered out (shown in red)
- `type: 'highlighted'` - New or transformed fields (shown in green)
- `type: 'normal'` or omit - No special highlighting

### YAML Configuration

- Include **complete, working** pipeline configs (users often copy-paste)
- Use environment variables with `.or()` fallbacks: `env("API_KEY").or("default")`
- Add comments explaining non-obvious logic
- Show realistic timeouts, batch sizes, retry policies

### Example Titles

✅ **Good:** "Delete Payment Card PII", "Aggregate Time Windows", "Fan-Out Pattern"

❌ **Bad:** "Example 1", "Test Pipeline", "My Cool Feature"

**Guidelines:**

- Use imperative voice or noun phrases
- Be specific about the technique or pattern
- Avoid generic terms like "example" or "demo"

## Submitting Your Contribution

### 1. Create Feature Branch

```bash
git checkout -b feat/explorer-your-example-name
```

### 2. Commit Your Changes

```bash
git add docs/{category}/{name}* sidebars.ts
git commit -m "feat: add {example name} interactive explorer"
```

### 3. Push and Create PR

```bash
git push origin feat/explorer-your-example-name
```

Then create a pull request on GitHub with:

- **Title:** `feat: add {example name} interactive explorer`
- **Description:**
  - What problem does this example solve?
  - What pipeline pattern does it demonstrate?
  - Key learning outcomes for users
  - Link to any related documentation

### 4. Automated Checks

Your PR will trigger automated validation:

- ✅ Stage file validation (`npm run validate-stages`)
- ✅ TypeScript compilation (`npm run typecheck`)
- ✅ Build success (`npm run build`)
- ✅ GitHub Pages deployment preview

Fix any failing checks before requesting review.

## Getting Help

- **Questions?** Open a [GitHub Discussion](https://github.com/expanso/examples.expanso.io/discussions)
- **Found a bug?** Open a [GitHub Issue](https://github.com/expanso/examples.expanso.io/issues)
- **CLI tool docs:** See [scripts/README.md](scripts/README.md)
- **Stage type reference:** See [src/components/DataPipelineExplorer/types.ts](src/components/DataPipelineExplorer/types.ts)

---

**Thank you for contributing to Expanso Examples!** Your work helps developers worldwide build better, more secure data pipelines.
