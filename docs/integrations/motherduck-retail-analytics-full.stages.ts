import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const motherduckRetailAnalyticsStages: Stage[] = [
  {
    id: 1,
    slug: 'generate-pos-transactions',
    title: 'Generate POS transactions',
    description:
      'Synthesize a point-of-sale event with items, totals, and a payment method on a 100ms timer.',
    inputLines: [
      {
        content: '[generate input: one synthetic POS event every 100ms]',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '[',
        indent: 0,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"employee_id": "EMP-2505",',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "frozen",',
        indent: 4,
      },
      {
        content: '"name": "Item 6",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-65505",',
        indent: 4,
      },
      {
        content: '"unit_price": 24.68',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 153",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-53152",',
        indent: 4,
      },
      {
        content: '"unit_price": 23.99',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "household",',
        indent: 4,
      },
      {
        content: '"name": "Item 328",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-45827",',
        indent: 4,
      },
      {
        content: '"unit_price": 3.91',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "meat",',
        indent: 4,
      },
      {
        content: '"name": "Item 295",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-67794",',
        indent: 4,
      },
      {
        content: '"unit_price": 8.42',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 203",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-36202",',
        indent: 4,
      },
      {
        content: '"unit_price": 7.13',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 64",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-46063",',
        indent: 4,
      },
      {
        content: '"unit_price": 38.24',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "gift_card",',
        indent: 2,
      },
      {
        content: '"store_id": 6,',
        indent: 2,
      },
      {
        content: '"subtotal": 288.6,',
        indent: 2,
      },
      {
        content: '"tax_amount": 25.25,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 6,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.255967-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 313.85,',
        indent: 2,
      },
      {
        content: '"txn_id": "5032b55b-4e75-4b30-9543-fe5930de4419",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"employee_id": "EMP-8152",',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 154",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-40153",',
        indent: 4,
      },
      {
        content: '"unit_price": 36.49',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"store_id": 3,',
        indent: 2,
      },
      {
        content: '"subtotal": 72.98,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.39,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 3,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.355365-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 79.37,',
        indent: 2,
      },
      {
        content: '"txn_id": "b44d442c-8839-4cb0-b885-a76d573def6b",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"employee_id": "EMP-9827",',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "beverage",',
        indent: 4,
      },
      {
        content: '"name": "Item 457",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-82456",',
        indent: 4,
      },
      {
        content: '"unit_price": 41.21',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "electronics",',
        indent: 4,
      },
      {
        content: '"name": "Item 430",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-74929",',
        indent: 4,
      },
      {
        content: '"unit_price": 19.17',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"store_id": 28,',
        indent: 2,
      },
      {
        content: '"subtotal": 79.55,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.96,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 8,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.454515-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 86.51,',
        indent: 2,
      },
      {
        content: '"txn_id": "9be5e1c9-1347-4787-84b8-5249eb4ed8bf",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '}',
        indent: 1,
      },
      {
        content: ']',
        indent: 0,
      },
    ],
  },
  {
    id: 2,
    slug: 'enrich-with-store-metadata',
    title: 'Enrich with store metadata',
    description:
      'Look up the region, format, city, and size for the store and derive time and basket features.',
    inputLines: [
      {
        content: '[',
        indent: 0,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"employee_id": "EMP-2505",',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "frozen",',
        indent: 4,
      },
      {
        content: '"name": "Item 6",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-65505",',
        indent: 4,
      },
      {
        content: '"unit_price": 24.68',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 153",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-53152",',
        indent: 4,
      },
      {
        content: '"unit_price": 23.99',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "household",',
        indent: 4,
      },
      {
        content: '"name": "Item 328",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-45827",',
        indent: 4,
      },
      {
        content: '"unit_price": 3.91',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "meat",',
        indent: 4,
      },
      {
        content: '"name": "Item 295",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-67794",',
        indent: 4,
      },
      {
        content: '"unit_price": 8.42',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 203",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-36202",',
        indent: 4,
      },
      {
        content: '"unit_price": 7.13',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 64",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-46063",',
        indent: 4,
      },
      {
        content: '"unit_price": 38.24',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "gift_card",',
        indent: 2,
      },
      {
        content: '"store_id": 6,',
        indent: 2,
      },
      {
        content: '"subtotal": 288.6,',
        indent: 2,
      },
      {
        content: '"tax_amount": 25.25,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 6,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.255967-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 313.85,',
        indent: 2,
      },
      {
        content: '"txn_id": "5032b55b-4e75-4b30-9543-fe5930de4419",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"employee_id": "EMP-8152",',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 154",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-40153",',
        indent: 4,
      },
      {
        content: '"unit_price": 36.49',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"store_id": 3,',
        indent: 2,
      },
      {
        content: '"subtotal": 72.98,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.39,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 3,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.355365-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 79.37,',
        indent: 2,
      },
      {
        content: '"txn_id": "b44d442c-8839-4cb0-b885-a76d573def6b",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"employee_id": "EMP-9827",',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "beverage",',
        indent: 4,
      },
      {
        content: '"name": "Item 457",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-82456",',
        indent: 4,
      },
      {
        content: '"unit_price": 41.21',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "electronics",',
        indent: 4,
      },
      {
        content: '"name": "Item 430",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-74929",',
        indent: 4,
      },
      {
        content: '"unit_price": 19.17',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"store_id": 28,',
        indent: 2,
      },
      {
        content: '"subtotal": 79.55,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.96,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 8,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.454515-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 86.51,',
        indent: 2,
      },
      {
        content: '"txn_id": "9be5e1c9-1347-4787-84b8-5249eb4ed8bf",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '}',
        indent: 1,
      },
      {
        content: ']',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '[',
        indent: 0,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"avg_item_price": 48.1,',
        indent: 2,
      },
      {
        content: '"basket_size": 6,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-2505",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "frozen",',
        indent: 4,
      },
      {
        content: '"name": "Item 6",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-65505",',
        indent: 4,
      },
      {
        content: '"unit_price": 24.68',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 153",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-53152",',
        indent: 4,
      },
      {
        content: '"unit_price": 23.99',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "household",',
        indent: 4,
      },
      {
        content: '"name": "Item 328",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-45827",',
        indent: 4,
      },
      {
        content: '"unit_price": 3.91',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "meat",',
        indent: 4,
      },
      {
        content: '"name": "Item 295",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-67794",',
        indent: 4,
      },
      {
        content: '"unit_price": 8.42',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 203",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-36202",',
        indent: 4,
      },
      {
        content: '"unit_price": 7.13',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 64",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-46063",',
        indent: 4,
      },
      {
        content: '"unit_price": 38.24',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "gift_card",',
        indent: 2,
      },
      {
        content: '"store_city": "Las Vegas",',
        indent: 2,
      },
      {
        content: '"store_format": "outlet",',
        indent: 2,
      },
      {
        content: '"store_id": 6,',
        indent: 2,
      },
      {
        content: '"store_region": "SW",',
        indent: 2,
      },
      {
        content: '"store_sqft": 18000,',
        indent: 2,
      },
      {
        content: '"store_state": "NV",',
        indent: 2,
      },
      {
        content: '"subtotal": 288.6,',
        indent: 2,
      },
      {
        content: '"tax_amount": 25.25,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 6,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.255967-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 313.85,',
        indent: 2,
      },
      {
        content: '"txn_id": "5032b55b-4e75-4b30-9543-fe5930de4419",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"avg_item_price": 72.98,',
        indent: 2,
      },
      {
        content: '"basket_size": 1,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-8152",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 154",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-40153",',
        indent: 4,
      },
      {
        content: '"unit_price": 36.49',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"store_city": "Boise",',
        indent: 2,
      },
      {
        content: '"store_format": "express",',
        indent: 2,
      },
      {
        content: '"store_id": 3,',
        indent: 2,
      },
      {
        content: '"store_region": "NW",',
        indent: 2,
      },
      {
        content: '"store_sqft": 12000,',
        indent: 2,
      },
      {
        content: '"store_state": "ID",',
        indent: 2,
      },
      {
        content: '"subtotal": 72.98,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.39,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 3,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.355365-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 79.37,',
        indent: 2,
      },
      {
        content: '"txn_id": "b44d442c-8839-4cb0-b885-a76d573def6b",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"avg_item_price": 39.78,',
        indent: 2,
      },
      {
        content: '"basket_size": 2,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-9827",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "beverage",',
        indent: 4,
      },
      {
        content: '"name": "Item 457",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-82456",',
        indent: 4,
      },
      {
        content: '"unit_price": 41.21',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "electronics",',
        indent: 4,
      },
      {
        content: '"name": "Item 430",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-74929",',
        indent: 4,
      },
      {
        content: '"unit_price": 19.17',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"store_city": "Store-28",',
        indent: 2,
      },
      {
        content: '"store_format": "standard",',
        indent: 2,
      },
      {
        content: '"store_id": 28,',
        indent: 2,
      },
      {
        content: '"store_region": "SE",',
        indent: 2,
      },
      {
        content: '"store_sqft": 34000,',
        indent: 2,
      },
      {
        content: '"store_state": "US",',
        indent: 2,
      },
      {
        content: '"subtotal": 79.55,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.96,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 8,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.454515-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 86.51,',
        indent: 2,
      },
      {
        content: '"txn_id": "9be5e1c9-1347-4787-84b8-5249eb4ed8bf",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '}',
        indent: 1,
      },
      {
        content: ']',
        indent: 0,
      },
    ],
  },
  {
    id: 3,
    slug: 'validate-and-flag-transactions',
    title: 'Validate and flag transactions',
    description:
      'Apply the anomaly checks and attach the flags, an anomaly bit, and a quality score.',
    inputLines: [
      {
        content: '[',
        indent: 0,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"avg_item_price": 48.1,',
        indent: 2,
      },
      {
        content: '"basket_size": 6,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-2505",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "frozen",',
        indent: 4,
      },
      {
        content: '"name": "Item 6",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-65505",',
        indent: 4,
      },
      {
        content: '"unit_price": 24.68',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 153",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-53152",',
        indent: 4,
      },
      {
        content: '"unit_price": 23.99',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "household",',
        indent: 4,
      },
      {
        content: '"name": "Item 328",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-45827",',
        indent: 4,
      },
      {
        content: '"unit_price": 3.91',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "meat",',
        indent: 4,
      },
      {
        content: '"name": "Item 295",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-67794",',
        indent: 4,
      },
      {
        content: '"unit_price": 8.42',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 203",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-36202",',
        indent: 4,
      },
      {
        content: '"unit_price": 7.13',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 64",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-46063",',
        indent: 4,
      },
      {
        content: '"unit_price": 38.24',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "gift_card",',
        indent: 2,
      },
      {
        content: '"store_city": "Las Vegas",',
        indent: 2,
      },
      {
        content: '"store_format": "outlet",',
        indent: 2,
      },
      {
        content: '"store_id": 6,',
        indent: 2,
      },
      {
        content: '"store_region": "SW",',
        indent: 2,
      },
      {
        content: '"store_sqft": 18000,',
        indent: 2,
      },
      {
        content: '"store_state": "NV",',
        indent: 2,
      },
      {
        content: '"subtotal": 288.6,',
        indent: 2,
      },
      {
        content: '"tax_amount": 25.25,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 6,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.255967-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 313.85,',
        indent: 2,
      },
      {
        content: '"txn_id": "5032b55b-4e75-4b30-9543-fe5930de4419",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"avg_item_price": 72.98,',
        indent: 2,
      },
      {
        content: '"basket_size": 1,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-8152",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 154",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-40153",',
        indent: 4,
      },
      {
        content: '"unit_price": 36.49',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"store_city": "Boise",',
        indent: 2,
      },
      {
        content: '"store_format": "express",',
        indent: 2,
      },
      {
        content: '"store_id": 3,',
        indent: 2,
      },
      {
        content: '"store_region": "NW",',
        indent: 2,
      },
      {
        content: '"store_sqft": 12000,',
        indent: 2,
      },
      {
        content: '"store_state": "ID",',
        indent: 2,
      },
      {
        content: '"subtotal": 72.98,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.39,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 3,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.355365-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 79.37,',
        indent: 2,
      },
      {
        content: '"txn_id": "b44d442c-8839-4cb0-b885-a76d573def6b",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"avg_item_price": 39.78,',
        indent: 2,
      },
      {
        content: '"basket_size": 2,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-9827",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "beverage",',
        indent: 4,
      },
      {
        content: '"name": "Item 457",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-82456",',
        indent: 4,
      },
      {
        content: '"unit_price": 41.21',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "electronics",',
        indent: 4,
      },
      {
        content: '"name": "Item 430",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-74929",',
        indent: 4,
      },
      {
        content: '"unit_price": 19.17',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"store_city": "Store-28",',
        indent: 2,
      },
      {
        content: '"store_format": "standard",',
        indent: 2,
      },
      {
        content: '"store_id": 28,',
        indent: 2,
      },
      {
        content: '"store_region": "SE",',
        indent: 2,
      },
      {
        content: '"store_sqft": 34000,',
        indent: 2,
      },
      {
        content: '"store_state": "US",',
        indent: 2,
      },
      {
        content: '"subtotal": 79.55,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.96,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 8,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.454515-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 86.51,',
        indent: 2,
      },
      {
        content: '"txn_id": "9be5e1c9-1347-4787-84b8-5249eb4ed8bf",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '}',
        indent: 1,
      },
      {
        content: ']',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '[',
        indent: 0,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"anomaly_flags": [],',
        indent: 2,
      },
      {
        content: '"avg_item_price": 48.1,',
        indent: 2,
      },
      {
        content: '"basket_size": 6,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-2505",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_anomaly": false,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "frozen",',
        indent: 4,
      },
      {
        content: '"name": "Item 6",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-65505",',
        indent: 4,
      },
      {
        content: '"unit_price": 24.68',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 153",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-53152",',
        indent: 4,
      },
      {
        content: '"unit_price": 23.99',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "household",',
        indent: 4,
      },
      {
        content: '"name": "Item 328",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-45827",',
        indent: 4,
      },
      {
        content: '"unit_price": 3.91',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "meat",',
        indent: 4,
      },
      {
        content: '"name": "Item 295",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-67794",',
        indent: 4,
      },
      {
        content: '"unit_price": 8.42',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 203",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-36202",',
        indent: 4,
      },
      {
        content: '"unit_price": 7.13',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 64",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-46063",',
        indent: 4,
      },
      {
        content: '"unit_price": 38.24',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "gift_card",',
        indent: 2,
      },
      {
        content: '"quality_score": "clean",',
        indent: 2,
      },
      {
        content: '"store_city": "Las Vegas",',
        indent: 2,
      },
      {
        content: '"store_format": "outlet",',
        indent: 2,
      },
      {
        content: '"store_id": 6,',
        indent: 2,
      },
      {
        content: '"store_region": "SW",',
        indent: 2,
      },
      {
        content: '"store_sqft": 18000,',
        indent: 2,
      },
      {
        content: '"store_state": "NV",',
        indent: 2,
      },
      {
        content: '"subtotal": 288.6,',
        indent: 2,
      },
      {
        content: '"tax_amount": 25.25,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 6,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.255967-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 313.85,',
        indent: 2,
      },
      {
        content: '"txn_id": "5032b55b-4e75-4b30-9543-fe5930de4419",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"anomaly_flags": [],',
        indent: 2,
      },
      {
        content: '"avg_item_price": 72.98,',
        indent: 2,
      },
      {
        content: '"basket_size": 1,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-8152",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_anomaly": false,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 154",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-40153",',
        indent: 4,
      },
      {
        content: '"unit_price": 36.49',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"quality_score": "clean",',
        indent: 2,
      },
      {
        content: '"store_city": "Boise",',
        indent: 2,
      },
      {
        content: '"store_format": "express",',
        indent: 2,
      },
      {
        content: '"store_id": 3,',
        indent: 2,
      },
      {
        content: '"store_region": "NW",',
        indent: 2,
      },
      {
        content: '"store_sqft": 12000,',
        indent: 2,
      },
      {
        content: '"store_state": "ID",',
        indent: 2,
      },
      {
        content: '"subtotal": 72.98,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.39,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 3,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.355365-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 79.37,',
        indent: 2,
      },
      {
        content: '"txn_id": "b44d442c-8839-4cb0-b885-a76d573def6b",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"anomaly_flags": [],',
        indent: 2,
      },
      {
        content: '"avg_item_price": 39.78,',
        indent: 2,
      },
      {
        content: '"basket_size": 2,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-9827",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_anomaly": false,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "beverage",',
        indent: 4,
      },
      {
        content: '"name": "Item 457",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-82456",',
        indent: 4,
      },
      {
        content: '"unit_price": 41.21',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "electronics",',
        indent: 4,
      },
      {
        content: '"name": "Item 430",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-74929",',
        indent: 4,
      },
      {
        content: '"unit_price": 19.17',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"quality_score": "clean",',
        indent: 2,
      },
      {
        content: '"store_city": "Store-28",',
        indent: 2,
      },
      {
        content: '"store_format": "standard",',
        indent: 2,
      },
      {
        content: '"store_id": 28,',
        indent: 2,
      },
      {
        content: '"store_region": "SE",',
        indent: 2,
      },
      {
        content: '"store_sqft": 34000,',
        indent: 2,
      },
      {
        content: '"store_state": "US",',
        indent: 2,
      },
      {
        content: '"subtotal": 79.55,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.96,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 8,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.454515-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 86.51,',
        indent: 2,
      },
      {
        content: '"txn_id": "9be5e1c9-1347-4787-84b8-5249eb4ed8bf",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '}',
        indent: 1,
      },
      {
        content: ']',
        indent: 0,
      },
    ],
  },
  {
    id: 4,
    slug: 'batch-and-encode-to-parquet',
    title: 'Batch and encode to Parquet',
    description:
      'Flatten items to JSON text, batch 1000 events or 10 seconds, group by store region, and encode each region group as a separate Parquet object.',
    inputLines: [
      {
        content: '[',
        indent: 0,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"anomaly_flags": [],',
        indent: 2,
      },
      {
        content: '"avg_item_price": 48.1,',
        indent: 2,
      },
      {
        content: '"basket_size": 6,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-2505",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_anomaly": false,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "frozen",',
        indent: 4,
      },
      {
        content: '"name": "Item 6",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-65505",',
        indent: 4,
      },
      {
        content: '"unit_price": 24.68',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 153",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-53152",',
        indent: 4,
      },
      {
        content: '"unit_price": 23.99',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "household",',
        indent: 4,
      },
      {
        content: '"name": "Item 328",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-45827",',
        indent: 4,
      },
      {
        content: '"unit_price": 3.91',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "meat",',
        indent: 4,
      },
      {
        content: '"name": "Item 295",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-67794",',
        indent: 4,
      },
      {
        content: '"unit_price": 8.42',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "dairy",',
        indent: 4,
      },
      {
        content: '"name": "Item 203",',
        indent: 4,
      },
      {
        content: '"qty": 3,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-36202",',
        indent: 4,
      },
      {
        content: '"unit_price": 7.13',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 64",',
        indent: 4,
      },
      {
        content: '"qty": 4,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-46063",',
        indent: 4,
      },
      {
        content: '"unit_price": 38.24',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "gift_card",',
        indent: 2,
      },
      {
        content: '"quality_score": "clean",',
        indent: 2,
      },
      {
        content: '"store_city": "Las Vegas",',
        indent: 2,
      },
      {
        content: '"store_format": "outlet",',
        indent: 2,
      },
      {
        content: '"store_id": 6,',
        indent: 2,
      },
      {
        content: '"store_region": "SW",',
        indent: 2,
      },
      {
        content: '"store_sqft": 18000,',
        indent: 2,
      },
      {
        content: '"store_state": "NV",',
        indent: 2,
      },
      {
        content: '"subtotal": 288.6,',
        indent: 2,
      },
      {
        content: '"tax_amount": 25.25,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 6,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.255967-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 313.85,',
        indent: 2,
      },
      {
        content: '"txn_id": "5032b55b-4e75-4b30-9543-fe5930de4419",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"anomaly_flags": [],',
        indent: 2,
      },
      {
        content: '"avg_item_price": 72.98,',
        indent: 2,
      },
      {
        content: '"basket_size": 1,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-8152",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_anomaly": false,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "bakery",',
        indent: 4,
      },
      {
        content: '"name": "Item 154",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-40153",',
        indent: 4,
      },
      {
        content: '"unit_price": 36.49',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"quality_score": "clean",',
        indent: 2,
      },
      {
        content: '"store_city": "Boise",',
        indent: 2,
      },
      {
        content: '"store_format": "express",',
        indent: 2,
      },
      {
        content: '"store_id": 3,',
        indent: 2,
      },
      {
        content: '"store_region": "NW",',
        indent: 2,
      },
      {
        content: '"store_sqft": 12000,',
        indent: 2,
      },
      {
        content: '"store_state": "ID",',
        indent: 2,
      },
      {
        content: '"subtotal": 72.98,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.39,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 3,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.355365-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 79.37,',
        indent: 2,
      },
      {
        content: '"txn_id": "b44d442c-8839-4cb0-b885-a76d573def6b",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '},',
        indent: 1,
      },
      {
        content: '{',
        indent: 1,
      },
      {
        content: '"anomaly_flags": [],',
        indent: 2,
      },
      {
        content: '"avg_item_price": 39.78,',
        indent: 2,
      },
      {
        content: '"basket_size": 2,',
        indent: 2,
      },
      {
        content: '"day_of_week": "Monday",',
        indent: 2,
      },
      {
        content: '"employee_id": "EMP-9827",',
        indent: 2,
      },
      {
        content: '"hour_of_day": 17,',
        indent: 2,
      },
      {
        content: '"is_anomaly": false,',
        indent: 2,
      },
      {
        content: '"is_weekend": false,',
        indent: 2,
      },
      {
        content: '"items": [',
        indent: 2,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "beverage",',
        indent: 4,
      },
      {
        content: '"name": "Item 457",',
        indent: 4,
      },
      {
        content: '"qty": 1,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-82456",',
        indent: 4,
      },
      {
        content: '"unit_price": 41.21',
        indent: 4,
      },
      {
        content: '},',
        indent: 3,
      },
      {
        content: '{',
        indent: 3,
      },
      {
        content: '"category": "electronics",',
        indent: 4,
      },
      {
        content: '"name": "Item 430",',
        indent: 4,
      },
      {
        content: '"qty": 2,',
        indent: 4,
      },
      {
        content: '"sku": "SKU-74929",',
        indent: 4,
      },
      {
        content: '"unit_price": 19.17',
        indent: 4,
      },
      {
        content: '}',
        indent: 3,
      },
      {
        content: '],',
        indent: 2,
      },
      {
        content: '"payment_method": "card",',
        indent: 2,
      },
      {
        content: '"quality_score": "clean",',
        indent: 2,
      },
      {
        content: '"store_city": "Store-28",',
        indent: 2,
      },
      {
        content: '"store_format": "standard",',
        indent: 2,
      },
      {
        content: '"store_id": 28,',
        indent: 2,
      },
      {
        content: '"store_region": "SE",',
        indent: 2,
      },
      {
        content: '"store_sqft": 34000,',
        indent: 2,
      },
      {
        content: '"store_state": "US",',
        indent: 2,
      },
      {
        content: '"subtotal": 79.55,',
        indent: 2,
      },
      {
        content: '"tax_amount": 6.96,',
        indent: 2,
      },
      {
        content: '"tax_rate": 0.0875,',
        indent: 2,
      },
      {
        content: '"terminal_id": 8,',
        indent: 2,
      },
      {
        content: '"timestamp": "2026-10-05T17:39:21.454515-07:00",',
        indent: 2,
      },
      {
        content: '"total_amount": 86.51,',
        indent: 2,
      },
      {
        content: '"txn_id": "9be5e1c9-1347-4787-84b8-5249eb4ed8bf",',
        indent: 2,
      },
      {
        content: '"type": "sale"',
        indent: 2,
      },
      {
        content: '}',
        indent: 1,
      },
      {
        content: ']',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '[Parquet encoding plan for the sample region groups]',
        indent: 0,
      },
      {
        content: '# region=NW: 1 row; metadata store_region=NW',
        indent: 0,
      },
      {
        content: '# region=SE: 1 row; metadata store_region=SE',
        indent: 0,
      },
      {
        content: '# region=SW: 1 row; metadata store_region=SW',
        indent: 0,
      },
      {
        content:
          '# Encoding: zstd; items_json and anomaly_flags serialized as text',
        indent: 0,
      },
      {
        content:
          '# Binary encoding and S3 delivery: not assessed by this capture',
        indent: 0,
      },
    ],
  },
  {
    id: 5,
    slug: 'write-partitioned-parquet-to-s3',
    title: 'Write partitioned Parquet to S3',
    description:
      'Upload each Parquet batch under region and date partitions that DuckLake can discover. Delivery has not been exercised.',
    inputLines: [
      {
        content: '[Parquet encoding plan for the sample region groups]',
        indent: 0,
      },
      {
        content: '# region=NW: 1 row; metadata store_region=NW',
        indent: 0,
      },
      {
        content: '# region=SE: 1 row; metadata store_region=SE',
        indent: 0,
      },
      {
        content: '# region=SW: 1 row; metadata store_region=SW',
        indent: 0,
      },
      {
        content:
          '# Encoding: zstd; items_json and anomaly_flags serialized as text',
        indent: 0,
      },
      {
        content:
          '# Binary encoding and S3 delivery: not assessed by this capture',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content: '# Bucket: ${S3_BUCKET}',
        indent: 0,
      },
      {
        content:
          '# Key: transactions/region=NW/date=<yyyy-mm-dd>/batch_<unix>_<n>.parquet',
        indent: 0,
      },
      {
        content:
          '# Key: transactions/region=SE/date=<yyyy-mm-dd>/batch_<unix>_<n>.parquet',
        indent: 0,
      },
      {
        content:
          '# Key: transactions/region=SW/date=<yyyy-mm-dd>/batch_<unix>_<n>.parquet',
        indent: 0,
      },
      {
        content: '# Delivery behavior: not assessed',
        indent: 0,
      },
    ],
  },
];
