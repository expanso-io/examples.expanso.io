import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const encryptionPatternsStages: Stage[] = [
  {
    id: 1,
    title: "Original Sensitive Data",
    description: "Raw payment and customer data with multiple compliance violations requiring immediate field-level encryption.",
    yamlFilename: 'input.json',
    yamlCode: `# Stage 1: Original Data Input
# No encryption applied yet - all sensitive data visible

input:
  http_server:
    address: "0.0.0.0:8080"
    path: "/encrypt"

pipeline:
  processors:
    # Passthrough - no encryption yet
    - mapping: |
        root = this

output:
  stdout: {}`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"transaction_id": "txn-12345",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"payment": {', indent: 1 },
      { content: '"card_number": "4532-1234-5678-9010",', indent: 2, key: 'card_number', valueType: 'string', type: 'removed' },
      { content: '"cvv": "123",', indent: 2, key: 'cvv', valueType: 'string', type: 'removed' },
      { content: '"cardholder_name": "Sarah Johnson"', indent: 2, key: 'cardholder_name', valueType: 'string', type: 'removed' },
      { content: '},', indent: 1 },
      { content: '"customer": {', indent: 1 },
      { content: '"email": "sarah.johnson@example.com",', indent: 2, key: 'email', valueType: 'string', type: 'removed' },
      { content: '"ssn": "123-45-6789"', indent: 2, key: 'ssn', valueType: 'string', type: 'removed' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"transaction_id": "txn-12345",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"payment": {', indent: 1 },
      { content: '"card_number": "4532-1234-5678-9010",', indent: 2, key: 'card_number', valueType: 'string', type: 'removed' },
      { content: '"cvv": "123",', indent: 2, key: 'cvv', valueType: 'string', type: 'removed' },
      { content: '"cardholder_name": "Sarah Johnson"', indent: 2, key: 'cardholder_name', valueType: 'string', type: 'removed' },
      { content: '},', indent: 1 },
      { content: '"customer": {', indent: 1 },
      { content: '"email": "sarah.johnson@example.com",', indent: 2, key: 'email', valueType: 'string', type: 'removed' },
      { content: '"ssn": "123-45-6789"', indent: 2, key: 'ssn', valueType: 'string', type: 'removed' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Payment Card Encryption (PCI-DSS)",
    description: "Encrypt credit card data with AES-256-GCM while preserving last 4 digits and card brand for customer service and fraud detection.",
    yamlFilename: 'step-1-payment-encryption.yaml',
    yamlCode: `# Stage 2: Payment Card Encryption (PCI-DSS Compliance)

pipeline:
  processors:
    # Extract card brand before encryption
    - mapping: |
        root = this

        let card_num = this.payment.card_number.re_replace_all("[^0-9]", "")
        root.payment.card_brand = match {
          card_num.re_match("^4[0-9]{12,18}$") => "visa"
          card_num.re_match("^5[1-5][0-9]{14}$") => "mastercard"
          _ => "unknown"
        }

        # Extract last 4 and BIN for customer service
        root.payment.card_last_four = card_num.slice(-4)
        root.payment.card_bin = card_num.slice(0, 6)

        # Encrypt sensitive payment fields
        root.payment.card_number_encrypted = this.payment.card_number.encrypt_aes("gcm", env("PAYMENT_ENCRYPTION_KEY"))
        root.payment.cvv_encrypted = this.payment.cvv.encrypt_aes("gcm", env("PAYMENT_ENCRYPTION_KEY"))
        root.payment.cardholder_name_encrypted = this.payment.cardholder_name.encrypt_aes("gcm", env("PAYMENT_ENCRYPTION_KEY"))

        # Remove plaintext payment fields
        root.payment = this.payment.without("card_number", "cvv", "cardholder_name")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"transaction_id": "txn-12345",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"payment": {', indent: 1 },
      { content: '"card_number": "4532-1234-5678-9010",', indent: 2, key: 'card_number', valueType: 'string', type: 'removed' },
      { content: '"cvv": "123",', indent: 2, key: 'cvv', valueType: 'string', type: 'removed' },
      { content: '"cardholder_name": "Sarah Johnson"', indent: 2, key: 'cardholder_name', valueType: 'string', type: 'removed' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"transaction_id": "txn-12345",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"payment": {', indent: 1, type: 'highlighted' },
      { content: '"card_number_encrypted": "AES256GCM:v1:Y2FyZGRhdGE=...",', indent: 2, key: 'card_number_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"cvv_encrypted": "AES256GCM:v1:Y3Z2ZGF0YQ==...",', indent: 2, key: 'cvv_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"cardholder_name_encrypted": "AES256GCM:v1:bmFtZWRhdGE=...",', indent: 2, key: 'cardholder_name_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"card_brand": "visa",', indent: 2, key: 'card_brand', valueType: 'string', type: 'highlighted' },
      { content: '"card_last_four": "9010",', indent: 2, key: 'card_last_four', valueType: 'string', type: 'highlighted' },
      { content: '"card_bin": "453212"', indent: 2, key: 'card_bin', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Personal Data Encryption (GDPR/CCPA)",
    description: "Encrypt personal identifiers including email, phone, SSN, and names while preserving domain, area code, and last-4 for analytics.",
    yamlFilename: 'step-2-pii-encryption.yaml',
    yamlCode: `# Stage 3: Personal Data Encryption (GDPR/CCPA Compliance)

pipeline:
  processors:
    # Email encryption with domain preservation
    - mapping: |
        root = this

        # Extract email domain for B2B analytics
        root.customer.email_domain = this.customer.email.split("@").index(1)
        root.customer.email_domain_type = match {
          root.customer.email_domain.re_match("(gmail|yahoo|hotmail).*") => "consumer"
          _ => "business"
        }

        # Phone encryption with area code preservation
        let phone_clean = this.customer.phone.re_replace_all("[^0-9+]", "")
        root.customer.phone_country_code = if phone_clean.has_prefix("+1") { "+1" } else { "international" }
        root.customer.phone_area_code = if phone_clean.length() == 12 { phone_clean.slice(2, 5) }

        # SSN encryption with last 4 preservation
        let ssn_clean = this.customer.ssn.re_replace_all("[^0-9]", "")
        root.customer.ssn_last_four = ssn_clean.slice(-4)

        # Encrypt all PII fields
        root.customer.email_encrypted = this.customer.email.encrypt_aes("gcm", env("PII_ENCRYPTION_KEY"))
        root.customer.phone_encrypted = this.customer.phone.encrypt_aes("gcm", env("PII_ENCRYPTION_KEY"))
        root.customer.ssn_encrypted = this.customer.ssn.encrypt_aes("gcm", env("PII_ENCRYPTION_KEY"))
        root.customer.first_name_encrypted = this.customer.first_name.encrypt_aes("gcm", env("PII_ENCRYPTION_KEY"))
        root.customer.last_name_encrypted = this.customer.last_name.encrypt_aes("gcm", env("PII_ENCRYPTION_KEY"))

        # Remove plaintext PII
        root.customer = this.customer.without("email", "phone", "ssn", "first_name", "last_name")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"customer": {', indent: 1 },
      { content: '"first_name": "Sarah",', indent: 2, key: 'first_name', valueType: 'string', type: 'removed' },
      { content: '"last_name": "Johnson",', indent: 2, key: 'last_name', valueType: 'string', type: 'removed' },
      { content: '"email": "sarah.johnson@example.com",', indent: 2, key: 'email', valueType: 'string', type: 'removed' },
      { content: '"phone": "+1-415-555-0123",', indent: 2, key: 'phone', valueType: 'string', type: 'removed' },
      { content: '"ssn": "123-45-6789"', indent: 2, key: 'ssn', valueType: 'string', type: 'removed' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"customer": {', indent: 1, type: 'highlighted' },
      { content: '"first_name_encrypted": "AES256GCM:v1:Zmlyc3ROYW1l...",', indent: 2, key: 'first_name_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"last_name_encrypted": "AES256GCM:v1:bGFzdE5hbWU=...",', indent: 2, key: 'last_name_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"email_encrypted": "AES256GCM:v1:ZW1haWxkYXRh...",', indent: 2, key: 'email_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"email_domain": "example.com",', indent: 2, key: 'email_domain', valueType: 'string', type: 'highlighted' },
      { content: '"phone_encrypted": "AES256GCM:v1:cGhvbmVkYXRh...",', indent: 2, key: 'phone_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"phone_area_code": "415",', indent: 2, key: 'phone_area_code', valueType: 'string', type: 'highlighted' },
      { content: '"ssn_encrypted": "AES256GCM:v1:c3NuZGF0YQ==...",', indent: 2, key: 'ssn_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"ssn_last_four": "6789"', indent: 2, key: 'ssn_last_four', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: "Address Data Encryption (Location Privacy)",
    description: "Encrypt street addresses and detailed ZIP codes while preserving city, state, and ZIP prefix for demographic analytics.",
    yamlFilename: 'step-3-address-encryption.yaml',
    yamlCode: `# Stage 4: Address Data Encryption (Location Privacy)

pipeline:
  processors:
    # Address encryption with demographic preservation
    - mapping: |
        root = this

        # Extract ZIP prefixes for demographic clustering
        root.billing_address.zip_prefix = this.billing_address.zip.re_replace_all("[^0-9]", "").slice(0, 3)
        root.shipping_address.zip_prefix = this.shipping_address.zip.re_replace_all("[^0-9]", "").slice(0, 3)

        # Determine metro areas for regional analytics
        root.billing_address.metro_area = match {
          this.billing_address.city.lowercase().re_match(".*(san francisco|sf).*") => "sf_bay_area"
          this.billing_address.city.lowercase().re_match(".*(los angeles|la).*") => "la_metro"
          _ => "other_urban"
        }

        # Encrypt precise location data
        root.billing_address.street_encrypted = this.billing_address.street.encrypt_aes("gcm", env("ADDRESS_ENCRYPTION_KEY"))
        root.billing_address.zip_encrypted = this.billing_address.zip.encrypt_aes("gcm", env("ADDRESS_ENCRYPTION_KEY"))
        root.shipping_address.street_encrypted = this.shipping_address.street.encrypt_aes("gcm", env("ADDRESS_ENCRYPTION_KEY"))
        root.shipping_address.zip_encrypted = this.shipping_address.zip.encrypt_aes("gcm", env("ADDRESS_ENCRYPTION_KEY"))

        # Address relationship analysis
        root.address_analysis = {
          "same_city": this.billing_address.city == this.shipping_address.city,
          "same_state": this.billing_address.state == this.shipping_address.state,
          "same_metro": root.billing_address.metro_area == this.shipping_address.metro_area
        }

        # Remove plaintext addresses
        root.billing_address = this.billing_address.without("street", "zip")
        root.shipping_address = this.shipping_address.without("street", "zip")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"billing_address": {', indent: 1 },
      { content: '"street": "123 Main St, Apt 4B",', indent: 2, key: 'street', valueType: 'string', type: 'removed' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"state": "CA",', indent: 2, key: 'state', valueType: 'string' },
      { content: '"zip": "94102-1234"', indent: 2, key: 'zip', valueType: 'string', type: 'removed' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"billing_address": {', indent: 1, type: 'highlighted' },
      { content: '"street_encrypted": "AES256GCM:v1:c3RyZWV0ZGF0YQ==...",', indent: 2, key: 'street_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"zip_encrypted": "AES256GCM:v1:emlwZGF0YWhlcmU=...",', indent: 2, key: 'zip_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string', type: 'highlighted' },
      { content: '"state": "CA",', indent: 2, key: 'state', valueType: 'string', type: 'highlighted' },
      { content: '"zip_prefix": "941",', indent: 2, key: 'zip_prefix', valueType: 'string', type: 'highlighted' },
      { content: '"metro_area": "sf_bay_area"', indent: 2, key: 'metro_area', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1, type: 'highlighted' },
      { content: '"address_analysis": {', indent: 1, type: 'highlighted' },
      { content: '"same_city": false,', indent: 2, key: 'same_city', valueType: 'boolean', type: 'highlighted' },
      { content: '"same_state": true,', indent: 2, key: 'same_state', valueType: 'boolean', type: 'highlighted' },
      { content: '"same_metro": true', indent: 2, key: 'same_metro', valueType: 'boolean', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 5,
    title: "Temporal Data Encryption (HIPAA)",
    description: "Encrypt birth dates and sensitive timestamps while preserving age cohorts, seasons, and generational analytics for HIPAA compliance.",
    yamlFilename: 'step-4-temporal-encryption.yaml',
    yamlCode: `# Stage 5: Temporal Data Encryption (HIPAA Compliance)

pipeline:
  processors:
    # Birth date encryption with age analytics preservation
    - mapping: |
        root = this

        # Parse birth date for analytics extraction
        let birth_date = this.customer.date_of_birth.parse_timestamp("2006-01-02")

        # Extract temporal analytics before encryption
        root.customer.birth_year = birth_date.ts_format("2006").number()
        root.customer.current_age = now().ts_format("2006").number() - root.customer.birth_year

        # Generate age range for demographic analytics
        root.customer.age_range = match {
          root.customer.current_age < 18 => "under_18"
          root.customer.current_age < 25 => "18_to_24"
          root.customer.current_age < 35 => "25_to_34"
          root.customer.current_age < 45 => "35_to_44"
          root.customer.current_age < 55 => "45_to_54"
          root.customer.current_age < 65 => "55_to_64"
          _ => "65_plus"
        }

        # Generate generational cohort
        root.customer.birth_decade = match {
          root.customer.birth_year >= 1980 && root.customer.birth_year < 1990 => "1980s"
          root.customer.birth_year >= 1990 && root.customer.birth_year < 2000 => "1990s"
          root.customer.birth_year >= 2000 => "2000s"
          _ => "pre_1980"
        }

        # Extract birth season
        let month = birth_date.ts_format("01").number()
        root.customer.birth_season = match {
          month >= 3 && month <= 5 => "spring"
          month >= 6 && month <= 8 => "summer"
          month >= 9 && month <= 11 => "autumn"
          _ => "winter"
        }

        # Encrypt exact birth date (HIPAA requirement)
        root.customer.date_of_birth_encrypted = this.customer.date_of_birth.encrypt_aes("gcm", env("TEMPORAL_ENCRYPTION_KEY"))

        # Remove plaintext birth date
        root.customer.date_of_birth = deleted()`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"customer": {', indent: 1 },
      { content: '"date_of_birth": "1985-03-15"', indent: 2, key: 'date_of_birth', valueType: 'string', type: 'removed' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"customer": {', indent: 1, type: 'highlighted' },
      { content: '"date_of_birth_encrypted": "AES256GCM:v1:ZGF0ZW9mYmlydGg=...",', indent: 2, key: 'date_of_birth_encrypted', valueType: 'string', type: 'highlighted' },
      { content: '"birth_year": 1985,', indent: 2, key: 'birth_year', valueType: 'number', type: 'highlighted' },
      { content: '"current_age": 40,', indent: 2, key: 'current_age', valueType: 'number', type: 'highlighted' },
      { content: '"age_range": "35_to_44",', indent: 2, key: 'age_range', valueType: 'string', type: 'highlighted' },
      { content: '"birth_decade": "1980s",', indent: 2, key: 'birth_decade', valueType: 'string', type: 'highlighted' },
      { content: '"birth_season": "spring"', indent: 2, key: 'birth_season', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 6,
    title: "Multi-Key Security & Production Operations",
    description: "Complete multi-tier encryption architecture with risk-based key management, automated rotation, comprehensive audit trails, and compliance monitoring.",
    yamlFilename: 'step-5-production.yaml',
    yamlCode: `# Stage 6: Multi-Key Security & Production Operations

pipeline:
  processors:
    # Multi-tier key architecture
    - mapping: |
        root = this

        # Multi-key security metadata
        root.multi_key_metadata = {
          "encryption_architecture": "multi_tier_risk_based",
          "key_tiers_used": {
            "payment_critical": {
              "rotation_schedule_days": 90,
              "compliance_standards": ["PCI-DSS"],
              "access_control": "payment_processor_only"
            },
            "pii_high": {
              "rotation_schedule_days": 180,
              "compliance_standards": ["GDPR", "CCPA"],
              "access_control": "customer_service_analytics"
            },
            "location_medium": {
              "rotation_schedule_days": 365,
              "compliance_standards": ["location_privacy"]
            },
            "temporal_medium": {
              "rotation_schedule_days": 365,
              "compliance_standards": ["HIPAA"]
            }
          }
        }

        # Production operations metrics
        root.operational_metrics = {
          "pipeline_health": "optimal",
          "encryption_latency_ms": 45,
          "throughput_estimate": "2000+ records/second",
          "security_score": 98,
          "compliance_status": "fully_compliant"
        }

        # Comprehensive audit trail
        meta audit_trail = {
          "audit_id": "enc_" + uuid_v4(),
          "timestamp": now(),
          "encryption_operations": [
            {"field": "payment.card_number", "algorithm": "AES-256-GCM", "compliance": "PCI-DSS"},
            {"field": "customer.email", "algorithm": "AES-256-GCM", "compliance": "GDPR"},
            {"field": "customer.date_of_birth", "algorithm": "AES-256-GCM", "compliance": "HIPAA"},
            {"field": "billing_address.street", "algorithm": "AES-256-GCM", "compliance": "location_privacy"}
          ],
          "total_fields_encrypted": 11,
          "encryption_coverage_percentage": 100
        }

# Production outputs with audit trails
outputs:
  - label: encrypted_data
    file:
      path: "./encrypted-data-\${!timestamp_unix()}.jsonl"
  - label: audit_trail
    processors:
      - mapping: root = meta("audit_trail")
    file:
      path: "./audit-trail-\${!timestamp_unix()}.jsonl"`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"transaction_id": "txn-12345",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"payment": {', indent: 1 },
      { content: '"card_number_encrypted": "AES256GCM:v1:...",', indent: 2, key: 'card_number_encrypted', valueType: 'string' },
      { content: '"card_last_four": "9010"', indent: 2, key: 'card_last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"customer": {', indent: 1 },
      { content: '"email_encrypted": "AES256GCM:v1:..."', indent: 2, key: 'email_encrypted', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"transaction_id": "txn-12345",', indent: 1, key: 'transaction_id', valueType: 'string' },
      { content: '"payment": {', indent: 1 },
      { content: '"card_number_encrypted": "AES256GCM:v1:...",', indent: 2, key: 'card_number_encrypted', valueType: 'string' },
      { content: '"card_last_four": "9010"', indent: 2, key: 'card_last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"customer": {', indent: 1 },
      { content: '"email_encrypted": "AES256GCM:v1:..."', indent: 2, key: 'email_encrypted', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"multi_key_metadata": {', indent: 1, type: 'highlighted' },
      { content: '"encryption_architecture": "multi_tier_risk_based",', indent: 2, key: 'encryption_architecture', valueType: 'string', type: 'highlighted' },
      { content: '"key_tiers_used": { ... }', indent: 2, key: 'key_tiers_used', valueType: 'object', type: 'highlighted' },
      { content: '},', indent: 1, type: 'highlighted' },
      { content: '"operational_metrics": {', indent: 1, type: 'highlighted' },
      { content: '"security_score": 98,', indent: 2, key: 'security_score', valueType: 'number', type: 'highlighted' },
      { content: '"compliance_status": "fully_compliant"', indent: 2, key: 'compliance_status', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  }
];
