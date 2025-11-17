# Interactive Explorer CLI Tools

## create-explorer

Generate boilerplate for a new interactive explorer in seconds.

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

1. **Stage file**: `docs/{category}/{name}-full.stages.ts`
   - TypeScript file with Stage type
   - Template for each stage with TODO markers
   - Placeholder input/output JsonLine data

2. **Explorer page**: `docs/{category}/{name}/explorer.mdx`
   - Complete MDX page with DataPipelineExplorer component
   - Proper frontmatter and SEO metadata
   - Modern button styling
   - Template content with TODO markers

3. **Sidebar entry**: Updates `sidebars.ts`
   - Adds new explorer to appropriate category
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
    ├── {name}-full.stages.ts          # Stage definitions
    └── {name}/
        ├── index.mdx                   # Introduction (create manually)
        ├── explorer.mdx                # Interactive explorer (generated)
        ├── setup.mdx                   # Setup guide (create manually)
        ├── step-1-*.mdx               # Tutorial steps (create manually)
        ├── step-2-*.mdx
        └── complete-*.mdx             # Complete solution (create manually)
```

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

### Related Documentation

- [Stage Type Reference](../src/components/DataPipelineExplorer/types.ts)
- [Example Patterns Guide](../docs/internal/EXAMPLE_PATTERNS.md)
- [Contributing Guide](../CONTRIBUTING.md)
