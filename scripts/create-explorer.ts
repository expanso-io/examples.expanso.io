#!/usr/bin/env ts-node

/**
 * CLI tool to generate interactive explorer boilerplate
 *
 * Usage:
 *   npm run create-explorer -- --name "my-example" --category "data-routing" --stages 4 --title "My Example Title"
 *
 * Generates:
 *   - docs/{category}/{name}-full.stages.ts
 *   - docs/{category}/{name}/explorer.mdx
 *   - Updates sidebars.ts
 */

import * as fs from 'fs';
import * as path from 'path';

interface ExplorerConfig {
  name: string;
  category: string;
  stages: number;
  title: string;
}

function parseArgs(): ExplorerConfig {
  const args = process.argv.slice(2);
  const config: Partial<ExplorerConfig> = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace('--', '');
    const value = args[i + 1];

    if (key === 'stages') {
      config[key] = parseInt(value, 10);
    } else {
      config[key] = value;
    }
  }

  if (!config.name || !config.category || !config.stages || !config.title) {
    console.error('Usage: npm run create-explorer -- --name <name> --category <category> --stages <number> --title <title>');
    console.error('\nExample:');
    console.error('  npm run create-explorer -- --name "circuit-breakers" --category "data-routing" --stages 4 --title "Circuit Breaker Patterns"');
    process.exit(1);
  }

  return config as ExplorerConfig;
}

function generateStagesFile(config: ExplorerConfig): string {
  const exportName = config.name.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('') + 'Stages';

  let content = `import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * ${config.stages}-Stage ${config.title} Pipeline
 * TODO: Add description of what this pipeline demonstrates
 */

export const ${exportName}: Stage[] = [\n`;

  for (let i = 1; i <= config.stages; i++) {
    content += `  // ============================================================================
  // STAGE ${i}: TODO - Add stage title
  // ============================================================================
  {
    id: ${i},
    title: 'Stage ${i} Title',
    description: 'TODO: Describe what happens in this stage',
    yamlFilename: 'step-${i - 1}-description.yaml',
    yamlCode: \`# TODO: Add YAML configuration
pipeline:
  processors:
    - mapping: |
        root = this
        # Add your transformation here\`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"field": "value",', indent: 1, key: 'field', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"field": "value",', indent: 1, key: 'field', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },\n`;
  }

  content += '];\n';
  return content;
}

function generateExplorerMdx(config: ExplorerConfig): string {
  const exportName = config.name.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join('') + 'Stages';

  return `---
title: Interactive ${config.title} Explorer
sidebar_label: Interactive Explorer
sidebar_position: 2
description: Explore ${config.stages} stages of ${config.title.toLowerCase()} with live before/after comparisons
keywords: [${config.name}, interactive, pipeline, expanso]
---

import DataPipelineExplorer from '@site/src/components/DataPipelineExplorer';
import ExplorerSection from '@site/src/components/ExplorerSection';
import { ${exportName} } from '../${config.name}-full.stages';

# Interactive ${config.title} Explorer

**See ${config.title.toLowerCase()} in action!** Use the interactive explorer below to step through ${config.stages} stages. Watch how data transforms at each step.

## How to Use This Explorer

1. **Navigate** using arrow keys (← →) or click the numbered stage buttons
2. **Compare** the Input (left) and Output (right) showing transformations
3. **Observe** how data changes at each stage
4. **Inspect** the YAML code showing the pipeline configuration
5. **Learn** from the stage description explaining each step

## Interactive ${config.title} Explorer

<DataPipelineExplorer
  stages={${exportName}}
  title="${config.title.toUpperCase()}"
  subtitle="${config.stages}-Stage Implementation"
/>

## Understanding the Stages

### Stage 1: TODO
TODO: Describe first stage

### Stage 2: TODO
TODO: Describe second stage

## What You've Learned

After exploring all ${config.stages} stages, you now understand:

✅ **TODO** - Add learning outcome 1

✅ **TODO** - Add learning outcome 2

✅ **TODO** - Add learning outcome 3

## Try It Yourself

Ready to build your own ${config.title.toLowerCase()} pipeline? Follow the step-by-step tutorial:

<ExplorerSection
  setupLink="./setup"
  completeLink="./complete-pipeline"
/>

## Deep Dive into Each Step

Want to understand each technique in depth?

- [**Step 1: TODO**](./step-1-todo) - Description
- [**Step 2: TODO**](./step-2-todo) - Description

## Common Questions

### Question 1?
TODO: Answer common question about this pattern.

### Question 2?
TODO: Answer another common question.

---

**Next:** [Set up your environment](./setup) to build ${config.title.toLowerCase()} pipelines yourself
`;
}

function generateIndexMdx(config: ExplorerConfig): string {
  return `---
title: ${config.title}
sidebar_label: Introduction
sidebar_position: 1
description: Learn how to implement ${config.title.toLowerCase()} in your data pipelines
keywords: [${config.name}, pipeline, expanso]
---

# ${config.title}

## Overview

TODO: Provide a compelling introduction to this pattern.

**Problem:** Describe the problem this pattern solves.

**Solution:** Explain how this pattern addresses the problem.

**Business Impact:** Quantify the benefits (cost savings, performance improvement, compliance, etc.).

## Use Cases

Common scenarios where ${config.title.toLowerCase()} is valuable:

1. **TODO: Use Case 1** - Description
2. **TODO: Use Case 2** - Description
3. **TODO: Use Case 3** - Description

## How It Works

TODO: Explain the core concept at a high level.

### Key Components

1. **Component 1**: Description
2. **Component 2**: Description
3. **Component 3**: Description

## Real-World Example

TODO: Provide a concrete example with realistic data.

\`\`\`json
{
  "example": "data",
  "field": "value"
}
\`\`\`

## Benefits

✅ **Benefit 1** - Description and impact

✅ **Benefit 2** - Description and impact

✅ **Benefit 3** - Description and impact

## Trade-offs

⚠️ **Consideration 1** - When this pattern might not be ideal

⚠️ **Consideration 2** - Potential limitations or costs

## Next Steps

Ready to see ${config.title.toLowerCase()} in action?

1. [**Interactive Explorer**](./explorer) - Step through ${config.stages} stages with live examples
2. [**Setup Guide**](./setup) - Configure your environment
3. [**Complete Solution**](./complete-pipeline) - Download working code

---

**Continue:** [Explore the interactive demo](./explorer) to see ${config.title.toLowerCase()} in action
`;
}

function generateSetupMdx(config: ExplorerConfig): string {
  return `---
title: ${config.title} - Setup Guide
sidebar_label: Setup Guide
sidebar_position: 3
description: Set up your environment to build ${config.title.toLowerCase()} pipelines
keywords: [${config.name}, setup, installation, configuration]
---

# Setup Guide

This guide will help you set up your environment to build ${config.title.toLowerCase()} pipelines.

## Prerequisites

Before you begin, ensure you have:

- **TODO: List prerequisites** (e.g., Expanso CLI, Docker, Node.js, etc.)
- **TODO: Minimum versions** (e.g., Expanso v1.0+, Node 20+)
- **TODO: Access requirements** (e.g., API keys, credentials)

## Installation

### 1. Install Expanso CLI

TODO: Provide installation instructions for Expanso.

\`\`\`bash
# Example installation command
curl -sSL https://install.expanso.io | sh
\`\`\`

### 2. Configure Environment

TODO: Explain any environment configuration needed.

\`\`\`bash
# Example configuration
export EXPANSO_API_KEY="your-api-key"
export EXPANSO_ENDPOINT="https://api.expanso.io"
\`\`\`

### 3. Verify Installation

TODO: Provide verification steps.

\`\`\`bash
# Check version
expanso --version

# Test connectivity
expanso status
\`\`\`

## Project Setup

### Create Project Directory

\`\`\`bash
mkdir ${config.name}-example
cd ${config.name}-example
\`\`\`

### Initialize Configuration

TODO: Explain project initialization.

\`\`\`bash
# Example initialization
expanso init
\`\`\`

## Configuration Files

### Pipeline Configuration

Create a basic pipeline configuration:

\`\`\`yaml
# TODO: Provide a minimal pipeline.yaml template
name: ${config.name}-pipeline
description: ${config.title} implementation
type: pipeline
namespace: default

config:
  input:
    # TODO: Configure input

  pipeline:
    processors:
      # TODO: Configure processors

  output:
    # TODO: Configure output
\`\`\`

## Testing Your Setup

### Run the Pipeline

TODO: Provide commands to test the setup.

\`\`\`bash
# Example test command
expanso run pipeline.yaml
\`\`\`

### Expected Output

TODO: Describe what users should see if setup is successful.

## Troubleshooting

### Common Issues

**Problem: TODO Issue 1**
- **Solution:** TODO solution

**Problem: TODO Issue 2**
- **Solution:** TODO solution

## Next Steps

Now that your environment is configured:

1. [**Interactive Explorer**](./explorer) - See ${config.title.toLowerCase()} in action
2. [**Step-by-Step Tutorial**](./step-1-todo) - Build your first pipeline
3. [**Complete Solution**](./complete-pipeline) - Download reference implementation

---

**Continue:** [Start the interactive explorer](./explorer) to see how ${config.title.toLowerCase()} works
`;
}

function updateSidebars(config: ExplorerConfig): void {
  const sidebarsPath = path.join(process.cwd(), 'sidebars.ts');
  let content = fs.readFileSync(sidebarsPath, 'utf8');

  const categoryMap: Record<string, string> = {
    'data-routing': 'Data Routing',
    'data-security': 'Data Security',
    'data-transformation': 'Data Transformation',
    'log-processing': 'Log Processing',
  };

  const categoryLabel = categoryMap[config.category];
  if (!categoryLabel) {
    console.warn(`Warning: Unknown category ${config.category}, sidebar not updated`);
    return;
  }

  // Find the category section
  const categoryRegex = new RegExp(`label: '${categoryLabel}',[\\s\\S]*?items: \\[([\\s\\S]*?)\\],\\s*\\},`, 'm');
  const match = content.match(categoryRegex);

  if (match) {
    const itemsSection = match[1];
    const newEntry = `        {
          type: 'category',
          label: '${config.title}',
          collapsible: true,
          collapsed: true,
          items: [
            '${config.category}/${config.name}/index',
            '${config.category}/${config.name}/explorer',
            '${config.category}/${config.name}/setup',
          ],
        },`;

    // Add the new entry at the end of the items array
    const updatedItems = itemsSection.trim() + '\n' + newEntry;
    const updatedContent = content.replace(itemsSection, '\n' + updatedItems + '\n      ');

    fs.writeFileSync(sidebarsPath, updatedContent);
    console.log('✅ Updated sidebars.ts');
  } else {
    console.warn(`Warning: Could not find category section for ${categoryLabel}`);
  }
}

function main(): void {
  const config = parseArgs();

  console.log('🚀 Creating interactive explorer...');
  console.log(`   Name: ${config.name}`);
  console.log(`   Category: ${config.category}`);
  console.log(`   Stages: ${config.stages}`);
  console.log(`   Title: ${config.title}`);
  console.log('');

  // Create directories
  const docsDir = path.join(process.cwd(), 'docs', config.category);
  const explorerDir = path.join(docsDir, config.name);

  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  if (!fs.existsSync(explorerDir)) {
    fs.mkdirSync(explorerDir, { recursive: true });
  }

  // Generate files
  const stagesFile = path.join(docsDir, `${config.name}-full.stages.ts`);
  const explorerFile = path.join(explorerDir, 'explorer.mdx');
  const indexFile = path.join(explorerDir, 'index.mdx');
  const setupFile = path.join(explorerDir, 'setup.mdx');

  // Check if files already exist
  if (fs.existsSync(stagesFile)) {
    console.error(`❌ Error: ${stagesFile} already exists`);
    process.exit(1);
  }

  if (fs.existsSync(explorerFile)) {
    console.error(`❌ Error: ${explorerFile} already exists`);
    process.exit(1);
  }

  if (fs.existsSync(indexFile)) {
    console.error(`❌ Error: ${indexFile} already exists`);
    process.exit(1);
  }

  if (fs.existsSync(setupFile)) {
    console.error(`❌ Error: ${setupFile} already exists`);
    process.exit(1);
  }

  // Generate all files
  fs.writeFileSync(stagesFile, generateStagesFile(config));
  console.log(`✅ Created ${stagesFile}`);

  fs.writeFileSync(indexFile, generateIndexMdx(config));
  console.log(`✅ Created ${indexFile}`);

  fs.writeFileSync(explorerFile, generateExplorerMdx(config));
  console.log(`✅ Created ${explorerFile}`);

  fs.writeFileSync(setupFile, generateSetupMdx(config));
  console.log(`✅ Created ${setupFile}`);

  // Update sidebars
  updateSidebars(config);

  console.log('');
  console.log('🎉 Explorer boilerplate created successfully!');
  console.log('');
  console.log('📦 Generated files:');
  console.log(`   • ${config.name}-full.stages.ts - Stage definitions`);
  console.log(`   • ${config.name}/index.mdx - Introduction page`);
  console.log(`   • ${config.name}/explorer.mdx - Interactive explorer`);
  console.log(`   • ${config.name}/setup.mdx - Setup guide`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Edit the stages file to add your pipeline logic');
  console.log('  2. Customize index.mdx with use cases and benefits');
  console.log('  3. Update explorer.mdx with stage descriptions');
  console.log('  4. Fill in setup.mdx with installation steps');
  console.log('  5. Run `npm start` to preview your explorer');
  console.log('  6. Run `npm run validate-stages` to check your work');
  console.log('');
}

main();
