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
