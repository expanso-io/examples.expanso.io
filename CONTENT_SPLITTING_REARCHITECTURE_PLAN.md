## Rearchitecture Plan: Content Splitting

### Structure
- [x] Introduction (index.mdx) - Problem statement, solution overview, 3 learning paths
- [ ] Interactive Explorer (explorer.mdx) - YES - Progressive transformation visualization
- [x] Setup (setup.mdx) - Environment setup, shell pipeline deployment
- [x] Step 1: Split JSON Arrays (step-1-split-json-arrays.mdx)
- [x] Step 2: Split CSV Batches (step-2-split-csv-batches.mdx)  
- [x] Step 3: Split Nested Structures (step-3-split-nested-structures.mdx)
- [x] Step 4: Advanced Splitting Patterns (step-4-advanced-patterns.mdx)
- [x] Step 5: Production Considerations (step-5-production-considerations.mdx)
- [x] Complete Pipeline (complete-content-splitting.mdx)
- [x] Troubleshooting (troubleshooting.mdx)

### Key Concepts
1. **JSON Array Splitting** - Basic unarchive processor, metadata preservation
2. **CSV/Line Splitting** - File input, header handling, field parsing  
3. **Nested Structure Splitting** - Complex JSON, multi-level context preservation
4. **Advanced Patterns** - Split-and-rebatch, filtering, ordering
5. **Production** - Edge splitting, memory limits, error handling

### Compliance/Security
- **Data Privacy**: Splitting sensitive data for granular access control
- **GDPR**: Individual record processing for data subject requests
- **PCI-DSS**: Isolating payment data from other transaction data
- **SOC 2**: Audit trails for individual data transformations

### Production Considerations
- Edge-first splitting for bandwidth optimization (85% reduction)
- Memory management for large arrays (validate <10K items)
- Atomic operations with error recovery
- Message ordering preservation with sequence numbers
- Dead letter queue patterns for split failures

### Interactive Explorer Rationale
YES - Content splitting has clear progressive transformation stages:
1. Original bundled message (array/batch)
2. Split into individual messages  
3. Context preservation (metadata injection)
4. Content-based routing decisions
5. Re-batching for efficient delivery

This visual progression would help users understand the transformation flow.
