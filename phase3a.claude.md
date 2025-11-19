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
