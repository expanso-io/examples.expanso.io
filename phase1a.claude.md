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
