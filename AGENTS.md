# AGENTS.md — Expanso Examples

Instructions for AI agents working on Expanso Examples documentation site.

## Project Overview

Expanso Examples is a production-ready reference library of Expanso Edge pipelines. Built with:
- **Documentation:** Docusaurus 3 (MDX-based)
- **Examples:** YAML pipeline configurations ready to deploy
- **Validation:** TypeScript scripts to ensure examples work
- **Deployment:** Automatic GitHub Pages deployment on main branch pushes

This is the primary resource for users learning to build Expanso pipelines.

## Key Directories

```
examples.expanso.io/
├── docs/                    # Example documentation (MDX files)
│   ├── getting-started/    # Quick start guides
│   ├── pipelines/          # Pipeline examples by category
│   └── reference/          # Component reference docs
├── examples/               # Pipeline YAML files (downloadable)
├── src/                    # React components and styling
│   ├── components/         # Custom React components
│   ├── pages/             # Custom pages
│   └── css/               # Global styles and Tailwind
├── static/                # Images and static assets
├── scripts/               # TypeScript validation scripts
│   ├── validate-yaml.ts
│   ├── validate-docs-style.ts
│   ├── check-example-health.ts
│   ├── sync-stages.ts
│   └── ... (other validators)
├── .github/workflows/     # CI/CD (deployment)
└── docusaurus.config.js   # Docusaurus configuration
```

## Architecture

### Docusaurus Setup

- **Framework:** Docusaurus 3.9.2 (React-based static site generator)
- **Styling:** Tailwind CSS 4 + custom CSS
- **Plugins:** Google Tag Manager, client redirects, Mermaid diagrams
- **MDX:** Markdown + React components for rich docs

### Example Structure

Each example consists of:
1. **MDX documentation** in `docs/` explaining the pipeline
2. **YAML file** in `examples/` with the actual configuration
3. **Validation:** TypeScript scripts ensure YAML is valid

### Validation Layer

Custom scripts validate:
- YAML syntax and schema (`validate-yaml.ts`)
- Pipeline stage configurations (`validate-stages.ts`)
- Documentation style and completeness (`validate-docs-style.ts`)
- CLI command examples (`validate-cli-commands.ts`)
- Overall example health (`check-example-health.ts`)

## Build & Test

### Prerequisites

- Node.js 18+ (check `package.json`)
- npm or yarn
- TSX (TypeScript executor, included in devDependencies)

### NPM Scripts

```bash
# Development
npm start                 # Start dev server (http://localhost:3000)
npm run build            # Build static site
npm run serve            # Serve production build locally
npm run clear            # Clear Docusaurus cache

# Validation & Testing
npm run typecheck        # TypeScript type checking
npm run validate-yaml    # Validate all pipeline YAML files
npm run validate-complete-yaml  # Full YAML validation with expanso binary
npm run validate-stages  # Validate Expanso stage configurations
npm run validate-docs    # Validate documentation style
npm run validate-cli     # Validate CLI command examples in docs
npm run check-health     # Full health check of all examples

# Utilities
npm run test-pipelines   # Run pipeline tests
npm run create-explorer  # Generate example explorer
npm run sync-stages      # Sync stage definitions
npm run setup-binaries   # Setup required binaries
npm run coverage-report  # Generate example coverage report
npm run migrate-stages   # Migrate legacy stage configurations
npm run write-translations  # I18n support
npm run write-heading-ids    # Generate Markdown heading IDs

# Deployment
npm run deploy          # Deploy to GitHub Pages (CI usually does this)
```

### Common Development Tasks

```bash
# Add a new example
1. Create docs/pipelines/my-example.mdx
2. Create examples/my-example.yaml
3. npm run validate-yaml    # Check YAML validity
4. npm run validate-docs    # Check doc style
5. npm run check-health     # Full validation

# Edit existing example
1. Update docs/pipelines/example.mdx
2. Update examples/example.yaml if YAML changed
3. npm run validate-complete-yaml
4. npm start                # Preview changes

# Before committing
npm run typecheck
npm run validate-yaml
npm run validate-docs
npm run build
```

## Code Style & Preferences

Based on the Claude Code engineering template:

### General Principles

- **DRY:** Consolidate repeated documentation patterns and YAML configurations
- **Well-tested:** Validation is non-negotiable; use TypeScript scripts to catch issues
- **Engineered appropriately:** Documentation should be clear and self-explanatory, not clever
- **Explicit over clever:** Use plain language; complex examples should have detailed explanations
- **Comprehensive examples:** Cover happy path, common variations, and important edge cases

### Documentation (MDX)

- **Structure:** Clear hierarchy with H1 (page title), H2 (sections), H3 (subsections)
- **Code blocks:** Include language hints (`yaml`, `bash`, `json`)
- **Links:** Reference main docs.expanso.io for concept definitions
- **Examples:** Every feature explained should have a concrete example
- **Tone:** Helpful, friendly, jargon-minimal (explain Expanso terms on first use)

### YAML Examples

- **Naming:** Clear, descriptive pipeline and stage names
- **Comments:** Explain non-obvious configurations
- **Structure:** Follow Expanso schema exactly; validate with `validate-yaml.ts`
- **Realism:** Examples should reflect actual use cases, not toy scenarios
- **Completeness:** Include required fields; optional fields only when demonstrating them

### TypeScript (Scripts)

- **Validation first:** Catch schema and style issues early
- **Clear errors:** Error messages should tell users exactly what's wrong
- **Testing:** Validation scripts should be tested against known good/bad inputs
- **Maintainability:** Document validation rules clearly

### Breaking Changes

- **Documentation changes:** Communicate to users via "What's New" section
- **Example removal:** Provide migration guide if removing commonly-used examples
- **YAML schema:** Update examples if Expanso YAML schema changes (coordinated with core team)

## CI/CD

### Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `deploy.yml` | Push to main | Build and deploy to GitHub Pages |
| `example-health.yml` | PR, push to main | Run full example validation |
| `validate-stages.yml` | PR | Validate stage configurations |

### PR Checklist

- [ ] YAML validates: `npm run validate-yaml`
- [ ] Docs style valid: `npm run validate-docs`
- [ ] Types pass: `npm run typecheck`
- [ ] All examples pass health check: `npm run check-health`
- [ ] Build succeeds: `npm run build`
- [ ] Live preview looks good: `npm start`

### Local Pre-Commit Workflow

```bash
npm run typecheck
npm run validate-yaml
npm run validate-docs
npm run build
git add -A && git commit
```

## Troubleshooting

### Build Failures

```bash
# Clear cache and rebuild
npm run clear
npm install  # Ensure all deps
npm run build
```

### Validation Fails

```bash
# Check specific validation
npm run validate-yaml      # YAML syntax issues
npm run validate-docs      # Doc style issues
npm run check-health       # Overall health (runs all validators)
```

### Dev Server Won't Start

```bash
npm run clear
npm start
# If still fails, check Node.js version (should be 18+)
node --version
```

### Examples Not Showing Up

```bash
# Docusaurus caches doc discovery
npm run clear
npm run build  # Regenerate
npm start
```

## Before You Start

1. Read the README.md in the project root
2. Understand Docusaurus basics (see `docusaurus.config.js`)
3. Review existing examples in `docs/pipelines/` for style and structure
4. Check Expanso YAML schema in core `expanso` repo
5. Review validation scripts in `scripts/` to understand what's enforced

## Key Files to Know

- `docusaurus.config.js` — Site configuration, navigation, plugins
- `package.json` — Dependencies and validation scripts
- `docs/` — All documentation (MDX files)
- `examples/` — All downloadable YAML examples
- `.github/workflows/` — What CI runs on PRs and pushes

## Adding a New Example

1. **Create documentation:**
   ```bash
   # Create docs/pipelines/my-feature.mdx
   ```
   Include: overview, use case, step-by-step explanation, YAML code block

2. **Create YAML:**
   ```bash
   # Create examples/my-feature.yaml
   # Make sure to include all required fields
   ```

3. **Validate:**
   ```bash
   npm run validate-yaml       # Check YAML syntax
   npm run validate-docs       # Check doc style
   npm run check-health        # Full validation
   ```

4. **Test locally:**
   ```bash
   npm start
   # Navigate to your example page, verify it displays correctly
   ```

5. **Commit:**
   ```bash
   git add docs/pipelines/my-feature.mdx examples/my-feature.yaml
   git commit -m "Add my-feature example"
   ```

## Questions?

Check existing examples for patterns, review validation script error messages, or ask the team.
