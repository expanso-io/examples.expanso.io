# Interactive Examples Improvement Plan

**Status:** Planning Phase
**Last Updated:** 2025-01-16
**Goal:** Standardize all examples with interactive explorers and centralized tooling

---

## Executive Summary

This plan addresses inconsistencies in the examples.expanso.io documentation site by:
1. Adding interactive explorers to 6 examples that currently lack them
2. Converting 9 legacy stage files to the standardized Stage type
3. Building centralized tooling to simplify creating and maintaining examples
4. Establishing automated testing and validation infrastructure

**Impact:** Consistent, engaging user experience across all 18 examples

---

## Current State Analysis

### ✅ Examples WITH Interactive Explorers (12/18)

| Example | Category | Stage File Format | Status |
|---------|----------|-------------------|--------|
| circuit-breakers | data-routing | ✓ Correct | ✅ Complete |
| content-routing | data-routing | ✓ Correct | ✅ Complete |
| content-splitting | data-routing | ⚠️ Legacy | 🔄 Works (transformer) |
| fan-out-pattern | data-routing | ⚠️ Legacy | 🔄 Works (transformer) |
| priority-queues | data-routing | ⚠️ Legacy | 🔄 Works (transformer) |
| encrypt-data | data-security | ⚠️ Legacy | 🔄 Works (transformer) |
| encryption-patterns | data-security | ⚠️ Legacy | 🔄 Works (transformer) |
| remove-pii | data-security | ✓ Correct | ✅ Complete |
| aggregate-time-windows | data-transformation | ⚠️ Legacy | 🔄 Works (transformer) |
| deduplicate-events | data-transformation | ⚠️ Legacy | 🔄 Works (transformer) |
| parse-logs | data-transformation | ⚠️ Legacy | 🔄 Works (transformer) |
| enrich-export | log-processing | ⚠️ Legacy | 🔄 Works (transformer) |

### ❌ Examples WITHOUT Interactive Explorers (6/18)

| Example | Category | Steps | Priority | Complexity |
|---------|----------|-------|----------|------------|
| delete-payment-pii | data-security | 3 | HIGH | Medium |
| enforce-schema | data-security | 4 | HIGH | Medium |
| filter-severity | log-processing | 3 | MEDIUM | Low |
| normalize-timestamps | data-transformation | 3 | MEDIUM | Low |
| transform-formats | data-transformation | 4 | LOW | Medium |
| production-pipeline | log-processing | 6 | LOW | High |

**Priority Rationale:**
- **HIGH:** Core security features (PII, schema validation)
- **MEDIUM:** Common transformations (filtering, timestamps)
- **LOW:** Advanced topics (format conversion, complex pipelines)

---

## Phase 1: Missing Interactive Explorers (6 Examples)

### 1.1 High Priority Examples (2)

#### delete-payment-pii
**Stages (3):**
1. Original - Raw payment data with full credit card numbers
2. Delete Card Numbers - Remove full_number, expiry (PCI-DSS Level 1)
3. Preserve Analytics - Keep last_four, card_type for fraud detection

**Files to Create:**
- `docs/data-security/delete-payment-pii-full.stages.ts`
- `docs/data-security/delete-payment-pii/explorer.mdx`

**Complexity:** Medium (needs proper PII examples without real data)

---

#### enforce-schema
**Stages (4):**
1. Original - No validation, accepts any JSON
2. Define Schema - JSON Schema with required fields and types
3. Validate & Route - Accept valid, reject invalid to DLQ
4. Monitor Quality - Track validation metrics and schema violations

**Files to Create:**
- `docs/data-security/enforce-schema-full.stages.ts`
- `docs/data-security/enforce-schema/explorer.mdx`

**Complexity:** Medium (requires showing schema validation visually)

---

### 1.2 Medium Priority Examples (2)

#### filter-severity
**Stages (3):**
1. Original - All log levels mixed together
2. Parse & Classify - Extract severity from log messages
3. Filter & Route - Drop DEBUG/TRACE, route ERROR/WARN/INFO

**Files to Create:**
- `docs/log-processing/filter-severity-full.stages.ts`
- `docs/log-processing/filter-severity/explorer.mdx`

**Complexity:** Low (straightforward filtering logic)

---

#### normalize-timestamps
**Stages (3):**
1. Original - Mixed timestamp formats (ISO, Unix, custom)
2. Parse Formats - Detect and parse multiple timestamp formats
3. Normalize to UTC - Convert all to ISO 8601 UTC with metadata

**Files to Create:**
- `docs/data-transformation/normalize-timestamps-full.stages.ts`
- `docs/data-transformation/normalize-timestamps/explorer.mdx`

**Complexity:** Low (timestamp examples are clear)

---

### 1.3 Low Priority Examples (2)

#### transform-formats
**Stages (4):**
1. Original - JSON input
2. JSON to Avro - Schema evolution, compression
3. Avro to Parquet - Columnar storage optimization
4. Auto-Detection - Detect format, apply correct transformation

**Files to Create:**
- `docs/data-transformation/transform-formats-full.stages.ts`
- `docs/data-transformation/transform-formats/explorer.mdx`

**Complexity:** Medium (showing binary formats in UI is tricky)

---

#### production-pipeline
**Stages (6):**
1. Original - Raw HTTP input, no processing
2. Parse & Validate - Extract fields, validate schema
3. Enrich Metadata - Add timestamps, source info, correlation IDs
4. Filter & Score - Drop low-value logs, add priority scores
5. Redact PII - Remove sensitive data (emails, IPs, cards)
6. Fan-Out - Route to multiple destinations (Kafka, S3, Elastic)

**Files to Create:**
- `docs/log-processing/production-pipeline-full.stages.ts`
- `docs/log-processing/production-pipeline/explorer.mdx`

**Complexity:** High (most complex pipeline, 6 stages)

---

## Phase 2: Convert Legacy Stage Files (9 Files)

**Goal:** Migrate all stage files to use proper Stage type with inputLines/outputLines

### Files Requiring Conversion

1. `content-splitting-full.stages.ts` - Uses `stage`, `input`, `output` (objects)
2. `fan-out-pattern-full.stages.ts` - Uses custom format
3. `priority-queues-full.stages.ts` - Uses `inputData`, `outputData`, `yamlConfig`
4. `encrypt-data-full.stages.ts` - Uses custom format
5. `encryption-patterns-full.stages.ts` - Uses custom format
6. `aggregate-time-windows-full.stages.ts` - Uses custom format
7. `deduplicate-events-full.stages.ts` - Uses custom format
8. `parse-logs-full.stages.ts` - Uses custom format
9. `enrich-export-full.stages.ts` - Uses custom format

**Why Convert?**
- Currently relying on stageTransformer.ts runtime conversion
- Adds complexity and potential runtime errors
- Harder to type-check and validate
- Inconsistent developer experience

**Conversion Strategy:**
- Create conversion script that parses old format, generates new format
- Validate output matches transformer results
- Test each explorer after conversion
- Can be done incrementally without breaking changes

---

## Phase 3: Centralized Tooling & Infrastructure

### 3.1 CLI Tool: `create-explorer`

**Purpose:** Generate boilerplate for new interactive examples

**Usage:**
```bash
npm run create-explorer -- \
  --name "my-example" \
  --category "data-transformation" \
  --stages 4 \
  --title "My Example Title"
```

**Generated Files:**
- `docs/{category}/{name}-full.stages.ts` (with Stage type template)
- `docs/{category}/{name}/explorer.mdx` (with proper frontmatter)
- Adds entry to `sidebars.ts`
- Creates placeholder stage data for each stage

**Benefits:**
- Consistent file structure
- Correct TypeScript types from day one
- Reduces copy-paste errors
- 5 minutes instead of 30 minutes per example

---

### 3.2 Shared Components

#### Button Component
**File:** `src/components/Button/index.tsx`

Replace inline button styles across 81 files with:
```tsx
import { Button } from '@site/src/components/Button';

<Button href="./setup" variant="primary">
  Start Tutorial
</Button>
```

**Benefits:**
- Single source of truth for button styling
- Easy to update design system-wide
- Better accessibility (ARIA attributes)
- Reduced bundle size

---

#### ExplorerSection Component
**File:** `src/components/ExplorerSection/index.tsx`

Standardize the "Try It Yourself" section:
```tsx
import { ExplorerSection } from '@site/src/components/ExplorerSection';

<ExplorerSection
  setupLink="./setup"
  completeLink="./complete-pipeline"
/>
```

---

### 3.3 TypeScript Validation

**File:** `scripts/validate-stages.ts`

```bash
npm run validate:stages
```

**Checks:**
- All stage files import Stage type
- All stages have required properties (id, title, description, etc.)
- inputLines and outputLines are properly formatted
- YAML code is valid
- No duplicate stage IDs

**CI Integration:** Run on every PR to prevent broken examples

---

### 3.4 Testing Infrastructure

#### Unit Tests
**File:** `src/components/DataPipelineExplorer/__tests__/index.test.tsx`

Test:
- Stage navigation (previous/next buttons)
- Keyboard shortcuts (arrow keys)
- Stage data rendering
- Transformer handling of legacy formats

---

#### Visual Regression Tests
**Tool:** Playwright + Percy/Chromatic

Capture screenshots of each explorer:
- Initial state (stage 1)
- Final state (last stage)
- All stages in between

Prevents visual regressions when updating styles.

---

### 3.5 Documentation

**File:** `CONTRIBUTING.md` section on interactive examples

**Topics:**
- How to create a new interactive example
- Stage data format and best practices
- How to use the CLI tool
- How to test explorers locally
- Debugging common issues

---

## Phase 4: Automation & Maintenance

### 4.1 Automated Stage File Generation

**Tool:** AI-assisted stage generation from tutorial steps

Given existing step-by-step tutorial files, automatically:
1. Extract code examples from each step
2. Generate inputLines/outputLines from code
3. Create stage descriptions from step content
4. Validate generated stages

---

### 4.2 Example Health Dashboard

**File:** `scripts/example-health.ts`

Generate report showing:
- ✓ Has interactive explorer
- ✓ Stage file uses correct type
- ✓ All buttons have modern styling
- ✓ Tests passing
- ✓ Screenshots up to date

Run weekly, post to GitHub Issues if degradation detected.

---

### 4.3 Automated Updates

**GitHub Actions Workflow:** `.github/workflows/update-examples.yml`

Monthly job to:
- Update dependencies in all examples
- Run validation suite
- Update button styling if design system changes
- Create PR with changes

---

## Implementation Roadmap

### Week 1: High Priority Explorers
- ✅ Day 1-2: delete-payment-pii explorer
- ✅ Day 3-4: enforce-schema explorer
- ✅ Day 5: Testing & validation

### Week 2: Medium Priority Explorers + Tooling
- ✅ Day 1-2: filter-severity + normalize-timestamps explorers
- ✅ Day 3-5: Build CLI tool (create-explorer)

### Week 3: Low Priority Explorers + Components
- ✅ Day 1-3: transform-formats explorer
- ✅ Day 4-5: production-pipeline explorer (complex)

### Week 4: Infrastructure & Conversion
- ✅ Day 1-2: Create shared Button component
- ✅ Day 3-4: TypeScript validation script
- ✅ Day 5: Documentation

### Week 5: Legacy Stage File Conversion
- ✅ Day 1-2: Build conversion script
- ✅ Day 3-5: Convert all 9 legacy files

### Week 6: Testing & Polish
- ✅ Day 1-3: Write tests for all explorers
- ✅ Day 4-5: Visual regression testing setup

---

## Success Metrics

### Completion Criteria
- [ ] All 18 examples have interactive explorers
- [ ] All stage files use correct Stage type
- [ ] All buttons use shared Button component
- [ ] TypeScript validation passes for all examples
- [ ] Tests cover all explorers (>80% coverage)
- [ ] Documentation complete

### Performance Metrics
- **Time to create new example:** 30 min → 5 min (6x faster)
- **Consistency:** 67% → 100% (all examples same pattern)
- **Maintainability:** Manual updates → Automated via scripts

### User Impact
- **Engagement:** More interactive content = longer time on site
- **Learning:** Visual explorers = better understanding
- **Satisfaction:** Consistent UX = better experience

---

## Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Stage file conversion breaks explorers | High | Medium | Thorough testing, rollback plan |
| CLI tool generates invalid code | Medium | Low | Validation in tool, manual review |
| Visual regression tests flaky | Low | High | Stabilization period, retries |
| Too much automation complexity | Medium | Medium | Start simple, iterate based on needs |

---

## Next Steps

1. **Review & Approve Plan** - Get stakeholder buy-in
2. **Set Up Project Board** - Track tasks in GitHub Projects
3. **Assign Owners** - Who builds what
4. **Start Week 1** - Begin with high-priority explorers

---

## Questions for Discussion

1. Should we convert legacy stage files immediately or wait until after all explorers are built?
2. What's the priority order for shared components (Button first vs. other components)?
3. Should the CLI tool be part of this repo or a separate package?
4. What CI/CD platform should we use for automated validation?
5. Should we add explorer previews to the main index page?

---

## Appendix A: File Structure Template

```
docs/{category}/{example}/
├── index.mdx                    # Overview
├── explorer.mdx                 # Interactive explorer (NEW)
├── setup.mdx                    # Setup instructions
├── step-1-{name}.mdx           # Tutorial step 1
├── step-2-{name}.mdx           # Tutorial step 2
├── ...
├── complete-{example}.mdx      # Complete solution
└── troubleshooting.mdx         # Common issues

docs/{category}/{example}-full.stages.ts  # Stage data (uses Stage type)
```

---

## Appendix B: Stage Type Reference

```typescript
export type JsonLine = {
  content: string;
  indent: number;
  type?: 'removed' | 'highlighted' | 'normal';
  key?: string;
  valueType?: 'string' | 'number' | 'boolean' | 'null';
};

export type Stage = {
  id: number;
  title: string;
  description: string;
  inputLines: JsonLine[];
  outputLines: JsonLine[];
  yamlCode: string;
  yamlFilename: string;
};
```

---

**Document Owner:** Development Team
**Last Review:** 2025-01-16
**Next Review:** After Phase 1 completion
