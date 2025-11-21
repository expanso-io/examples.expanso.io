import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const encryptDataStages: Stage[] = [
  {
    stage: 1,
    title: "Original Payment Data",
    description: "Raw payment transaction with sensitive fields exposed in plaintext. Credit card numbers, CVV codes, SSNs, and PII are visible to anyone with database access.",
    input: `{
  "transaction_id": "txn_20251020_001",
  "timestamp": "2025-10-20T14:30:00Z",
  "merchant_id": "merchant_789",
  "amount": 127.50,
  "currency": "USD",
  "payment": {
    "card_number": "4532-1234-5678-9010",
    "cvv": "123", 
    "expiration": "12/27",
    "cardholder_name": "Sarah Johnson"
  },
  "customer": {
    "email": "sarah.johnson@example.com",
    "phone": "+1-415-555-0123",
    "ssn": "123-45-6789",
    "date_of_birth": "1985-03-15"
  },
  "billing_address": {
    "street": "123 Main St",
    "city": "San Francisco", 
    "state": "CA",
    "zip": "94102",
    "country": "US"
  }
}`,
    output: `{
  "transaction_id": "txn_20251020_001",
  "timestamp": "2025-10-20T14:30:00Z", 
  "merchant_id": "merchant_789",
  "amount": 127.50,
  "currency": "USD",
  "payment": {
    "card_number": "4532-1234-5678-9010",
    "cvv": "123",
    "expiration": "12/27", 
    "cardholder_name": "Sarah Johnson"
  },
  "customer": {
    "email": "sarah.johnson@example.com",
    "phone": "+1-415-555-0123",
    "ssn": "123-45-6789",
    "date_of_birth": "1985-03-15"
  },
  "billing_address": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA", 
    "zip": "94102",
    "country": "US"
  }
}`,
    processor: null
  },
  {
    stage: 2,
    title: "Encrypt Credit Card Data",
    description: "Credit card numbers and CVV encrypted with AES-256-GCM while preserving last 4 digits and card brand for analytics and customer service.",
    input: `{
  "payment": {
    "card_number": "4532-1234-5678-9010",
    "cvv": "123",
    "expiration": "12/27",
    "cardholder_name": "Sarah Johnson"
  }
}`,
    output: `{
  "payment": {
    "card_number_encrypted": "AES256GCM:v1:YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=:8f3e2a1b9c4d7e6f",
    "cvv_encrypted": "AES256GCM:v1:cGFzc3dvcmQxMjM0NTY3ODkwYWJjZGVmZ2hp:1a2b3c4d5e6f7g8h", 
    "cardholder_name_encrypted": "AES256GCM:v1:bmFtZXN0cmluZ2hlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:9f8e7d6c5b4a3g2h",
    "card_last_four": "9010",
    "card_brand": "visa",
    "expiration": "12/27"
  }
}`,
    processor: `mapping: |
  root.payment.card_number_encrypted = crypto.encrypt_aes256_gcm(this.payment.card_number, env("CARD_ENCRYPTION_KEY"))
  root.payment.cvv_encrypted = crypto.encrypt_aes256_gcm(this.payment.cvv, env("CARD_ENCRYPTION_KEY"))
  root.payment.cardholder_name_encrypted = crypto.encrypt_aes256_gcm(this.payment.cardholder_name, env("CARD_ENCRYPTION_KEY"))
  root.payment.card_last_four = this.payment.card_number.re_replace_all("[^0-9]", "").slice(-4)
  root.payment.card_brand = if this.payment.card_number.has_prefix("4") { "visa" } 
                            else if this.payment.card_number.has_prefix("5") { "mastercard" }
                            else { "unknown" }
  root.payment.expiration = this.payment.expiration`
  },
  {
    stage: 3,
    title: "Encrypt PII Customer Data", 
    description: "SSN, email, and phone numbers encrypted while preserving last 4 digits, domain, and area code for analytics and customer service workflows.",
    input: `{
  "customer": {
    "email": "sarah.johnson@example.com",
    "phone": "+1-415-555-0123", 
    "ssn": "123-45-6789",
    "date_of_birth": "1985-03-15"
  }
}`,
    output: `{
  "customer": {
    "ssn_encrypted": "AES256GCM:v1:c3NuZGF0YWhlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:7e6d5c4b3a2g1h0f",
    "email_encrypted": "AES256GCM:v1:ZW1haWxkYXRhaGVyZWZvcnRlc3Rpbmdwcm9wb3Nlcw==:6d5c4b3a2g1h0f9e",
    "phone_encrypted": "AES256GCM:v1:cGhvbmVkYXRhaGVyZWZvcnRlc3Rpbmdwcm9wb3Nlcw==:5c4b3a2g1h0f9e8d",
    "date_of_birth_encrypted": "AES256GCM:v1:ZG9iZGF0YWhlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:4b3a2g1h0f9e8d7c",
    "ssn_last_four": "6789",
    "email_domain": "example.com", 
    "phone_area_code": "415",
    "birth_year": 1985
  }
}`,
    processor: `mapping: |
  root.customer.ssn_encrypted = crypto.encrypt_aes256_gcm(this.customer.ssn, env("PII_ENCRYPTION_KEY"))
  root.customer.email_encrypted = crypto.encrypt_aes256_gcm(this.customer.email, env("PII_ENCRYPTION_KEY"))
  root.customer.phone_encrypted = crypto.encrypt_aes256_gcm(this.customer.phone, env("PII_ENCRYPTION_KEY"))
  root.customer.date_of_birth_encrypted = crypto.encrypt_aes256_gcm(this.customer.date_of_birth, env("PII_ENCRYPTION_KEY"))
  root.customer.ssn_last_four = this.customer.ssn.re_replace_all("[^0-9]", "").slice(-4)
  root.customer.email_domain = this.customer.email.split("@")[1]
  root.customer.phone_area_code = this.customer.phone.re_find("\\+1-([0-9]{3})-.*")[0][1]
  root.customer.birth_year = this.customer.date_of_birth.parse_timestamp("2006-01-02").format_timestamp("2006")`
  },
  {
    stage: 4,
    title: "Encrypt Address Data",
    description: "Street addresses and zip codes encrypted while preserving city, state, and country for geographic analytics and compliance reporting.",
    input: `{
  "billing_address": {
    "street": "123 Main St",
    "city": "San Francisco",
    "state": "CA", 
    "zip": "94102",
    "country": "US"
  }
}`,
    output: `{
  "billing_address": {
    "street_encrypted": "AES256GCM:v1:c3RyZWV0ZGF0YWhlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:3a2g1h0f9e8d7c6b",
    "zip_encrypted": "AES256GCM:v1:emlwZGF0YWhlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:2g1h0f9e8d7c6b5a",
    "city": "San Francisco",
    "state": "CA",
    "country": "US"
  }
}`,
    processor: `mapping: |
  root.billing_address.street_encrypted = crypto.encrypt_aes256_gcm(this.billing_address.street, env("ADDRESS_ENCRYPTION_KEY"))
  root.billing_address.zip_encrypted = crypto.encrypt_aes256_gcm(this.billing_address.zip, env("ADDRESS_ENCRYPTION_KEY"))
  root.billing_address.city = this.billing_address.city
  root.billing_address.state = this.billing_address.state
  root.billing_address.country = this.billing_address.country`
  },
  {
    stage: 5,
    title: "Add Encryption Metadata",
    description: "Comprehensive metadata tracking encryption operations for audit trails, key rotation, and compliance monitoring.",
    input: `{
  // Encrypted transaction data
}`,
    output: `{
  // Previous encrypted data plus:
  "encryption_metadata": {
    "encrypted": true,
    "encryption_timestamp": "2025-10-20T14:30:01.234Z",
    "encryption_version": "1.0", 
    "key_version": "v1_20251020",
    "algorithm": "AES-256-GCM",
    "node_id": "edge-payment-001",
    "pipeline": "payment-field-encryption",
    "encrypted_fields": [
      "payment.card_number_encrypted",
      "payment.cvv_encrypted", 
      "payment.cardholder_name_encrypted",
      "customer.ssn_encrypted",
      "customer.email_encrypted",
      "customer.phone_encrypted",
      "customer.date_of_birth_encrypted",
      "billing_address.street_encrypted",
      "billing_address.zip_encrypted"
    ],
    "plaintext_fields": [
      "transaction_id", "timestamp", "merchant_id", "amount",
      "payment.card_last_four", "payment.card_brand",
      "customer.ssn_last_four", "customer.email_domain",
      "customer.phone_area_code", "customer.birth_year",
      "billing_address.city", "billing_address.state"
    ]
  }
}`,
    processor: `mapping: |
  root.encryption_metadata = {
    "encrypted": true,
    "encryption_timestamp": now(),
    "encryption_version": "1.0", 
    "key_version": env("KEY_VERSION"),
    "algorithm": "AES-256-GCM",
    "node_id": env("NODE_ID"),
    "pipeline": "payment-field-encryption",
    "encrypted_fields": ["payment.card_number_encrypted", "payment.cvv_encrypted", "customer.ssn_encrypted"],
    "plaintext_fields": ["transaction_id", "timestamp", "amount"]
  }`
  },
  {
    stage: 6,
    title: "Complete Encrypted Transaction",
    description: "Final encrypted transaction ready for secure transmission and storage. All sensitive data protected while preserving analytics utility.",
    input: `{
  // Original plaintext transaction
}`,
    output: `{
  "transaction_id": "txn_20251020_001",
  "timestamp": "2025-10-20T14:30:00Z",
  "merchant_id": "merchant_789", 
  "amount": 127.50,
  "currency": "USD",
  "payment": {
    "card_number_encrypted": "AES256GCM:v1:YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY=:8f3e2a1b9c4d7e6f",
    "cvv_encrypted": "AES256GCM:v1:cGFzc3dvcmQxMjM0NTY3ODkwYWJjZGVmZ2hp:1a2b3c4d5e6f7g8h",
    "cardholder_name_encrypted": "AES256GCM:v1:bmFtZXN0cmluZ2hlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:9f8e7d6c5b4a3g2h",
    "card_last_four": "9010",
    "card_brand": "visa",
    "expiration": "12/27"
  },
  "customer": {
    "ssn_encrypted": "AES256GCM:v1:c3NuZGF0YWhlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:7e6d5c4b3a2g1h0f",
    "email_encrypted": "AES256GCM:v1:ZW1haWxkYXRhaGVyZWZvcnRlc3Rpbmdwcm9wb3Nlcw==:6d5c4b3a2g1h0f9e", 
    "phone_encrypted": "AES256GCM:v1:cGhvbmVkYXRhaGVyZWZvcnRlc3Rpbmdwcm9wb3Nlcw==:5c4b3a2g1h0f9e8d",
    "date_of_birth_encrypted": "AES256GCM:v1:ZG9iZGF0YWhlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:4b3a2g1h0f9e8d7c",
    "ssn_last_four": "6789",
    "email_domain": "example.com",
    "phone_area_code": "415", 
    "birth_year": 1985
  },
  "billing_address": {
    "street_encrypted": "AES256GCM:v1:c3RyZWV0ZGF0YWhlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:3a2g1h0f9e8d7c6b",
    "zip_encrypted": "AES256GCM:v1:emlwZGF0YWhlcmVmb3J0ZXN0aW5ncHVycG9zZXM=:2g1h0f9e8d7c6b5a",
    "city": "San Francisco",
    "state": "CA",
    "country": "US"
  },
  "encryption_metadata": {
    "encrypted": true,
    "encryption_timestamp": "2025-10-20T14:30:01.234Z",
    "encryption_version": "1.0",
    "key_version": "v1_20251020", 
    "algorithm": "AES-256-GCM",
    "node_id": "edge-payment-001",
    "pipeline": "payment-field-encryption"
  }
}`,
    processor: null
  }
];
