# Interactive Explorer CLI Tools

This directory contains CLI tools for creating, validating, and monitoring interactive examples.

## Quick Reference

```bash
npm run create-explorer      # Generate new example boilerplate
npm run validate-stages       # Validate stage file format
npm run check-health          # Verify interactive scaffold files
npm run coverage-report       # Report scaffold file coverage
```

---

## create-explorer

Generate a starter scaffold for a new interactive explorer.

### Usage

```bash
npm run create-explorer -- --name "<example-name>" --category "<category>" --stages <number> --title "<Title>"
```

### Parameters

- `--name`: URL-friendly name (e.g., "circuit-breakers", "remove-pii")
- `--category`: One of: `data-routing`, `data-security`, `data-transformation`, `log-processing`
- `--stages`: Number of stages in the pipeline (e.g., 3, 4, 5)
- `--title`: Human-readable title (e.g., "Circuit Breaker Patterns")

### Examples

**Create a new data routing example:**
```bash
npm run create-explorer -- \
  --name "load-balancing" \
  --category "data-routing" \
  --stages 4 \
  --title "Load Balancing Strategies"
```

**Create a new security example:**
```bash
npm run create-explorer -- \
  --name "tokenization" \
  --category "data-security" \
  --stages 3 \
  --title "Data Tokenization"
```

**Create a new transformation example:**
```bash
npm run create-explorer -- \
  --name "denormalize-data" \
  --category "data-transformation" \
  --stages 5 \
  --title "Data Denormalization"
```

### What Gets Generated

The CLI tool generates **4 files** and updates the sidebar:

1. **Stage file**: `docs/{category}/{name}-full.stages.ts`
   - TypeScript file with Stage type import
   - Template for each stage with TODO markers
   - Placeholder input/output JsonLine data

2. **Index page**: `docs/{category}/{name}/index.mdx`
   - Introduction and overview
   - Problem/solution/business impact sections
   - Use cases, benefits, trade-offs
   - Navigation to other pages

3. **Explorer page**: `docs/{category}/{name}/explorer.mdx`
   - Interactive DataPipelineExplorer component
   - ExplorerSection component (shared, no inline styles)
   - Stage descriptions and learning outcomes
   - Proper frontmatter and SEO metadata

4. **Setup guide**: `docs/{category}/{name}/setup.mdx`
   - Prerequisites and installation steps
   - Environment configuration
   - Project setup instructions
   - Troubleshooting section

**Sidebar entry**: Updates `sidebars.ts`
   - Adds new example to appropriate category
   - Includes all 3 pages (index, explorer, setup)
   - Configured as collapsible nested item

### After Generation

1. **Edit the stages file** (`{name}-full.stages.ts`):
   - Replace TODO markers with actual descriptions
   - Add real YAML pipeline configurations
   - Create meaningful input/output data representations

2. **Edit the explorer page** (`explorer.mdx`):
   - Update stage descriptions
   - Add learning outcomes
   - Customize common questions section

3. **Create supporting files**:
   - `{name}/index.mdx` - Introduction and overview
   - `{name}/setup.mdx` - Environment setup guide
   - `{name}/step-*.mdx` - Step-by-step tutorial pages
   - `{name}/complete-*.mdx` - Complete solution page

4. **Test locally**:
   ```bash
   npm start
   ```
   Navigate to your new explorer and verify it renders correctly.

5. **Build and validate**:
   ```bash
   npm run build
   npm run typecheck
   ```

### Tips

- **Stage count**: 3-6 stages work best for interactive explorers
- **Names**: Use kebab-case (hyphenated lowercase)
- **Titles**: Use title case for proper nouns
- **Categories**: Stick to the 4 standard categories for consistency

### File Structure

After generation, your example will have this structure:

```
docs/
└── {category}/
    ├── {name}-full.stages.ts          # Stage definitions (generated ✅)
    └── {name}/
        ├── index.mdx                   # Introduction (generated ✅)
        ├── explorer.mdx                # Interactive explorer (generated ✅)
        ├── setup.mdx                   # Setup guide (generated ✅)
        ├── step-1-*.mdx               # Tutorial steps (create manually)
        ├── step-2-*.mdx               # Tutorial steps (create manually)
        └── complete-*.mdx             # Complete solution (create manually)
```

**Generated automatically:** Stage file, index page, explorer page, and setup guide.

Replace the starter text in those files, then create the step-by-step tutorial pages and complete solution page required for the example.

### Troubleshooting

**Error: File already exists**
- The tool won't overwrite existing files
- Choose a different name or delete the existing files first

**Error: Unknown category**
- Use one of the 4 standard categories
- Check spelling and use lowercase with hyphens

**TypeScript errors after generation**
- Run `npm run typecheck` to identify issues
- Ensure DataPipelineExplorer component is available
- Check that Stage type is imported correctly

---

## validate-stages

Validates all `*-full.stages.ts` files for correctness and format compliance.

### Usage

```bash
npm run validate-stages
```

### What It Checks

✅ **Stage type import** - Ensures `import type { Stage }` is present
✅ **Proper export** - Verifies `export const XStages: Stage[] = [...]`
✅ **Sequential IDs** - Confirms stage IDs are 1, 2, 3, ... (no gaps)
✅ **Required properties** - Checks id, title, description, yamlCode, yamlFilename, inputLines, outputLines
✅ **New format** - Detects legacy `input`/`output` strings instead of `inputLines`/`outputLines` arrays
✅ **Valid JsonLine** - Ensures JsonLine objects have `content` and `indent` properties

### Exit Codes

- `0` - All stage files are valid
- `1` - Validation errors found (details printed to console)

### Example Output

```
🔍 Validating stage files...

Found 15 stage file(s):

✅ docs/data-routing/circuit-breakers-full.stages.ts
✅ docs/data-security/remove-pii-full.stages.ts
❌ docs/data-transformation/parse-logs-full.stages.ts
   ❌ Uses legacy "input" property instead of "inputLines"
   ❌ Stage IDs are not sequential. Found: [1, 2, 4], expected: [1, 2, 3]

================================================================================

📊 Validation Summary:
   Valid files: 14/15
   Errors: 2
   Warnings: 0

❌ Validation failed
```

### Use in CI/CD

The validation script runs automatically in GitHub Actions on every PR. See `.github/workflows/validate-stages.yml`.

---

## check-health

Inventories stage-backed interactive scaffolds in the four original categories and verifies their required files.

This is a structural repository check. It does not inventory every published example family or assess runtime behavior, content quality, operational evidence, or production readiness.

### Usage

```bash
# Check all discovered stage-backed scaffolds
npm run check-health

# Check specific category
npm run check-health -- --category data-routing

# Get JSON output for automation
npm run check-health -- --format json
```

### What It Checks

For each discovered scaffold, checks for these 4 required files:

1. **Stage file** (`*-full.stages.ts`)
2. **Explorer page** (`explorer.mdx`)
3. **Index page** (`index.mdx`)
4. **Setup guide** (`setup.mdx`)

### File Coverage Levels

- **Structurally complete (100%)**: All 4 files present
- **Partial (50-99%)**: 2-3 files present
- **Minimal (below 50%)**: Only 1 file present

### Example Output

```
📊 Interactive Scaffold Inventory

================================================================================

Scope: stage-backed interactive scaffolds in four original categories.
This check verifies four required files only.

📈 Structural Statistics:
   Total Scaffolds: 15
   ✅ Required Files Present: 8
   ⚠️  Partial File Sets (50-99%): 5
   ❌ Minimal File Sets (<50%): 2
   📊 Average File Coverage: 73%

📂 Category Breakdown:

✅ data-routing:
   Scaffolds: 4
   Required files present: 3, Partial: 1, Minimal: 0
   Average file coverage: 88%

⚠️ data-security:
   Scaffolds: 4
   Required files present: 2, Partial: 2, Minimal: 0
   Average file coverage: 75%

...

================================================================================
```

### Exit Codes

- `0` - Every discovered scaffold has all four required files
- `1` - One or more discovered scaffolds is missing a required file, or the inventory failed

### Use in CI/CD

The structural check runs automatically via `.github/workflows/example-health.yml`:
- On pull requests that change stage-backed docs, the inventory scripts, or the workflow itself
- Daily at 9am UTC (tracks progress)
- Manual trigger available

---

## coverage-report

Generates a markdown report showing required-file coverage for the same stage-backed interactive scaffold scope.

### Usage

```bash
# Print report to console
npm run coverage-report

# Save a local report
npm run coverage-report -- --output COVERAGE.md
```

### Report Contents

- **Overview**: Discovered scaffolds, required-file coverage, visual progress bar
- **Category breakdown**: Tables showing which scaffolds have which files
- **Missing files**: Detailed list of required files that are absent
- **Next steps**: Prioritized recommendations for improvement

### Example Output

````markdown
# Interactive Scaffold File Coverage

**Generated:** 2025-11-17

## Overview

- **Stage-backed scaffolds discovered:** 15
- **All required files present:** 8 (53%)
- **Partial file sets:** 5 (33%)
- **Minimal file sets:** 2 (13%)
- **Average required-file coverage:** 73%

```
███████████████░░░░░ 73%
```

## Category Breakdown

### data-routing

| Scaffold | Stage File | Explorer | Index | Setup | File Coverage |
|---------|-----------|----------|-------|-------|------------|
| circuit-breakers | ✅ | ✅ | ✅ | ✅ | ✅ 100% |
| fan-out-pattern | ✅ | ✅ | ✅ | ❌ | ⚠️ 75% |

...
````

### Use in CI/CD

The workflow uploads the generated report as a short-lived GitHub Actions artifact. It is not published with the site or committed by automation.

---

## Related Documentation

- [Stage Type Reference](../src/components/DataPipelineExplorer/types.ts)
- [Contributing Guide](../CONTRIBUTING.md)
