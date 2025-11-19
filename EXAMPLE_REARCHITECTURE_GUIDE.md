# Example Rearchitecture Guide

**Purpose:** Transform single-page examples into hierarchical, discoverable, best-of-breed documentation experiences.

**Status:** ✅ Successfully implemented for "Remove PII" example
**Next:** Apply this pattern to all remaining examples

---

## Table of Contents

1. [Philosophy & Principles](#philosophy--principles)
2. [Architecture Pattern](#architecture-pattern)
3. [File Structure](#file-structure)
4. [Content Templates](#content-templates)
5. [Implementation Checklist](#implementation-checklist)
6. [Quality Standards](#quality-standards)
7. [Agent Instructions](#agent-instructions)

---

## Philosophy & Principles

### Core Design Philosophy

**Discoverability First**
- Users should find what they need through progressive disclosure
- Hierarchical navigation (category → subcategories → specific topics)
- Multiple entry points (overview → interactive → step-by-step → quick deploy)

**Best-of-Breed Documentation**
- Every page should be comprehensive, not superficial
- Include troubleshooting, variations, and edge cases
- Real-world context (GDPR, PCI-DSS, compliance, security)
- Production-ready examples, not toy demos

**Progressive Learning**
- Start with the problem and why it matters
- Offer 3 learning paths: Interactive, Step-by-Step, Quick Deploy
- Each step builds on previous knowledge
- Clear navigation between related concepts

**Visual & Interactive**
- Use interactive explorers where possible (magicpath-project design)
- Before/after comparisons with syntax highlighting
- Visual indicators (✅ ❌ 🔴 🟡 🟢) for clarity
- Clean, modern UI with proper spacing and alignment

---

## Architecture Pattern

### Single-Page → Hierarchical Transformation

**Before (Single Page):**
```
docs/category/example.mdx         # One long page with everything
```

**After (Hierarchical):**
```
docs/category/example/
  ├── index.mdx                   # Introduction & learning paths
  ├── explorer.mdx                # Interactive visualization (if applicable)
  ├── setup.mdx                   # Environment setup & prerequisites
  ├── step-1-[concept].mdx        # First transformation/concept
  ├── step-2-[concept].mdx        # Second transformation/concept
  ├── step-N-[concept].mdx        # Nth transformation/concept
  ├── complete-[example].mdx      # Complete solution & deployment
  └── troubleshooting.mdx         # Common issues & solutions
```

### Page Hierarchy & Navigation

1. **Introduction (index.mdx)**
   - Problem statement
   - Solution overview (4-6 techniques/steps)
   - Why process at edge? (compliance, security, cost, speed)
   - 3 learning paths
   - Real-world impact metrics

2. **Interactive Explorer (explorer.mdx)** - OPTIONAL
   - Visual before/after comparisons
   - Step-by-step progression through transformations
   - Uses DataPipelineExplorer component with magicpath design
   - Import stages from `.stages.ts` file

3. **Setup Guide (setup.mdx)**
   - Prerequisites checklist
   - Environment variable configuration
   - Sample data download
   - Shell pipeline deployment (minimal test)
   - Verification steps

4. **Step-by-Step Tutorials (step-N-*.mdx)**
   - One concept per page (NOT combined)
   - Comprehensive 500+ line tutorials
   - Follow the Step Template (see below)

5. **Complete Pipeline (complete-[example].mdx)**
   - Full configuration combining all steps
   - Before/after comparison
   - Production deployment instructions
   - Secret management
   - Performance tuning
   - Error handling
   - Compliance audit trail
   - Testing checklist

6. **Troubleshooting (troubleshooting.mdx)**
   - 5+ issue categories
   - 20+ common problems with solutions
   - Diagnostic commands
   - Edge cases
   - Getting help resources

---

## File Structure

### Directory Layout

```
docs/[category]/[example]/
├── index.mdx                      # Introduction
├── explorer.mdx                   # Interactive (optional)
├── setup.mdx                      # Setup guide
├── step-1-[action]-[subject].mdx  # First step
├── step-2-[action]-[subject].mdx  # Second step
├── step-N-[action]-[subject].mdx  # Nth step
├── complete-[example].mdx         # Complete pipeline
└── troubleshooting.mdx            # Troubleshooting

docs/[category]/[example]-full.stages.ts  # Stage data for explorer (if applicable)

examples/[category]/[example]-complete.yaml  # Deployable YAML
```

### Naming Conventions

**MDX Files:**
- `index.mdx` - Always the introduction
- `explorer.mdx` - Always the interactive explorer (if applicable)
- `setup.mdx` - Always the setup guide
- `step-N-[verb]-[noun].mdx` - Steps use action verbs
  - Examples: `step-1-delete-payment-data.mdx`, `step-2-hash-ip-address.mdx`
- `complete-[example].mdx` - Complete solution
- `troubleshooting.mdx` - Troubleshooting guide

**Stage Files:**
- `[example]-full.stages.ts` - Stage definitions for interactive explorer

**YAML Files:**
- `[example]-complete.yaml` - Complete deployable pipeline

### Sidebar Configuration

**Update `sidebars.ts`:**

```typescript
{
  type: 'category',
  label: '[Category Name]',
  collapsible: true,
  collapsed: false,
  items: [
    // ... other items ...
    {
      type: 'category',
      label: '[Example Name]',
      collapsible: true,
      collapsed: true,  // Start collapsed
      // NO link property - category expands, doesn't navigate
      items: [
        '[category]/[example]/index',           // Introduction first
        '[category]/[example]/explorer',        // Interactive second (if applicable)
        '[category]/[example]/setup',           // Setup third
        '[category]/[example]/step-1-[...]',    // Steps in order
        '[category]/[example]/step-2-[...]',
        '[category]/[example]/step-N-[...]',
        '[category]/[example]/complete-[...]',  // Complete second-to-last
        '[category]/[example]/troubleshooting', // Troubleshooting last
      ],
    },
    // ... other items ...
  ],
}
```

**Important:**
- Remove old single-page `.mdx` file (backup as `.mdx.backup`)
- Category should NOT have `link` property (expands instead of navigating)
- Items are listed in learning order
- `sidebar_position` in frontmatter should match order (1, 2, 3, ...)

---

## Content Templates

### Template: Introduction (index.mdx)

```markdown
---
title: [Example Title]
sidebar_label: Introduction
sidebar_position: 1
description: [One-line description of what this example does]
keywords: [keyword1, keyword2, compliance-terms, use-cases]
---

# [Example Title]

**[One sentence elevator pitch]**. This step-by-step guide teaches you [N] essential techniques through an interactive explorer and hands-on exercises.

## The Problem

[Describe the user's pain point with a concrete example]

```json
{
  "example_field": "value",  // ❌ Problem indicator
  "another_field": "value"   // ✅ Good indicator
}
```

**The challenge:** [State the core challenge in one sentence]

## The Solution: [N] [Technique Type] Techniques

This guide teaches you how to apply the right technique for each [use case]:

### 1. **[Technique Name]** → [Use Cases]
[One-line description]
- **Use case:** [When to use]
- **Method:** [How it works]
- **Result:** [What you get]

[Repeat for each technique 2-N]

## Why Process at the Edge?

**[Benefit 1]:** [Explanation]
**[Benefit 2]:** [Explanation]
**[Benefit 3]:** [Explanation]
**[Benefit 4]:** [Explanation]

## What You'll Learn

By the end of this guide, you'll be able to:

✅ **[Action 1]** [description]
✅ **[Action 2]** [description]
✅ **[Action N]** [description]

## Get Started

### Option 1: Interactive Explorer (Recommended)
**See** each [technique] in action with side-by-side before/after views.

[**→ Launch Interactive Explorer**](./explorer)

### Option 2: Step-by-Step Tutorial
**Build** the [solution] incrementally, one concept at a time.

1. [**Setup Guide**](./setup) - [What it covers]
2. [**Step 1: [Name]**](./step-1-[...]) - [What it covers]
[... list all steps ...]

### Option 3: Jump to Final [Solution]
**Download** the complete, production-ready [solution].

[**→ Get Complete [Solution]**](./complete-[example])

## Who This Guide Is For

- **[Role 1]** [why they care]
- **[Role 2]** [why they care]
- **[Role 3]** [why they care]

## Prerequisites

- [Prerequisite 1]
- [Prerequisite 2]
- [Tool] installed ([link])

## Time to Complete

- **Interactive Explorer:** [X] minutes
- **Step-by-Step Tutorial:** [X-Y] minutes
- **Quick Deploy:** [X] minutes

## Real-World Impact

**Before [Solution]:**
```
- [Metric 1]: [value]
- [Metric 2]: [value]
```

**After [Solution]:**
```
- [Metric 1]: [improved value]
- [Metric 2]: [improved value]
```

---

## Next Steps

Ready to start? Choose your learning path:

<div style={{display: 'flex', gap: '1rem', marginTop: '2rem', marginBottom: '2rem', flexWrap: 'wrap'}}>
  <a href="./explorer" className="button button--primary button--lg" style={{flex: '1', minWidth: '200px'}}>
    Interactive Explorer
  </a>
  <a href="./setup" className="button button--secondary button--lg" style={{flex: '1', minWidth: '200px'}}>
    Step-by-Step Tutorial
  </a>
</div>

**Questions?** Check [Troubleshooting](./troubleshooting) or see [Related Examples](#related-examples) below.

## Related Examples

- [**[Related Example 1]**](../[example]) - [Why it's related]
- [**[Related Example 2]**](../[example]) - [Why it's related]
```

### Template: Interactive Explorer (explorer.mdx)

**Note:** Only create if you have progressive transformations to visualize

```markdown
---
title: Interactive [Example] Explorer
sidebar_label: Interactive Explorer
sidebar_position: 2
description: Explore [N] stages of [transformation] with live before/after comparisons
keywords: [example-name, interactive, tutorial, demo]
---

import DataPipelineExplorer from '@site/src/components/DataPipelineExplorer';
import { [exampleName]Stages } from '../[example]-full.stages';

# Interactive [Example] Explorer

**See [transformation] in action!** Use the interactive explorer below to step through [N] stages of [transformation]. Watch as [things being transformed] are progressively [transformed].

## How to Use This Explorer

1. **Navigate** using arrow keys (← →) or click the numbered stage buttons
2. **Compare** the Input (left) and Output (right) [format] at each stage
3. **Observe** how fields are [action1] (red strikethrough) or [action2] (green highlight)
4. **Inspect** the YAML code showing exactly what [component] was added
5. **Learn** from the stage description explaining the technique and [benefit]

## Interactive [Example] Explorer

<DataPipelineExplorer
  stages={[exampleName]Stages}
  title="[EXAMPLE NAME]"
  subtitle="[N]-Stage Progressive Transformation"
/>

## Understanding the Stages

### Stage 1: Original Input
[Description of baseline]

### Stage 2: [Transformation Name]
[Description of what happens]

[... repeat for all stages ...]

## What You've Learned

After exploring all [N] stages, you now understand:

✅ **[Concept 1]** - [What they learned]
✅ **[Concept 2]** - [What they learned]

## Try It Yourself

Ready to build this [solution]? Follow the step-by-step tutorial:

<div style={{display: 'flex', gap: '1rem', marginTop: '2rem', marginBottom: '2rem', flexWrap: 'wrap'}}>
  <a href="./setup" className="button button--primary button--lg" style={{flex: '1', minWidth: '200px'}}>
    Start Tutorial
  </a>
  <a href="./complete-[example]" className="button button--secondary button--lg" style={{flex: '1', minWidth: '200px'}}>
    Download Complete [Solution]
  </a>
</div>

## Deep Dive into Each Step

Want to understand each transformation in depth?

- [**Step 1: [Name]**](./step-1-[...]) - [What it teaches]
[... list all steps ...]

## Common Questions

### [Question 1]?
[Answer]

### [Question 2]?
[Answer]

---

**Next:** [Set up your environment](./setup) to build this [solution] yourself
```

### Template: Setup Guide (setup.mdx)

```markdown
---
title: Setup Environment for [Example]
sidebar_label: Setup
sidebar_position: 3
description: Configure environment variables, [resources], and deploy a shell [solution]
keywords: [setup, environment, configuration, deployment]
---

# Setup Environment for [Example]

Before building the [solution], you'll set up [what needs setup].

## Prerequisites

- ✅ [Tool/Platform] installed ([Installation Guide](link))
- ✅ [Resource] available
- ✅ Basic familiarity with [technology]

## Step 1: [Setup Action 1]

[Description of what and why]

```bash
# [Command description]
[command]

# Verify [something]
[verification command]
```

[Repeat for each setup step]

## Step N: Deploy Shell [Solution]

Before adding [functionality], deploy a minimal "shell" [solution] that just [basic function]. This verifies your setup works.

Create `shell-[example].yaml`:

```yaml title="shell-[example].yaml"
[YAML content]
```

Deploy the shell [solution]:

```bash
# Deploy to [platform]
[deploy command]

# Verify deployment
[verify command]
```

**Expected output:**
```
[What success looks like]
```

## Step N+1: Test Shell [Solution]

[How to test]

```bash
# [Test description]
[test command]

# Check the output
[check command]
```

**Expected output:** [What they should see]

:::tip Success!
If you see [success indicator], your environment is correctly configured!

**Next step:** [What to do next]
:::

## Step N+2: Verify [Prerequisites]

Before proceeding, verify all required [resources] are [ready]:

```bash
# Run this verification script
[verification script]
```

## Troubleshooting

### [Common Issue 1]

**Symptom:** [What they see]

**Solution:**
```bash
[How to fix]
```

[Repeat for 3-5 common issues]

---

## Next Steps

Environment configured! Now build the [solution] step-by-step:

<div style={{display: 'flex', gap: '1rem', marginTop: '2rem', marginBottom: '2rem', flexWrap: 'wrap'}}>
  <a href="./step-1-[...]" className="button button--primary button--lg" style={{flex: '1', minWidth: '200px'}}>
    Step 1: [Name]
  </a>
</div>

Or jump to a specific step:
- [**Step 2: [Name]**](./step-2-[...])
- [**Step 3: [Name]**](./step-3-[...])
```

### Template: Step Tutorial (step-N-*.mdx)

**Critical:** Each step should be ~500+ lines of comprehensive content

```markdown
---
title: "Step [N]: [Action] [Subject]"
sidebar_label: "Step [N]: [Short Name]"
sidebar_position: [3+N]  # Setup is 3, so step 1 is 4, step 2 is 5, etc.
description: [One-line description of what this step does and why]
keywords: [related-keywords, compliance-terms, technique-names]
---

# Step [N]: [Action] [Subject]

**[One-sentence summary of what they'll learn]**.

## The Concept: [Concept Name]

[2-3 paragraph explanation of the concept and why it matters]

**Use [technique] when:**
- ✅ [Use case 1]
- ✅ [Use case 2]
- ✅ [Use case 3]

**Don't use [technique] when:**
- ❌ [Anti-pattern 1] (use [alternative] instead)
- ❌ [Anti-pattern 2] (use [alternative] instead)
- ❌ [Anti-pattern 3] (use [alternative] instead)

## What We're [Action]ing

From this [input]:

```[format]
{
  "field1": "value1",  // ❌ [Problem indicator]
  "field2": "value2",  // ✅ [Good indicator]
}
```

To this:

```[format]
{
  "field1_transformed": "new_value",  // ✅ [Benefit]
  "field2": "value2",                 // ✅ [Kept because]
}
```

## The [Technology/Function] [Action] Pattern

**Syntax:**
```[language]
[basic syntax example]
```

**Example:**
```[language]
[real example with comments]
```

**How it works:**
1. [Step 1 of transformation]
2. [Step 2 of transformation]
3. [Step 3 of transformation]
4. **Result:** [What you get]

## Step-by-Step Implementation

### 1. [Prerequisite Check]

[What to verify before starting]

```bash
# [Check description]
[check command]
```

### 2. Create the [Solution] Configuration

Create `step-[N]-[name].yaml`:

```yaml title="step-[N]-[name].yaml"
[Complete YAML with inline comments explaining each section]
```

### 3. Deploy the [Solution]

```bash
# Deploy to [platform]
[deploy command]

# Verify deployment
[verify command]
```

### 4. Test with Sample Data

```bash
# Send [test description]
[test command]

# Check the output
[check command]
```

### 5. Verify [Transformation]

**Expected output:**

```[format]
{
  [expected output with comments]
}
```

**Verification checklist:**
- ✅ [Check 1]
- ✅ [Check 2]
- ✅ [Check 3]

## Why This Works for [Compliance/Requirement]

### [Regulation/Standard] Requirements

[Detailed explanation of why this satisfies compliance]

**[Specific Regulation Article]:**
> "[Quote from regulation]"

**Why our approach qualifies:**
- ✅ [Reason 1]
- ✅ [Reason 2]
- ✅ [Reason 3]

[2-3 more subsections explaining compliance/security/benefits]

## Analytics Impact

### Before (with [original state]):
```[format]
[before example]
```

**Analytics queries you CAN run:**
- ✅ [Query type 1]
- ❌ **But violates [regulation]!**

### After (with [transformed state]):
```[format]
[after example]
```

**Analytics queries you CAN still run:**

**[Use Case 1]:**
```sql
[SQL example with comments]
```

**[Use Case 2]:**
```sql
[SQL example with comments]
```

**Analytics you CANNOT run:**
- ❌ [Lost capability 1]
- ❌ [Lost capability 2]

## Common Variations

### Variation 1: [Variation Name]

[When to use this variation]

```yaml
[configuration example]
```

**Result:** [what this achieves]

**Use when:** [specific use case]

[Repeat for 3-5 variations]

## Troubleshooting

### Issue: [Problem Description]

**Symptom:** [What they see]

**Diagnosis:**
```bash
[diagnostic commands]
```

**Cause:** [Root cause]

**Fix:**
```yaml
[solution code]
```

[Repeat for 3-5 common issues]

## [Domain-Specific] Considerations

[2-3 subsections on special considerations for this technique]

### [Consideration 1]
[Explanation with examples]

### [Consideration 2]
[Explanation with examples]

## Key Takeaways

✅ **[Takeaway 1]**
✅ **[Takeaway 2]**
✅ **[Takeaway 3]**
✅ **[Takeaway 4]**
✅ **[Takeaway 5]**

## Next Step

Now that you've [completed this step], [transition to next step].

<div style={{display: 'flex', gap: '1rem', marginTop: '2rem', marginBottom: '2rem', flexWrap: 'wrap'}}>
  <a href="./step-[N+1]-[...]" className="button button--primary button--lg" style={{flex: '1', minWidth: '200px'}}>
    Step [N+1]: [Name]
  </a>
</div>

### Or Jump Ahead:
- [**Step [N+2]: [Name]**](./step-[N+2]-[...])
- [**Complete [Solution]**](./complete-[example])

### Related Resources:
- [**Interactive Explorer**](./explorer) - See this transformation visually
- [**[Technology] Reference**](link) - Official documentation
```

### Template: Complete Pipeline (complete-[example].mdx)

```markdown
---
title: "Complete [Example] [Solution]"
sidebar_label: "Complete [Solution]"
sidebar_position: [N+4]  # After all steps
description: Full production-ready [solution] with all [N] steps combined
keywords: [compliance-terms, complete, production, deployment]
---

import CodeBlock from '@theme/CodeBlock';
import [example]Yaml from '!!raw-loader!../../../examples/[category]/[example]-complete.yaml';

# Complete [Example] [Solution]

**Deploy the full [N]-step [solution]** in one go. This page combines all techniques from Steps 1-[N] into a single, production-ready configuration.

## What This [Solution] Does

This complete [solution] applies **[N] sequential transformations** to [input]:

1. **[Step 1 Name]** - [What it does]
2. **[Step 2 Name]** - [What it does]
[... list all steps ...]

**Result:** [Outcome description]

## Before and After Comparison

### Input [Data] (with [problems])
```[format]
{
  [input example with problem indicators]
}
```

### Output [Data] ([problems] resolved)
```[format]
{
  [output example with success indicators]
}
```

## Complete [Solution] Configuration

Download and deploy this single YAML file:

<CodeBlock language="yaml" title="[example]-complete.yaml" showLineNumbers>
{[example]Yaml}
</CodeBlock>

## Deployment Instructions

### Prerequisites

Before deploying, ensure you have:

1. **[Requirement 1]**
2. **[Requirement 2]**
3. **[Requirement 3]**

### Step 1: Download the [Solution]

```bash
[download commands]
```

### Step 2: Configure [Settings]

Edit `[example]-complete.yaml` and update [section]:

**For [option 1] ([use case]):**
```yaml
[configuration example]
```

**For [option 2] ([use case]):**
```yaml
[configuration example]
```

### Step 3: Deploy to [Platform]

```bash
[deployment commands]
```

### Step 4: Test the [Solution]

```bash
[test commands]
```

### Step 5: Monitor [Solution] Health

```bash
[monitoring commands]
```

## Production Considerations

### 1. [Consideration 1 Name]

[Detailed explanation with code examples]

### 2. [Consideration 2 Name]

[Detailed explanation with code examples]

[Repeat for 5-6 production considerations]

## Testing Checklist

Before deploying to production, verify:

- ✅ [Test 1]
- ✅ [Test 2]
- ✅ [Test 3]
[... 8-10 total checks ...]

## [Domain] Impact Summary

After deploying this [solution], you can still:

✅ **[Capability 1]**
✅ **[Capability 2]**
✅ **[Capability 3]**

You cannot:
❌ **[Lost capability 1]**
❌ **[Lost capability 2]**

**Trade-off:** [Summary of trade-off]

## Next Steps

- **[Interactive Explorer](./explorer)** - Visualize each transformation step
- **[Troubleshooting Guide](./troubleshooting)** - Common issues and solutions
- **[Step-by-Step Tutorial](./setup)** - Learn each technique in depth

## Download Links

- [📥 Complete [Solution] YAML](link)
- [📥 Sample Data](link)
- [📥 Incremental [Solutions] (Steps 1-[N])](link)

## Related Examples

- [**[Related Example 1]**](link) - [Why it's related]
- [**[Related Example 2]**](link) - [Why it's related]
```

### Template: Troubleshooting (troubleshooting.mdx)

```markdown
---
title: "Troubleshooting Guide"
sidebar_label: "Troubleshooting"
sidebar_position: [N+5]  # Last
description: Common issues and solutions for [example] [solution]
keywords: [troubleshooting, debugging, errors, common-issues, solutions]
---

# Troubleshooting [Example] [Solution]

**Common issues and solutions** for the [example] [solution]. Use this guide to debug problems quickly.

## Quick Diagnostic Commands

```bash
# [Diagnostic 1]
[command]

# [Diagnostic 2]
[command]

# [Diagnostic 3]
[command]
```

## Issue Categories

1. [Deployment Issues](#deployment-issues)
2. [[Core Functionality] Issues](#[core]-issues)
3. [Performance Issues](#performance-issues)
4. [Output Issues](#output-issues)
5. [Security Issues](#security-issues)

---

## Deployment Issues

### Issue: [Problem Name]

**Symptom:**
```bash
[what user sees]
```

**Common causes:**

**1. [Cause 1]**
```bash
[diagnostic commands]
```

**Fix:**
```bash
[solution commands]
```

**2. [Cause 2]**
[solution]

[Repeat for 3-5 deployment issues]

---

## [Core Functionality] Issues

### Issue: [Problem Name]

**Symptom:** [Description]

**Diagnosis:**
```bash
[diagnostic commands]
```

**Common causes:**

**1. [Cause 1]**

**Wrong:**
```yaml
[wrong code]
```

**Correct:**
```yaml
[correct code]
```

[Repeat for 5-8 core functionality issues]

---

## Performance Issues

### Issue: [Problem Name]

**Symptom:** [Description]

**Diagnosis:**
```bash
[diagnostic commands]
```

**Solutions:**

**1. [Solution 1 Name]**
```yaml
[configuration example]
```

**2. [Solution 2 Name]**
```yaml
[configuration example]
```

[Repeat for 3-5 performance issues]

---

## Output Issues

[Same structure as above, 3-5 issues]

---

## Security Issues

[Same structure as above, 3-5 issues]

---

## Edge Cases

### Issue: [Edge Case 1]

**Symptom:** [Description]

**Solution:**
```yaml
[solution with error handling]
```

[Repeat for 3-5 edge cases]

---

## Getting Help

If you're still stuck after trying these solutions:

1. **Check [Platform] documentation**
   - [Link 1]
   - [Link 2]

2. **Enable debug logging**
```yaml
[configuration]
```

3. **Simplify the problem**
   - [Debugging tip 1]
   - [Debugging tip 2]

4. **Community support**
   - [Link to community]

5. **Provide these details when asking for help:**
   - [What to include]

---

## Related Resources

- [**Complete [Solution]**](./complete-[example]) - Full configuration reference
- [**Interactive Explorer**](./explorer) - Visual debugging tool
- [**Step-by-Step Tutorials**](./setup) - Learn each transformation in depth
```

---

## Implementation Checklist

Use this checklist when rearchitecting an example:

### Phase 1: Planning
- [ ] Read existing single-page example completely
- [ ] Identify 3-6 distinct concepts/steps
- [ ] Determine if interactive explorer is appropriate
- [ ] Map out hierarchical structure
- [ ] Create task list for implementation

### Phase 2: Preparation
- [ ] Backup original `.mdx` file (rename to `.mdx.backup`)
- [ ] Create `[example]/` directory under `docs/[category]/`
- [ ] Create `.stages.ts` file if using interactive explorer
- [ ] Create complete YAML in `examples/[category]/`

### Phase 3: Content Creation
- [ ] Write `index.mdx` (introduction with 3 learning paths)
- [ ] Write `explorer.mdx` (if applicable)
- [ ] Write `setup.mdx` (comprehensive setup guide)
- [ ] Write `step-1-*.mdx` through `step-N-*.mdx` (500+ lines each)
- [ ] Write `complete-[example].mdx` (production deployment)
- [ ] Write `troubleshooting.mdx` (20+ issues)

### Phase 4: Configuration
- [ ] Update `sidebars.ts` with new hierarchical structure
- [ ] Remove old sidebar entry for single-page
- [ ] Set correct `sidebar_position` values (1, 2, 3, ...)
- [ ] Ensure no `link` property on category (expands, doesn't navigate)

### Phase 5: Assets
- [ ] Create complete YAML file
- [ ] Create sample data files
- [ ] Create stage data file (if using explorer)
- [ ] Verify all imports work

### Phase 6: Quality Assurance
- [ ] Check all internal links work
- [ ] Verify code examples are complete and correct
- [ ] Test all bash commands work
- [ ] Ensure consistent formatting
- [ ] Check for typos and grammar
- [ ] Verify buttons have proper styling (no emojis, flex layout)

### Phase 7: Testing
- [ ] Kill old dev server instances
- [ ] Start dev server: `just dev` (port 3100)
- [ ] Navigate to `localhost:3100/[category]/[example]/`
- [ ] Verify sidebar appears and works
- [ ] Test all page navigation
- [ ] Check interactive explorer (if applicable)
- [ ] Verify all code blocks render correctly
- [ ] Test on mobile viewport

### Phase 8: Documentation
- [ ] Update README if needed
- [ ] Document any new patterns or components
- [ ] Add to examples list if maintained

---

## Quality Standards

### Content Quality

**Each page must:**
- Be comprehensive (not superficial)
- Include real-world context (compliance, security, production)
- Provide 3-5 variations for different use cases
- Include 3-5 troubleshooting scenarios
- Use concrete examples (not placeholders)
- Have proper error handling in code examples

**Step tutorials must:**
- Be 500+ lines of comprehensive content
- Follow the step template exactly
- Include compliance/security explanations
- Show analytics impact (before/after)
- Provide common variations
- Include troubleshooting section

**Troubleshooting must:**
- Cover 20+ common issues
- Provide diagnostic commands
- Show both wrong and correct approaches
- Include edge cases
- Offer multiple solutions when applicable

### Code Quality

**All code examples must:**
- Be complete and runnable (no `...` placeholders)
- Include inline comments explaining key parts
- Show proper error handling
- Use environment variables for secrets (never hardcode)
- Follow best practices for the technology
- Include verification/testing steps

**YAML configurations must:**
- Be production-ready
- Include comments for each section
- Use descriptive names
- Show multiple output options
- Include logging and metrics configuration

### UX Quality

**Navigation must:**
- Be hierarchical and intuitive
- Expand categories (not navigate)
- Show clear learning paths
- Provide "Next Steps" buttons
- Link related content

**Visual elements must:**
- Use emojis sparingly (indicators only, not in buttons)
- Have proper spacing (flexbox, gap, margins)
- Be responsive (flex-wrap for mobile)
- Use consistent button styling
- Include before/after comparisons

---

## Agent Instructions

When assigned to rearchitect an example, follow these instructions:

### 1. Initial Assessment

**Read the existing example:**
```bash
# Find the example
cd docs/[category]/
cat [example].mdx
```

**Identify:**
- Main problem being solved
- Number of distinct steps/concepts (aim for 3-6)
- Whether progressive transformation is visual (for explorer)
- Key compliance/security concerns
- Production deployment requirements

### 2. Create Task Plan

Create a detailed task list:
```markdown
## Rearchitecture Plan: [Example Name]

### Structure
- [ ] Introduction (index.mdx)
- [ ] Interactive Explorer (explorer.mdx) - [YES/NO, reasoning]
- [ ] Setup (setup.mdx)
- [ ] Step 1: [Name] (step-1-[...].mdx)
- [ ] Step 2: [Name] (step-2-[...].mdx)
- [ ] Step N: [Name] (step-N-[...].mdx)
- [ ] Complete [Solution] (complete-[example].mdx)
- [ ] Troubleshooting (troubleshooting.mdx)

### Key Concepts
1. [Concept 1] - [Why important]
2. [Concept 2] - [Why important]
3. [Concept N] - [Why important]

### Compliance/Security
- [Regulation 1]: [How we satisfy it]
- [Regulation 2]: [How we satisfy it]

### Production Considerations
- [Consideration 1]
- [Consideration 2]
```

### 3. Prepare Directory Structure

```bash
# Backup original
mv docs/[category]/[example].mdx docs/[category]/[example].mdx.backup

# Create new structure
mkdir -p docs/[category]/[example]

# Create placeholder files
touch docs/[category]/[example]/index.mdx
touch docs/[category]/[example]/setup.mdx
# ... etc
```

### 4. Implement Content

**Follow templates exactly:**
- Use the content templates provided above
- Maintain 500+ line minimum for step tutorials
- Include all required sections
- Add 3-5 variations per step
- Add 3-5 troubleshooting items per step

**Quality checklist:**
- [ ] Real-world examples (not toy data)
- [ ] Production-ready code
- [ ] Comprehensive error handling
- [ ] Compliance explanations
- [ ] Analytics impact analysis
- [ ] Common variations
- [ ] Troubleshooting section

### 5. Configure Navigation

**Update `sidebars.ts`:**
```typescript
// Remove old entry:
'[category]/[example]',  // DELETE THIS

// Add new hierarchical entry:
{
  type: 'category',
  label: '[Example Name]',
  collapsible: true,
  collapsed: true,
  items: [
    '[category]/[example]/index',
    '[category]/[example]/explorer',  // if applicable
    '[category]/[example]/setup',
    '[category]/[example]/step-1-[...]',
    // ... all steps ...
    '[category]/[example]/complete-[example]',
    '[category]/[example]/troubleshooting',
  ],
},
```

### 6. Create Assets

**YAML configuration:**
```bash
# Create complete YAML
cat > examples/[category]/[example]-complete.yaml << 'EOF'
[Complete configuration with inline comments]
EOF
```

**Stage data (if using explorer):**
```bash
# Create stages file
cat > docs/[category]/[example]-full.stages.ts << 'EOF'
[Stage definitions following the pattern from remove-pii-full.stages.ts]
EOF
```

### 7. Test Thoroughly

```bash
# Kill old servers
lsof -ti :3100 | xargs kill -9

# Start dev server
just dev

# Wait for compilation
sleep 15

# Test in browser:
# - http://localhost:3100/[category]/[example]/
# - Verify sidebar appears
# - Test all navigation
# - Check interactive explorer
# - Verify all code blocks
```

### 8. Quality Check

**Run through checklist:**
- [ ] All pages load without errors
- [ ] Sidebar shows all pages
- [ ] All internal links work
- [ ] Code examples are complete
- [ ] Buttons styled properly (no emojis, flex layout)
- [ ] Interactive explorer works (if applicable)
- [ ] Mobile responsive
- [ ] Comprehensive content (500+ lines per step)

### 9. Documentation

**Create handoff document:**
```markdown
## [Example Name] Rearchitecture Complete

### Summary
- Converted from single-page to [N]-page hierarchical structure
- Added interactive explorer: [YES/NO]
- Total pages: [N]
- Key improvements: [list 3-5]

### Files Created
- docs/[category]/[example]/index.mdx
- docs/[category]/[example]/explorer.mdx
- [... list all files ...]

### Files Modified
- sidebars.ts

### Files Backed Up
- docs/[category]/[example].mdx → [example].mdx.backup

### Testing
- [x] Dev server runs without errors
- [x] All pages accessible
- [x] Sidebar navigation works
- [x] Interactive explorer functional
- [x] Code examples verified

### Notes
[Any important notes for future maintainers]
```

---

## Examples to Rearchitecture

Apply this pattern to these examples (in priority order):

### High Priority (Complex, High-Traffic)
1. **Data Transformation** category
   - `aggregate-time-windows` - 5-6 steps for windowing techniques
   - `deduplicate-events` - 4 steps for deduplication strategies
   - `parse-logs` - 5 steps for parsing different formats

2. **Data Security** category
   - `encryption-patterns` - 6 steps for different encryption approaches
   - `enforce-schema` - 4 steps for schema validation

3. **Log Processing** category
   - `production-pipeline` - 7-8 steps for complete production setup

### Medium Priority (Moderate Complexity)
4. **Data Routing** category
   - `circuit-breakers` - 4 steps for resilience patterns
   - `content-routing` - 5 steps for routing strategies
   - `priority-queues` - 4 steps for prioritization

### Lower Priority (Simpler Examples)
5. **Quick Wins**
   - `filter-severity` - 3 steps for filtering
   - `normalize-timestamps` - 3 steps for normalization

---

## Success Metrics

A successful rearchitecture achieves:

✅ **Discoverability:** Users find content through hierarchical navigation
✅ **Comprehensiveness:** Each page is 500+ lines of valuable content
✅ **Production-Ready:** All code examples are deployable
✅ **Educational:** Progressive learning from problem → solution
✅ **Visual:** Interactive explorers where applicable
✅ **Actionable:** Clear next steps and multiple learning paths

---

## Reference: Remove PII Example

The "Remove PII" example serves as the reference implementation:

**Structure:**
- 10 total pages (introduction + explorer + setup + 5 steps + complete + troubleshooting)
- Interactive 6-stage explorer
- Each step tutorial is 500-700 lines
- Complete pipeline with production considerations
- Comprehensive troubleshooting (20+ issues)

**Location:**
```
docs/data-security/remove-pii/
├── index.mdx (165 lines)
├── explorer.mdx (123 lines)
├── setup.mdx (284 lines)
├── step-1-delete-payment-data.mdx (325 lines)
├── step-2-hash-ip-address.mdx (496 lines)
├── step-3-hash-email.mdx (643 lines)
├── step-4-pseudonymize-user.mdx (616 lines)
├── step-5-generalize-location.mdx (608 lines)
├── complete-pipeline.mdx (470 lines)
└── troubleshooting.mdx (681 lines)

docs/data-security/remove-pii-full.stages.ts (stage definitions)
examples/data-security/remove-pii-complete.yaml (deployable YAML)
```

**Study this example to understand:**
- How to structure hierarchical documentation
- How to write comprehensive step tutorials
- How to integrate interactive explorers
- How to handle production considerations
- How to write effective troubleshooting guides

---

## Questions?

If you have questions while implementing this pattern:

1. **Review the Remove PII example** - It's the reference implementation
2. **Check the templates** - They cover 95% of use cases
3. **Consult this guide** - All patterns are documented
4. **Ask in comments** - Describe your specific scenario

---

**Last Updated:** 2025-01-15
**Pattern Version:** 1.0
**Reference Implementation:** Remove PII (docs/data-security/remove-pii/)
