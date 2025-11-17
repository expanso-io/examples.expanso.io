#!/bin/bash

# Interactive Examples Improvement Plan - Automated Implementation
# This script implements all phases in separate git branches for independent review

set -e  # Exit on error

REPO_DIR="/Users/daaronch/code/examples.expanso.io"
cd "$REPO_DIR"

echo "🚀 Starting Interactive Examples Improvement Plan Implementation"
echo "================================================================"
echo ""

# Ensure we're on main and up to date
echo "📍 Ensuring main branch is clean..."
git checkout main
git pull origin main

# Store the base commit for all branches
BASE_COMMIT=$(git rev-parse HEAD)

echo "✅ Base commit: $BASE_COMMIT"
echo ""

# ==============================================================================
# PHASE 1: HIGH PRIORITY EXPLORERS
# ==============================================================================

echo "🏗️  PHASE 1A: Creating delete-payment-pii explorer..."
git checkout -b feat/explorer-delete-payment-pii
cat > "$REPO_DIR/phase1a.claude.md" << 'EOF'
Create interactive explorer for delete-payment-pii example:

1. Create docs/data-security/delete-payment-pii-full.stages.ts with 3 stages:
   - Stage 1: Original - Raw payment data with credit card numbers
   - Stage 2: Delete Card Numbers - Remove full_number, expiry (PCI-DSS)
   - Stage 3: Preserve Analytics - Keep last_four, card_type for fraud detection

2. Create docs/data-security/delete-payment-pii/explorer.mdx with:
   - DataPipelineExplorer component
   - Modern button styling
   - Proper frontmatter and description

3. Update sidebars.ts to include the explorer after index.mdx

Use the circuit-breakers explorer as a reference for structure and styling.
EOF
echo "📝 Instructions saved to phase1a.claude.md"
echo "   Run: claude --file phase1a.claude.md"
echo ""

# ==============================================================================

echo "🏗️  PHASE 1B: Creating enforce-schema explorer..."
git checkout main
git checkout -b feat/explorer-enforce-schema
cat > "$REPO_DIR/phase1b.claude.md" << 'EOF'
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
EOF
echo "📝 Instructions saved to phase1b.claude.md"
echo ""

# ==============================================================================

echo "🏗️  PHASE 1C: Creating filter-severity explorer..."
git checkout main
git checkout -b feat/explorer-filter-severity
cat > "$REPO_DIR/phase1c.claude.md" << 'EOF'
Create interactive explorer for filter-severity example:

1. Create docs/log-processing/filter-severity-full.stages.ts with 3 stages:
   - Stage 1: Original - All log levels mixed (DEBUG, INFO, WARN, ERROR)
   - Stage 2: Parse & Classify - Extract severity from log messages
   - Stage 3: Filter & Route - Drop DEBUG/TRACE, route ERROR/WARN/INFO

2. Create docs/log-processing/filter-severity/explorer.mdx

3. Update sidebars.ts to include the explorer
EOF
echo "📝 Instructions saved to phase1c.claude.md"
echo ""

# ==============================================================================

echo "🏗️  PHASE 1D: Creating normalize-timestamps explorer..."
git checkout main
git checkout -b feat/explorer-normalize-timestamps
cat > "$REPO_DIR/phase1d.claude.md" << 'EOF'
Create interactive explorer for normalize-timestamps example:

1. Create docs/data-transformation/normalize-timestamps-full.stages.ts with 3 stages:
   - Stage 1: Original - Mixed formats (ISO, Unix epoch, custom)
   - Stage 2: Parse Formats - Detect and parse multiple formats
   - Stage 3: Normalize to UTC - Convert to ISO 8601 UTC + metadata

2. Create docs/data-transformation/normalize-timestamps/explorer.mdx

3. Update sidebars.ts to include the explorer
EOF
echo "📝 Instructions saved to phase1d.claude.md"
echo ""

# ==============================================================================

echo "🏗️  PHASE 1E: Creating transform-formats explorer..."
git checkout main
git checkout -b feat/explorer-transform-formats
cat > "$REPO_DIR/phase1e.claude.md" << 'EOF'
Create interactive explorer for transform-formats example:

1. Create docs/data-transformation/transform-formats-full.stages.ts with 4 stages:
   - Stage 1: Original - JSON input
   - Stage 2: JSON to Avro - Schema evolution, compression
   - Stage 3: Avro to Parquet - Columnar storage
   - Stage 4: Auto-Detection - Detect format, apply transformation

2. Create docs/data-transformation/transform-formats/explorer.mdx

3. Update sidebars.ts to include the explorer
EOF
echo "📝 Instructions saved to phase1e.claude.md"
echo ""

# ==============================================================================

echo "🏗️  PHASE 1F: Creating production-pipeline explorer..."
git checkout main
git checkout -b feat/explorer-production-pipeline
cat > "$REPO_DIR/phase1f.claude.md" << 'EOF'
Create interactive explorer for production-pipeline example:

1. Create docs/log-processing/production-pipeline-full.stages.ts with 6 stages:
   - Stage 1: Original - Raw HTTP input
   - Stage 2: Parse & Validate - Extract fields, validate schema
   - Stage 3: Enrich Metadata - Add timestamps, correlation IDs
   - Stage 4: Filter & Score - Drop low-value logs, add priority
   - Stage 5: Redact PII - Remove sensitive data
   - Stage 6: Fan-Out - Route to Kafka, S3, Elasticsearch

2. Create docs/log-processing/production-pipeline/explorer.mdx

3. Update sidebars.ts to include the explorer

This is the most complex pipeline with 6 stages.
EOF
echo "📝 Instructions saved to phase1f.claude.md"
echo ""

# ==============================================================================
# PHASE 2: CONVERT LEGACY STAGE FILES
# ==============================================================================

echo "🏗️  PHASE 2: Creating legacy conversion branch..."
git checkout main
git checkout -b refactor/convert-legacy-stage-files
cat > "$REPO_DIR/phase2.claude.md" << 'EOF'
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
EOF
echo "📝 Instructions saved to phase2.claude.md"
echo ""

# ==============================================================================
# PHASE 3A: CLI TOOL
# ==============================================================================

echo "🏗️  PHASE 3A: Creating CLI tool branch..."
git checkout main
git checkout -b feat/cli-create-explorer
cat > "$REPO_DIR/phase3a.claude.md" << 'EOF'
Create CLI tool to generate explorer boilerplate:

1. Create scripts/create-explorer.ts:
   - Accept arguments: --name, --category, --stages, --title
   - Generate:
     * docs/{category}/{name}-full.stages.ts (with Stage type template)
     * docs/{category}/{name}/explorer.mdx (with proper frontmatter)
   - Update sidebars.ts with new explorer entry
   - Create placeholder JsonLine data for each stage

2. Add npm script to package.json:
   "create-explorer": "ts-node scripts/create-explorer.ts"

3. Create README for the tool with usage examples

Example usage:
npm run create-explorer -- --name "my-example" --category "data-routing" --stages 4 --title "My Example"
EOF
echo "📝 Instructions saved to phase3a.claude.md"
echo ""

# ==============================================================================
# PHASE 3B: SHARED COMPONENTS
# ==============================================================================

echo "🏗️  PHASE 3B: Creating shared components branch..."
git checkout main
git checkout -b feat/shared-components
cat > "$REPO_DIR/phase3b.claude.md" << 'EOF'
Create shared components to replace inline styles:

1. Create src/components/Button/index.tsx:
   - Props: href, variant ('primary' | 'secondary'), children
   - Includes all modern styling (flexbox, shadows, transitions)
   - Proper TypeScript types

2. Create src/components/ExplorerSection/index.tsx:
   - Props: setupLink, completeLink
   - Renders "Try It Yourself" section with 2 buttons

3. Update ALL explorer.mdx and tutorial .mdx files (81 files total):
   - Replace inline button styles with <Button> component
   - Replace "Try It Yourself" sections with <ExplorerSection>

4. Create src/components/Button/README.md with usage examples
EOF
echo "📝 Instructions saved to phase3b.claude.md"
echo ""

# ==============================================================================
# PHASE 3C: VALIDATION & TESTING
# ==============================================================================

echo "🏗️  PHASE 3C: Creating validation & testing branch..."
git checkout main
git checkout -b feat/validation-testing
cat > "$REPO_DIR/phase3c.claude.md" << 'EOF'
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
EOF
echo "📝 Instructions saved to phase3c.claude.md"
echo ""

# ==============================================================================
# PHASE 3D: DOCUMENTATION
# ==============================================================================

echo "🏗️  PHASE 3D: Creating documentation branch..."
git checkout main
git checkout -b docs/contributing-interactive-examples
cat > "$REPO_DIR/phase3d.claude.md" << 'EOF'
Add comprehensive documentation:

1. Create or update CONTRIBUTING.md with new section:
   "Adding Interactive Examples"
   - How to use create-explorer CLI
   - Stage data format best practices
   - How to test explorers locally
   - Common issues and debugging

2. Create docs/internal/EXAMPLE_PATTERNS.md:
   - Design patterns for stages
   - Visual design guidelines
   - Accessibility requirements

3. Update README.md with:
   - Link to interactive examples
   - Development commands
   - Testing instructions
EOF
echo "📝 Instructions saved to phase3d.claude.md"
echo ""

# ==============================================================================
# PHASE 4: AUTOMATION
# ==============================================================================

echo "🏗️  PHASE 4: Creating automation branch..."
git checkout main
git checkout -b feat/example-health-dashboard
cat > "$REPO_DIR/phase4.claude.md" << 'EOF'
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
EOF
echo "📝 Instructions saved to phase4.claude.md"
echo ""

# ==============================================================================
# SUMMARY
# ==============================================================================

git checkout main

echo ""
echo "=========================================="
echo "✅ SETUP COMPLETE!"
echo "=========================================="
echo ""
echo "Created git branches:"
echo "  📊 feat/explorer-delete-payment-pii"
echo "  📊 feat/explorer-enforce-schema"
echo "  📊 feat/explorer-filter-severity"
echo "  📊 feat/explorer-normalize-timestamps"
echo "  📊 feat/explorer-transform-formats"
echo "  📊 feat/explorer-production-pipeline"
echo "  🔧 refactor/convert-legacy-stage-files"
echo "  🛠️  feat/cli-create-explorer"
echo "  🎨 feat/shared-components"
echo "  ✅ feat/validation-testing"
echo "  📚 docs/contributing-interactive-examples"
echo "  🤖 feat/example-health-dashboard"
echo ""
echo "Instructions files created:"
for file in phase*.claude.md; do
  echo "  📝 $file"
done
echo ""
echo "To execute all phases overnight, run:"
echo ""
echo "  for file in phase*.claude.md; do"
echo "    echo \"Processing \$file...\""
echo "    branch=\$(grep -l \"\$file\" .git/logs/refs/heads/* | head -1 | sed 's|.*/||')"
echo "    git checkout \$branch"
echo "    claude --file \$file"
echo "    git add ."
echo "    git commit -m \"Implement \${file%.claude.md}\""
echo "  done"
echo ""
echo "Or process each phase individually with Claude Code."
echo ""
echo "All branches are ready for implementation!"
