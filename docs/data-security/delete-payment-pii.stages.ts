import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const deletePaymentStages: Stage[] = [
  {
    id: 1,
    title: 'Original Input',
    description: 'Raw purchase event with full credit card details. This violates PCI-DSS compliance requirements.',
    yamlFilename: 'input.json',
    yamlCode: `# No processing yet - this is the raw input
# PCI-DSS violation: full card number exposed`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"full_number": "4532-1234-5678-9010",', indent: 2, key: 'full_number', valueType: 'string', type: 'removed' },
      { content: '"expiry": "12/25",', indent: 2, key: 'expiry', valueType: 'string', type: 'removed' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"amount": 49.99,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"full_number": "4532-1234-5678-9010",', indent: 2, key: 'full_number', valueType: 'string', type: 'removed' },
      { content: '"expiry": "12/25",', indent: 2, key: 'expiry', valueType: 'string', type: 'removed' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"amount": 49.99,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    title: 'Delete Card Number',
    description: 'Remove the full credit card number using the .without() function. This is the highest-risk PII field.',
    yamlFilename: 'step-1-delete-card.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        
        # Remove full card number (PCI-DSS Level 1)
        root.payment_method = this.payment_method.without("full_number")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"full_number": "4532-1234-5678-9010",', indent: 2, key: 'full_number', valueType: 'string', type: 'removed' },
      { content: '"expiry": "12/25",', indent: 2, key: 'expiry', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"amount": 49.99,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"payment_method": {', indent: 1, type: 'highlighted' },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string', type: 'highlighted' },
      { content: '"expiry": "12/25",', indent: 2, key: 'expiry', valueType: 'string', type: 'highlighted' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1, type: 'highlighted' },
      { content: '"amount": 49.99,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: 'Delete Expiry Date',
    description: 'Remove the expiry date as well. Combined with the card number, this eliminates all high-risk payment PII.',
    yamlFilename: 'step-2-delete-expiry.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        
        # Remove both high-risk fields
        root.payment_method = this.payment_method.without(
          "full_number",
          "expiry"
        )`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"full_number": "4532-1234-5678-9010",', indent: 2, key: 'full_number', valueType: 'string', type: 'removed' },
      { content: '"expiry": "12/25",', indent: 2, key: 'expiry', valueType: 'string', type: 'removed' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"amount": 49.99,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"payment_method": {', indent: 1, type: 'highlighted' },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string', type: 'highlighted' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1, type: 'highlighted' },
      { content: '"amount": 49.99,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: 'Verify Result',
    description: 'Final output: PCI-DSS compliant. Only last_four remains for analytics (fraud detection, payment method trends).',
    yamlFilename: 'output.json',
    yamlCode: `# ✅ PCI-DSS Compliant Output
# 
# Removed:
#   - full_number (high-risk)
#   - expiry (high-risk)
#
# Kept:
#   - last_four (safe for analytics)
#   - type (payment method tracking)
#   - amount, currency (business metrics)`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"full_number": "4532-1234-5678-9010",', indent: 2, key: 'full_number', valueType: 'string', type: 'removed' },
      { content: '"expiry": "12/25",', indent: 2, key: 'expiry', valueType: 'string', type: 'removed' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"amount": 49.99,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"payment_method": {', indent: 1, type: 'highlighted' },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string', type: 'highlighted' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1, type: 'highlighted' },
      { content: '"amount": 49.99,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },
];

