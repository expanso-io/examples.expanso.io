# Documentation Style Guide

**Mission:** Terse, non-duplicative, but still meaningful.

## Core Principles

### 1. Less is More
- Cut every unnecessary word
- One example is better than three mediocre ones
- If you can say it in 3 bullets, don't use 6

### 2. The 80/20 Rule
Focus on the 20% of content that delivers 80% of value:
- ✅ What users need to accomplish their task
- ❌ Edge cases, "nice to know" information, background theory

### 3. No Duplication
**Rule:** Write it once, link to it everywhere else.

**Bad:**
```
docs/installation.md - Full installation steps
docs/quickstart.md - Full installation steps (duplicated)
docs/cli-reference.md - Full installation steps (duplicated)
```

**Good:**
```
docs/installation.md - Full installation steps
docs/quickstart.md - "See [Installation](installation.md)"
docs/cli-reference.md - "See [Installation](installation.md)"
```

### 4. Front-Load Value
Users should get value in the first 10 seconds:
- Title tells them what they'll learn
- First paragraph answers "why should I care?"
- Clear next steps (links to action)

## Page Templates

### Introduction Pages (40-50 lines max)

```markdown
# [Concept Name]

[One-line value proposition]

## The Problem

[2-4 bullet points - problems this solves]

## The Solution

[3-5 bullet points - key techniques/features]

## Get Started

### [→ Quick Start](./quickstart)
[One line describing fastest path]

### [→ Tutorial](./tutorial)
[One line describing learning path]

### [→ Reference](./reference)
[One line describing complete docs]
```

### Tutorial Pages (100 lines max)

```markdown
# [Tutorial Name]

[One-line goal]

## Prerequisites

- [Minimal list - link to installation guide]

## Step 1: [Action Verb]

[2-3 sentences explaining why]

```bash
# One focused code example
command --flag value
```

[Expected output in 1-2 lines]

## Step 2: [Action Verb]

...

## Next Steps

- [Link to next tutorial]
- [Link to reference docs]
```

### Reference Pages (Length varies, but terse)

```markdown
# [Command/API Name]

[One-line description]

## Syntax

```bash
command [OPTIONS] ARGUMENTS
```

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `-f` | Force mode | `false` |

## Examples

```bash
# One great example
command --flag value
```

## See Also

- [Related command](./related.md)
```

## Anti-Patterns to Avoid

### ❌ Verbose Explanations
**Bad:**
> "In order to successfully complete this tutorial, you'll need to first make sure that you have installed the Expanso CLI tool on your local development machine. This is a critical prerequisite because without the CLI installed, you won't be able to execute any of the commands that we'll be demonstrating throughout this comprehensive guide."

**Good:**
> "Prerequisites: [Expanso CLI](../installation.md)"

### ❌ Too Many Examples
**Bad:**
```markdown
## Examples

### Example 1: Basic usage
...

### Example 2: With custom port
...

### Example 3: With verbose logging
...

### Example 4: Production configuration
...

### Example 5: Development configuration
...
```

**Good:**
```markdown
## Example

```bash
# Basic usage
command --port 8080

# Production mode
command --prod --config prod.yaml
```
```

### ❌ Duplicated Content
**Bad:** Installation steps appear in:
- `docs/installation.md`
- `docs/quickstart.md`
- `docs/cli-reference.md`
- `docs/tutorial-1.md`
- `docs/tutorial-2.md`
- 8 different places total!

**Good:**
- `docs/installation.md` - Comprehensive installation guide
- All other pages - "See [Installation](installation.md)"

### ❌ Wall of Text
**Bad:**
```markdown
The Expanso Edge platform provides a comprehensive solution for
edge computing that enables you to deploy and manage applications
across distributed edge locations. By leveraging our platform,
you can achieve significant performance improvements and cost
reductions compared to traditional cloud-only architectures...
[500 more words]
```

**Good:**
```markdown
# Expanso Edge

Deploy apps at the edge for better performance and lower costs.

## Key Benefits
- 10x faster response times
- 50% cost reduction
- Deploy in 5 minutes

[→ Get Started](./quickstart.md)
```

## Length Guidelines

| Page Type | Max Length | Rationale |
|-----------|------------|-----------|
| Introduction | 40-50 lines | Quick scan, choose path |
| Tutorial | 100 lines | Focused learning |
| Reference | As needed | But terse, table-driven |
| API Docs | Auto-generated | Don't write manually |

## Writing Checklist

Before committing documentation:

- [ ] Can I cut this in half without losing meaning?
- [ ] Am I duplicating content that exists elsewhere?
- [ ] Does the first paragraph deliver immediate value?
- [ ] Would a bullet list be clearer than prose?
- [ ] Are my examples the absolute minimum to demonstrate the concept?
- [ ] Did I follow the 80/20 rule (focus on high-value content)?

## Examples of Great Documentation

### Great: Stripe API Docs
- Terse, scannable
- One perfect example per endpoint
- No duplication
- Clear next steps

### Great: Kubernetes Concepts
- Concepts page = overview + links
- Tutorial page = step-by-step
- Reference page = comprehensive flags/options
- No overlap between pages

### Avoid: Overly verbose enterprise docs
- 20-page "Getting Started" guides
- Installation steps repeated everywhere
- 10 examples when 2 would suffice
- Conceptual background before practical value

## Remember

**Every word costs the reader time. Make every word count.**

*"I would have written a shorter letter, but I did not have the time." - Blaise Pascal*
