import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const encryptDataStages: Stage[] = [
  {
    id: 1,
    title: "Step 1: Original Payment Data",
    description: "Raw payment transaction with sensitive fields exposed in plaintext. Credit card numbers, CVV codes, SSNs, and PII are visible to anyone with database access.",
    yamlFilename: "input.json",
    yamlCode: `# No encryption yet - raw input
input:
  http_server:
    address: "0.0.0.0:8080"
    path: "/payments"`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"transaction_id": "txn_20251020_001",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"timestamp": "2025-10-20T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"merchant_id": "merchant_789",', indent: 1, key: 'merchant_id', valueType: 'string' },
      { content: '"amount": 127.50,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD",', indent: 1, key: 'currency', valueType: 'string' },
      { content: '"payment": {', indent: 1, key: 'payment' },
      { content: '"card_number": "4532-1234-5678-9010",', indent: 2, key: 'card_number', valueType: 'string', type: 'highlighted' },
      { content: '"cvv": "123",', indent: 2, key: 'cvv', valueType: 'string', type: 'highlighted' },
      { content: '"expiration": "12/27",', indent: 2, key: 'expiration', valueType: 'string' },
      { content: '"cardholder_name": "Sarah Johnson"', indent: 2, key: 'cardholder_name', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1 },
      { content: '"customer": {', indent: 1, key: 'customer' },
      { content: '"email": "sarah.johnson@example.com",', indent: 2, key: 'email', valueType: 'string', type: 'highlighted' },
      { content: '"phone": "+1-415-555-0123",', indent: 2, key: 'phone', valueType: 'string', type: 'highlighted' },
      { content: '"ssn": "123-45-6789",', indent: 2, key: 'ssn', valueType: 'string', type: 'highlighted' },
      { content: '"date_of_birth": "1985-03-15"', indent: 2, key: 'date_of_birth', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1 },
      { content: '"billing_address": {', indent: 1, key: 'billing_address' },
      { content: '"street": "123 Main St",', indent: 2, key: 'street', valueType: 'string', type: 'highlighted' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"state": "CA",', indent: 2, key: 'state', valueType: 'string' },
      { content: '"zip": "94102",', indent: 2, key: 'zip', valueType: 'string', type: 'highlighted' },
      { content: '"country": "US"', indent: 2, key: 'country', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"transaction_id": "txn_20251020_001",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"timestamp": "2025-10-20T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"merchant_id": "merchant_789",', indent: 1, key: 'merchant_id', valueType: 'string' },
      { content: '"amount": 127.50,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD",', indent: 1, key: 'currency', valueType: 'string' },
      { content: '"payment": {', indent: 1, key: 'payment' },
      { content: '"card_number": "4532-1234-5678-9010",', indent: 2, key: 'card_number', valueType: 'string', type: 'highlighted' },
      { content: '"cvv": "123",', indent: 2, key: 'cvv', valueType: 'string', type: 'highlighted' },
      { content: '"expiration": "12/27",', indent: 2, key: 'expiration', valueType: 'string' },
      { content: '"cardholder_name": "Sarah Johnson"', indent: 2, key: 'cardholder_name', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1 },
      { content: '"customer": {', indent: 1, key: 'customer' },
      { content: '"email": "sarah.johnson@example.com",', indent: 2, key: 'email', valueType: 'string', type: 'highlighted' },
      { content: '"phone": "+1-415-555-0123",', indent: 2, key: 'phone', valueType: 'string', type: 'highlighted' },
      { content: '"ssn": "123-45-6789",', indent: 2, key: 'ssn', valueType: 'string', type: 'highlighted' },
      { content: '"date_of_birth": "1985-03-15"', indent: 2, key: 'date_of_birth', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1 },
      { content: '"billing_address": {', indent: 1, key: 'billing_address' },
      { content: '"street": "123 Main St",', indent: 2, key: 'street', valueType: 'string', type: 'highlighted' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"state": "CA",', indent: 2, key: 'state', valueType: 'string' },
      { content: '"zip": "94102",', indent: 2, key: 'zip', valueType: 'string', type: 'highlighted' },
      { content: '"country": "US"', indent: 2, key: 'country', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Step 2: Encrypt Credit Card Data",
    description: "Credit card numbers and CVV encrypted with AES-256-GCM while preserving last 4 digits and card brand for analytics and customer service.",
    yamlFilename: "step-1-encrypt-card.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        root.payment.card_number_encrypted = this.payment.card_number.encrypt_aes_gcm(env("CARD_KEY"))
        root.payment.cvv_encrypted = this.payment.cvv.encrypt_aes_gcm(env("CARD_KEY"))
        root.payment.cardholder_name_encrypted = this.payment.cardholder_name.encrypt_aes_gcm(env("CARD_KEY"))
        root.payment.card_last_four = this.payment.card_number.re_replace_all("[^0-9]", "").slice(-4)
        root.payment.card_brand = match {
          this.payment.card_number.has_prefix("4") => "visa",
          this.payment.card_number.has_prefix("5") => "mastercard",
          _ => "unknown"
        }
        root.payment = root.payment.without("card_number", "cvv", "cardholder_name")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"payment": {', indent: 1, key: 'payment' },
      { content: '"card_number": "4532-1234-5678-9010",', indent: 2, key: 'card_number', valueType: 'string', type: 'highlighted' },
      { content: '"cvv": "123",', indent: 2, key: 'cvv', valueType: 'string', type: 'highlighted' },
      { content: '"expiration": "12/27",', indent: 2, key: 'expiration', valueType: 'string' },
      { content: '"cardholder_name": "Sarah Johnson"', indent: 2, key: 'cardholder_name', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"payment": {', indent: 1, key: 'payment' },
      { content: '"card_number_encrypted": "AES256:YWJjZGVm...8f3e2a1b",', indent: 2, key: 'card_number_encrypted', valueType: 'string', type: 'added' },
      { content: '"cvv_encrypted": "AES256:cGFzc3dv...1a2b3c4d",', indent: 2, key: 'cvv_encrypted', valueType: 'string', type: 'added' },
      { content: '"cardholder_name_encrypted": "AES256:bmFtZXN0...9f8e7d6c",', indent: 2, key: 'cardholder_name_encrypted', valueType: 'string', type: 'added' },
      { content: '"card_last_four": "9010",', indent: 2, key: 'card_last_four', valueType: 'string', type: 'added' },
      { content: '"card_brand": "visa",', indent: 2, key: 'card_brand', valueType: 'string', type: 'added' },
      { content: '"expiration": "12/27"', indent: 2, key: 'expiration', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Step 3: Encrypt PII Customer Data",
    description: "SSN, email, and phone numbers encrypted while preserving last 4 digits, domain, and area code for analytics and customer service workflows.",
    yamlFilename: "step-2-encrypt-pii.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        root.customer.ssn_encrypted = this.customer.ssn.encrypt_aes_gcm(env("PII_KEY"))
        root.customer.email_encrypted = this.customer.email.encrypt_aes_gcm(env("PII_KEY"))
        root.customer.phone_encrypted = this.customer.phone.encrypt_aes_gcm(env("PII_KEY"))
        root.customer.dob_encrypted = this.customer.date_of_birth.encrypt_aes_gcm(env("PII_KEY"))
        root.customer.ssn_last_four = this.customer.ssn.re_replace_all("[^0-9]", "").slice(-4)
        root.customer.email_domain = this.customer.email.split("@")[1]
        root.customer.phone_area_code = this.customer.phone.re_find("\\\\+1-(\\\\d{3})-")[1]
        root.customer = root.customer.without("ssn", "email", "phone", "date_of_birth")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"customer": {', indent: 1, key: 'customer' },
      { content: '"email": "sarah.johnson@example.com",', indent: 2, key: 'email', valueType: 'string', type: 'highlighted' },
      { content: '"phone": "+1-415-555-0123",', indent: 2, key: 'phone', valueType: 'string', type: 'highlighted' },
      { content: '"ssn": "123-45-6789",', indent: 2, key: 'ssn', valueType: 'string', type: 'highlighted' },
      { content: '"date_of_birth": "1985-03-15"', indent: 2, key: 'date_of_birth', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"customer": {', indent: 1, key: 'customer' },
      { content: '"ssn_encrypted": "AES256:c3NuZGF0...7e6d5c4b",', indent: 2, key: 'ssn_encrypted', valueType: 'string', type: 'added' },
      { content: '"email_encrypted": "AES256:ZW1haWxk...6d5c4b3a",', indent: 2, key: 'email_encrypted', valueType: 'string', type: 'added' },
      { content: '"phone_encrypted": "AES256:cGhvbmVk...5c4b3a2g",', indent: 2, key: 'phone_encrypted', valueType: 'string', type: 'added' },
      { content: '"dob_encrypted": "AES256:ZG9iZGF0...4b3a2g1h",', indent: 2, key: 'dob_encrypted', valueType: 'string', type: 'added' },
      { content: '"ssn_last_four": "6789",', indent: 2, key: 'ssn_last_four', valueType: 'string', type: 'added' },
      { content: '"email_domain": "example.com",', indent: 2, key: 'email_domain', valueType: 'string', type: 'added' },
      { content: '"phone_area_code": "415"', indent: 2, key: 'phone_area_code', valueType: 'string', type: 'added' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: "Step 4: Encrypt Address Data",
    description: "Street addresses and zip codes encrypted while preserving city, state, and country for geographic analytics and compliance reporting.",
    yamlFilename: "step-3-encrypt-address.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        root.billing_address.street_encrypted = this.billing_address.street.encrypt_aes_gcm(env("ADDR_KEY"))
        root.billing_address.zip_encrypted = this.billing_address.zip.encrypt_aes_gcm(env("ADDR_KEY"))
        root.billing_address = root.billing_address.without("street", "zip")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"billing_address": {', indent: 1, key: 'billing_address' },
      { content: '"street": "123 Main St",', indent: 2, key: 'street', valueType: 'string', type: 'highlighted' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"state": "CA",', indent: 2, key: 'state', valueType: 'string' },
      { content: '"zip": "94102",', indent: 2, key: 'zip', valueType: 'string', type: 'highlighted' },
      { content: '"country": "US"', indent: 2, key: 'country', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"billing_address": {', indent: 1, key: 'billing_address' },
      { content: '"street_encrypted": "AES256:c3RyZWV0...3a2g1h0f",', indent: 2, key: 'street_encrypted', valueType: 'string', type: 'added' },
      { content: '"zip_encrypted": "AES256:emlwZGF0...2g1h0f9e",', indent: 2, key: 'zip_encrypted', valueType: 'string', type: 'added' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"state": "CA",', indent: 2, key: 'state', valueType: 'string' },
      { content: '"country": "US"', indent: 2, key: 'country', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 5,
    title: "Step 5: Add Encryption Metadata",
    description: "Comprehensive metadata tracking encryption operations for audit trails, key rotation, and compliance monitoring.",
    yamlFilename: "step-4-add-metadata.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        root.encryption_metadata = {
          "encrypted": true,
          "encryption_timestamp": now(),
          "encryption_version": "1.0",
          "key_version": env("KEY_VERSION").or("v1"),
          "algorithm": "AES-256-GCM",
          "node_id": env("NODE_ID").or("edge-001"),
          "pipeline": "payment-field-encryption"
        }`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '// Encrypted transaction data from previous steps', indent: 1, type: 'comment' },
      { content: '"payment": { ... },', indent: 1, key: 'payment' },
      { content: '"customer": { ... },', indent: 1, key: 'customer' },
      { content: '"billing_address": { ... }', indent: 1, key: 'billing_address' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"payment": { ... },', indent: 1, key: 'payment' },
      { content: '"customer": { ... },', indent: 1, key: 'customer' },
      { content: '"billing_address": { ... },', indent: 1, key: 'billing_address' },
      { content: '"encryption_metadata": {', indent: 1, key: 'encryption_metadata', type: 'added' },
      { content: '"encrypted": true,', indent: 2, key: 'encrypted', valueType: 'boolean', type: 'added' },
      { content: '"encryption_timestamp": "2025-10-20T14:30:01Z",', indent: 2, key: 'encryption_timestamp', valueType: 'string', type: 'added' },
      { content: '"encryption_version": "1.0",', indent: 2, key: 'encryption_version', valueType: 'string', type: 'added' },
      { content: '"key_version": "v1",', indent: 2, key: 'key_version', valueType: 'string', type: 'added' },
      { content: '"algorithm": "AES-256-GCM",', indent: 2, key: 'algorithm', valueType: 'string', type: 'added' },
      { content: '"node_id": "edge-001",', indent: 2, key: 'node_id', valueType: 'string', type: 'added' },
      { content: '"pipeline": "payment-field-encryption"', indent: 2, key: 'pipeline', valueType: 'string', type: 'added' },
      { content: '}', indent: 1, type: 'added' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 6,
    title: "Step 6: Complete Encrypted Transaction",
    description: "Final encrypted transaction ready for secure transmission and storage. All sensitive data protected while preserving analytics utility.",
    yamlFilename: "output.json",
    yamlCode: `# Complete encrypted transaction
output:
  kafka:
    addresses: ["kafka:9092"]
    topic: encrypted-payments`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '// Original plaintext transaction', indent: 1, type: 'comment' },
      { content: '"transaction_id": "txn_20251020_001",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"payment": { card_number, cvv, ... },', indent: 1, key: 'payment', type: 'highlighted' },
      { content: '"customer": { ssn, email, phone, ... },', indent: 1, key: 'customer', type: 'highlighted' },
      { content: '"billing_address": { street, zip, ... }', indent: 1, key: 'billing_address', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"transaction_id": "txn_20251020_001",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"timestamp": "2025-10-20T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"merchant_id": "merchant_789",', indent: 1, key: 'merchant_id', valueType: 'string' },
      { content: '"amount": 127.50,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"currency": "USD",', indent: 1, key: 'currency', valueType: 'string' },
      { content: '"payment": {', indent: 1, key: 'payment' },
      { content: '"card_number_encrypted": "AES256:YWJj...8f3e",', indent: 2, key: 'card_number_encrypted', valueType: 'string', type: 'added' },
      { content: '"cvv_encrypted": "AES256:cGFz...1a2b",', indent: 2, key: 'cvv_encrypted', valueType: 'string', type: 'added' },
      { content: '"cardholder_name_encrypted": "AES256:bmFt...9f8e",', indent: 2, key: 'cardholder_name_encrypted', valueType: 'string', type: 'added' },
      { content: '"card_last_four": "9010",', indent: 2, key: 'card_last_four', valueType: 'string', type: 'added' },
      { content: '"card_brand": "visa",', indent: 2, key: 'card_brand', valueType: 'string', type: 'added' },
      { content: '"expiration": "12/27"', indent: 2, key: 'expiration', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"customer": {', indent: 1, key: 'customer' },
      { content: '"ssn_encrypted": "AES256:c3Nu...7e6d",', indent: 2, key: 'ssn_encrypted', valueType: 'string', type: 'added' },
      { content: '"email_encrypted": "AES256:ZW1h...6d5c",', indent: 2, key: 'email_encrypted', valueType: 'string', type: 'added' },
      { content: '"phone_encrypted": "AES256:cGhv...5c4b",', indent: 2, key: 'phone_encrypted', valueType: 'string', type: 'added' },
      { content: '"dob_encrypted": "AES256:ZG9i...4b3a",', indent: 2, key: 'dob_encrypted', valueType: 'string', type: 'added' },
      { content: '"ssn_last_four": "6789",', indent: 2, key: 'ssn_last_four', valueType: 'string', type: 'added' },
      { content: '"email_domain": "example.com",', indent: 2, key: 'email_domain', valueType: 'string', type: 'added' },
      { content: '"phone_area_code": "415"', indent: 2, key: 'phone_area_code', valueType: 'string', type: 'added' },
      { content: '},', indent: 1 },
      { content: '"billing_address": {', indent: 1, key: 'billing_address' },
      { content: '"street_encrypted": "AES256:c3Ry...3a2g",', indent: 2, key: 'street_encrypted', valueType: 'string', type: 'added' },
      { content: '"zip_encrypted": "AES256:emlw...2g1h",', indent: 2, key: 'zip_encrypted', valueType: 'string', type: 'added' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"state": "CA",', indent: 2, key: 'state', valueType: 'string' },
      { content: '"country": "US"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"encryption_metadata": {', indent: 1, key: 'encryption_metadata', type: 'added' },
      { content: '"encrypted": true,', indent: 2, key: 'encrypted', valueType: 'boolean', type: 'added' },
      { content: '"algorithm": "AES-256-GCM",', indent: 2, key: 'algorithm', valueType: 'string', type: 'added' },
      { content: '"key_version": "v1"', indent: 2, key: 'key_version', valueType: 'string', type: 'added' },
      { content: '}', indent: 1, type: 'added' },
      { content: '}', indent: 0 },
    ],
  }
];
