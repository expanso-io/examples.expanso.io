# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Docusaurus-based documentation site showcasing production-ready pipeline examples for Expanso Edge. The site is deployed to GitHub Pages at https://examples.expanso.io.

**Key Architecture:**
- **Docusaurus 3.9.2** with docs-only mode (no blog)
- **MDX files** (`docs/`) contain example documentation with embedded YAML via raw-loader
- **YAML files** (`examples/`) contain actual pipeline configurations users can download
- **1:1 mapping** between each `.mdx` file and its corresponding `.yaml` file
- **Sidebar configuration** (`sidebars.ts`) defines navigation structure with 4 main categories

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (with live reload)
npm start

# Build for production
npm run build

# Serve production build locally (test before deploy)
npm run serve

# Type checking
npm run typecheck

# Clear Docusaurus cache (if builds behave unexpectedly)
npm run clear
```

## Content Structure

The site follows a strict pairing pattern:

```
docs/[category]/[example].mdx          # Documentation page
examples/[category]/[example].yaml     # Downloadable pipeline config
```

**Categories:**
- `data-routing/` - Circuit breakers, content routing, fan-out, priority queues
- `data-security/` - PII removal, encryption patterns, schema enforcement
- `data-transformation/` - Time windows, deduplication, log parsing
- `log-processing/` - Filtering, enrichment, production pipelines

**Each example must have:**
1. MDX file with frontmatter (title, sidebar_label, description, keywords)
2. YAML import using `raw-loader`: `import pipelineYaml from '!!raw-loader!../../examples/[path].yaml';`
3. Corresponding YAML file with complete Expanso pipeline configuration
4. Entry in `sidebars.ts` under appropriate category

## Adding New Examples

When creating a new example:

1. **Create YAML file** in `examples/[category]/[name].yaml` with complete pipeline config
2. **Create MDX file** in `docs/[category]/[name].mdx` with:
   - Frontmatter with title, sidebar_label, sidebar_position, description, keywords
   - Import statement for the YAML file using raw-loader
   - Problem statement and use case explanation
   - Component breakdown explaining each section
   - Common variations and related examples
3. **Update `sidebars.ts`** to add the new example to the appropriate category
4. **Test locally** with `npm start` to verify the example renders correctly

## Pipeline YAML Structure

All example YAML files follow Expanso's pipeline configuration format:

```yaml
name: pipeline-name
description: What this pipeline does
type: pipeline
namespace: default
labels: {}
priority: 100
selector: {}
deployment: {}
config:
  input: {}      # Data sources (http_server, kafka, etc.)
  pipeline:
    processors: []  # Data transformations using mapping language
  output: {}     # Destinations (http_client, file, kafka, etc.)
logger: {}
metrics: {}
```

**Common patterns in processors:**
- Use `mapping: |` for Bloblang transformations (Expanso's data mapping language)
- Chain processors for multi-step transformations
- Include validation steps with schema enforcement
- Add audit logging with metadata
- Use environment variables for configuration (e.g., `env("VARIABLE_NAME").or("default")`)

## Deployment

- **Automatic deployment** via GitHub Actions on push to `main` branch
- Workflow: `.github/workflows/deploy.yml`
- Uses Node.js 20.x and npm ci for reproducible builds
- Deploys to GitHub Pages with proper permissions

## Configuration Files

- `docusaurus.config.ts` - Site configuration, navbar, footer, theme settings
- `sidebars.ts` - Navigation structure (must be updated when adding examples)
- `tsconfig.json` - TypeScript configuration
- `package.json` - Dependencies and scripts

## Documentation Style Guide

**CRITICAL:** Follow the "Less is More" principle for all documentation.

### Core Principles

1. **Terse, non-duplicative, but still meaningful**
2. **80/20 Rule** - Focus on the 20% of content that delivers 80% of value
3. **No Duplication** - Write once, link everywhere else
4. **Front-Load Value** - Users get value in first 10 seconds

### Page Length Limits

- **Introduction pages** (index.mdx): 40-50 lines max
- **Tutorial pages** (step-N-*.mdx): 100 lines max
- **Reference pages**: Terse and table-driven

### Before Committing Docs

Run validation:
```bash
npm run validate-docs
```

Use the `/docs-brief` slash command to review documentation against style guidelines.

**Full guidelines:** See `DOCS_STYLE_GUIDE.md`

### Anti-Patterns to Avoid

- ❌ Verbose explanations ("In order to successfully..." → "Prerequisites:")
- ❌ Too many examples (5+ examples → 1-2 perfect examples)
- ❌ Duplicated content (installation steps on 8 pages → link to one guide)
- ❌ Wall of text (long paragraphs → bullet lists)

### Remember

**Every word costs the reader time. Make every word count.**

## Important Notes

- **Dark mode is default** (`defaultMode: 'dark'` in config)
- **Docs-only mode** (`routeBasePath: '/'`) - no separate docs prefix
- **Mermaid support** enabled for diagrams
- **Broken links set to 'warn'** not 'throw' during builds
- **Edit URLs** point to GitHub repo for community contributions
- The site uses custom CSS in `src/css/custom.css` for Expanso branding
