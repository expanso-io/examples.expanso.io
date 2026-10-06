#!/usr/bin/env tsx

/**
 * Deterministic sample inputs for the Explorer stage families that previously
 * had no fixture. Each file is the exact input that was run through
 * expanso-edge Local Mode to capture the authored stage checkpoints; the
 * MotherDuck events were captured once from the pipeline's own generate input.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const nightlyBackup = `{
  "orders": [
    {
      "order_id": 100231,
      "customer_id": 4471,
      "status": "shipped",
      "total": 189.95,
      "currency": "USD",
      "created_at": "2024-01-14T16:42:10Z",
      "updated_at": "2024-01-15T08:03:22Z"
    }
  ],
  "inventory": [
    {
      "sku": "SKU-20481",
      "warehouse": "WH-NORTH",
      "quantity_on_hand": 312,
      "reorder_point": 80,
      "updated_at": "2024-01-15T06:00:00Z"
    }
  ],
  "order_items": [
    {
      "item_id": 550912,
      "order_id": 100231,
      "sku": "SKU-20481",
      "quantity": 2,
      "unit_price": 89.99,
      "created_at": "2024-01-14T16:42:10Z"
    }
  ]
}
`;

const crossBorderGdpr = `[
  {
    "transaction_id": "TXN-EU-2024-001842",
    "customer_id": 50231,
    "customer_name": "Anneliese Vogel",
    "customer_email": "anneliese.vogel@example.de",
    "customer_dob": "1987-04-12",
    "customer_address": "Lindenstrasse 14, 10969 Berlin",
    "iban": "DE89370400440532013000",
    "transaction_amount": 249.9,
    "transaction_currency": "EUR",
    "merchant_name": "Kaufhaus Nord",
    "merchant_country": "DE",
    "transaction_timestamp": "2024-01-15T13:42:07Z",
    "ip_address": "85.214.132.117"
  },
  {
    "transaction_id": "TXN-EU-2024-001843",
    "customer_id": 50877,
    "customer_name": "Mathieu Lefevre",
    "customer_email": "m.lefevre@example.fr",
    "customer_dob": "1962-11-30",
    "customer_address": "12 Rue de Rivoli, 75004 Paris",
    "iban": "FR7630006000011234567890189",
    "transaction_amount": 42.5,
    "transaction_currency": "EUR",
    "merchant_name": "Cafe du Marais",
    "merchant_country": "FR",
    "transaction_timestamp": "2024-01-15T13:45:51Z",
    "ip_address": "90.63.21.8"
  }
]
`;

const motherduckRetail = `{"employee_id":"EMP-2505","items":[{"category":"frozen","name":"Item 6","qty":2,"sku":"SKU-65505","unit_price":24.68},{"category":"dairy","name":"Item 153","qty":1,"sku":"SKU-53152","unit_price":23.99},{"category":"household","name":"Item 328","qty":4,"sku":"SKU-45827","unit_price":3.91},{"category":"meat","name":"Item 295","qty":3,"sku":"SKU-67794","unit_price":8.42},{"category":"dairy","name":"Item 203","qty":3,"sku":"SKU-36202","unit_price":7.13},{"category":"bakery","name":"Item 64","qty":4,"sku":"SKU-46063","unit_price":38.24}],"payment_method":"gift_card","store_id":6,"subtotal":288.6,"tax_amount":25.25,"tax_rate":0.0875,"terminal_id":6,"timestamp":"2026-10-05T17:39:21.255967-07:00","total_amount":313.85,"txn_id":"5032b55b-4e75-4b30-9543-fe5930de4419","type":"sale"}
{"employee_id":"EMP-8152","items":[{"category":"bakery","name":"Item 154","qty":2,"sku":"SKU-40153","unit_price":36.49}],"payment_method":"card","store_id":3,"subtotal":72.98,"tax_amount":6.39,"tax_rate":0.0875,"terminal_id":3,"timestamp":"2026-10-05T17:39:21.355365-07:00","total_amount":79.37,"txn_id":"b44d442c-8839-4cb0-b885-a76d573def6b","type":"sale"}
{"employee_id":"EMP-9827","items":[{"category":"beverage","name":"Item 457","qty":1,"sku":"SKU-82456","unit_price":41.21},{"category":"electronics","name":"Item 430","qty":2,"sku":"SKU-74929","unit_price":19.17}],"payment_method":"card","store_id":28,"subtotal":79.55,"tax_amount":6.96,"tax_rate":0.0875,"terminal_id":8,"timestamp":"2026-10-05T17:39:21.454515-07:00","total_amount":86.51,"txn_id":"9be5e1c9-1347-4787-84b8-5249eb4ed8bf","type":"sale"}
`;

const generated = new Map<string, string>([
  [
    'examples/enterprise-migration/nightly-backup/sample-input.json',
    nightlyBackup,
  ],
  [
    'examples/data-security/cross-border-gdpr/sample-input.json',
    crossBorderGdpr,
  ],
  [
    'examples/integrations/motherduck-retail-analytics/sample-pos-events.jsonl',
    motherduckRetail,
  ],
]);

if (process.argv.slice(2).includes('--write')) {
  for (const [path, bytes] of generated) writeFileSync(resolve(path), bytes);
  process.stdout.write(
    `Wrote ${generated.size} Explorer stage fixture files.\n`
  );
} else {
  const drift = [...generated].filter(
    ([path, bytes]) => readFileSync(resolve(path), 'utf8') !== bytes
  );

  if (drift.length > 0) {
    process.stderr.write(
      `Explorer stage fixture drift:\n${drift.map(([path]) => path).join('\n')}\n`
    );
    process.exitCode = 1;
  } else {
    process.stdout.write('Explorer stage fixtures match the generator.\n');
  }
}
