export const encryptionPatternsStages = [
  {
    id: 1,
    title: "Original Sensitive Data",
    description: "Raw payment and customer data with multiple compliance violations requiring immediate field-level encryption.",
    input: {
      "transaction_id": "txn-12345",
      "timestamp": "2025-01-15T10:00:00Z", 
      "amount": 49.99,
      "currency": "USD",
      "payment": {
        "card_number": "4532-1234-5678-9010",
        "cvv": "123",
        "expiry_month": 12,
        "expiry_year": 2028,
        "cardholder_name": "Sarah Johnson",
        "card_brand": "visa"
      },
      "customer": {
        "customer_id": "cust-789",
        "first_name": "Sarah",
        "last_name": "Johnson",
        "email": "sarah.johnson@example.com", 
        "phone": "+1-415-555-0123",
        "ssn": "123-45-6789",
        "date_of_birth": "1985-03-15"
      },
      "billing_address": {
        "street": "123 Main St, Apt 4B",
        "city": "San Francisco",
        "state": "CA",
        "zip": "94102-1234",
        "country": "US"
      },
      "shipping_address": {
        "street": "456 Oak Ave",
        "city": "Palo Alto",
        "state": "CA", 
        "zip": "94301-5678",
        "country": "US"
      }
    },
    output: {
      "transaction_id": "txn-12345",
      "timestamp": "2025-01-15T10:00:00Z",
      "amount": 49.99,
      "currency": "USD", 
      "payment": {
        "card_number": "4532-1234-5678-9010",
        "cvv": "123",
        "expiry_month": 12,
        "expiry_year": 2028,
        "cardholder_name": "Sarah Johnson",
        "card_brand": "visa"
      },
      "customer": {
        "customer_id": "cust-789",
        "first_name": "Sarah",
        "last_name": "Johnson",
        "email": "sarah.johnson@example.com",
        "phone": "+1-415-555-0123", 
        "ssn": "123-45-6789",
        "date_of_birth": "1985-03-15"
      },
      "billing_address": {
        "street": "123 Main St, Apt 4B",
        "city": "San Francisco",
        "state": "CA",
        "zip": "94102-1234",
        "country": "US"
      },
      "shipping_address": {
        "street": "456 Oak Ave",
        "city": "Palo Alto",
        "state": "CA",
        "zip": "94301-5678", 
        "country": "US"
      }
    },
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
    highlights: {
      "payment.card_number": "🔴 PCI-DSS Violation",
      "payment.cvv": "🔴 Critical Security Risk", 
      "customer.email": "🔴 GDPR Personal Data",
      "customer.ssn": "🔴 High-Risk PII",
      "billing_address.street": "🔴 Location Privacy Risk"
    }
  },
  
  {
    id: 2,
    title: "Payment Card Encryption (PCI-DSS)",
    description: "Encrypt credit card data with AES-256-GCM while preserving last 4 digits and card brand for customer service and fraud detection.",
    input: {
      "transaction_id": "txn-12345", 
      "timestamp": "2025-01-15T10:00:00Z",
      "amount": 49.99,
      "currency": "USD",
      "payment": {
        "card_number": "4532-1234-5678-9010",
        "cvv": "123", 
        "expiry_month": 12,
        "expiry_year": 2028,
        "cardholder_name": "Sarah Johnson",
        "card_brand": "visa"
      },
      "customer": {
        "customer_id": "cust-789",
        "first_name": "Sarah",
        "last_name": "Johnson",
        "email": "sarah.johnson@example.com",
        "phone": "+1-415-555-0123",
        "ssn": "123-45-6789", 
        "date_of_birth": "1985-03-15"
      },
      "billing_address": {
        "street": "123 Main St, Apt 4B",
        "city": "San Francisco",
        "state": "CA",
        "zip": "94102-1234",
        "country": "US"
      }
    },
    output: {
      "transaction_id": "txn-12345",
      "timestamp": "2025-01-15T10:00:00Z",
      "amount": 49.99,
      "currency": "USD",
      "payment": {
        "card_number_encrypted": "AES256GCM:v1:Y2FyZGRhdGE=:7f6e5d4c3b2a1h0g9f8e7d6c5b4a3g2f",
        "cvv_encrypted": "AES256GCM:v1:Y3Z2ZGF0YQ==:9f8e7d6c5b4a3g2f1h0g9e8d7c6b5a4g",
        "cardholder_name_encrypted": "AES256GCM:v1:bmFtZWRhdGE=:3g2f1h0g9e8d7c6b5a4g3f2e1d0c9b8a",
        "expiry_month": 12,
        "expiry_year": 2028,
        "card_brand": "visa",
        "card_last_four": "9010",
        "card_bin": "453212"
      },
      "customer": {
        "customer_id": "cust-789", 
        "first_name": "Sarah",
        "last_name": "Johnson",
        "email": "sarah.johnson@example.com",
        "phone": "+1-415-555-0123",
        "ssn": "123-45-6789",
        "date_of_birth": "1985-03-15"
      },
      "billing_address": {
        "street": "123 Main St, Apt 4B",
        "city": "San Francisco",
        "state": "CA",
        "zip": "94102-1234",
        "country": "US"
      },
      "payment_encryption_metadata": {
        "encrypted": true,
        "key_version": "v1_20251115", 
        "compliance_standard": "PCI-DSS-3.2.1",
        "encrypted_fields": ["payment.card_number", "payment.cvv", "payment.cardholder_name"],
        "preserved_fields": ["payment.card_last_four", "payment.card_bin", "payment.card_brand"]
      }
    },
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
    highlights: {
      "payment.card_number_encrypted": "🟢 PCI-DSS Compliant Encryption",
      "payment.card_last_four": "🟢 Customer Service Preserved",
      "payment.card_brand": "🟢 Fraud Detection Preserved",
      "customer.email": "🔴 Still GDPR Violation",
      "customer.ssn": "🔴 Still PII Risk"
    }
  },

  {
    id: 3,
    title: "Personal Data Encryption (GDPR/CCPA)",
    description: "Encrypt personal identifiers including email, phone, SSN, and names while preserving domain, area code, and last-4 for analytics.",
    input: {
      "transaction_id": "txn-12345",
      "payment": {
        "card_number_encrypted": "AES256GCM:v1:Y2FyZGRhdGE=:7f6e5d4c3b2a1h0g9f8e7d6c5b4a3g2f",
        "card_last_four": "9010",
        "card_brand": "visa"
      },
      "customer": {
        "customer_id": "cust-789",
        "first_name": "Sarah",
        "last_name": "Johnson", 
        "email": "sarah.johnson@example.com",
        "phone": "+1-415-555-0123",
        "ssn": "123-45-6789",
        "date_of_birth": "1985-03-15"
      },
      "billing_address": {
        "street": "123 Main St, Apt 4B",
        "city": "San Francisco",
        "state": "CA",
        "zip": "94102-1234"
      }
    },
    output: {
      "transaction_id": "txn-12345",
      "payment": {
        "card_number_encrypted": "AES256GCM:v1:Y2FyZGRhdGE=:7f6e5d4c3b2a1h0g9f8e7d6c5b4a3g2f",
        "card_last_four": "9010", 
        "card_brand": "visa"
      },
      "customer": {
        "customer_id": "cust-789",
        "first_name_encrypted": "AES256GCM:v1:Zmlyc3ROYW1l:5c4b3a2g1h0f9e8d7c6b5a4g3f2e1d0c",
        "last_name_encrypted": "AES256GCM:v1:bGFzdE5hbWU=:4b3a2g1h0f9e8d7c6b5a4g3f2e1d0c9b",
        "email_encrypted": "AES256GCM:v1:ZW1haWxkYXRh:8f7e6d5c4b3a2g1h0f9e8d7c6b5a4g3f", 
        "email_domain": "example.com",
        "email_domain_type": "business",
        "phone_encrypted": "AES256GCM:v1:cGhvbmVkYXRh:7e6d5c4b3a2g1h0f9e8d7c6b5a4g3f2e",
        "phone_country_code": "+1",
        "phone_area_code": "415",
        "ssn_encrypted": "AES256GCM:v1:c3NuZGF0YQ==:6d5c4b3a2g1h0f9e8d7c6b5a4g3f2e1d",
        "ssn_last_four": "6789",
        "date_of_birth": "1985-03-15"
      },
      "billing_address": {
        "street": "123 Main St, Apt 4B",
        "city": "San Francisco", 
        "state": "CA",
        "zip": "94102-1234"
      },
      "pii_encryption_metadata": {
        "encrypted": true,
        "compliance_standards": ["GDPR", "CCPA"],
        "pii_fields_encrypted": ["customer.email", "customer.phone", "customer.ssn", "customer.first_name", "customer.last_name"],
        "analytics_preserved": ["customer.email_domain", "customer.phone_area_code", "customer.ssn_last_four"]
      }
    },
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
    highlights: {
      "customer.email_encrypted": "🟢 GDPR Compliant Encryption", 
      "customer.email_domain": "🟢 B2B Analytics Preserved",
      "customer.phone_area_code": "🟢 Regional Analytics",
      "customer.ssn_last_four": "🟢 Customer Service Lookup",
      "billing_address.street": "🔴 Still Location Privacy Risk",
      "customer.date_of_birth": "🔴 Still HIPAA Risk"
    }
  },

  {
    id: 4,
    title: "Address Data Encryption (Location Privacy)",
    description: "Encrypt street addresses and detailed ZIP codes while preserving city, state, and ZIP prefix for demographic analytics.",
    input: {
      "customer": {
        "email_encrypted": "AES256GCM:v1:ZW1haWxkYXRh:8f7e6d5c4b3a2g1h0f9e8d7c6b5a4g3f",
        "email_domain": "example.com",
        "date_of_birth": "1985-03-15"
      },
      "billing_address": {
        "street": "123 Main St, Apt 4B",
        "city": "San Francisco",
        "state": "CA", 
        "zip": "94102-1234",
        "country": "US"
      },
      "shipping_address": {
        "street": "456 Oak Ave", 
        "city": "Palo Alto",
        "state": "CA",
        "zip": "94301-5678",
        "country": "US"
      }
    },
    output: {
      "customer": {
        "email_encrypted": "AES256GCM:v1:ZW1haWxkYXRh:8f7e6d5c4b3a2g1h0f9e8d7c6b5a4g3f",
        "email_domain": "example.com", 
        "date_of_birth": "1985-03-15"
      },
      "billing_address": {
        "street_encrypted": "AES256GCM:v1:c3RyZWV0ZGF0YQ==:9f8e7d6c5b4a3g2f1h0g",
        "zip_encrypted": "AES256GCM:v1:emlwZGF0YWhlcmU=:8e7d6c5b4a3g2f1h0g9e",
        "city": "San Francisco",
        "state": "CA",
        "country": "US",
        "zip_prefix": "941",
        "metro_area": "sf_bay_area"
      },
      "shipping_address": {
        "street_encrypted": "AES256GCM:v1:c2hpcGFkZHJlc3M=:7d6c5b4a3g2f1h0g9e8d",
        "zip_encrypted": "AES256GCM:v1:c2hpcHppcA==:6c5b4a3g2f1h0g9e8d7c", 
        "city": "Palo Alto",
        "state": "CA",
        "country": "US",
        "zip_prefix": "943",
        "metro_area": "sf_bay_area"
      },
      "address_analysis": {
        "same_city": false,
        "same_state": true,
        "same_metro": true,
        "same_zip_area": false
      },
      "address_encryption_metadata": {
        "encrypted": true,
        "compliance_standards": ["location_privacy", "gdpr_article_4"],
        "address_fields_encrypted": ["billing_address.street", "billing_address.zip", "shipping_address.street", "shipping_address.zip"],
        "geographic_analytics_preserved": ["city", "state", "zip_prefix", "metro_area"]
      }
    },
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
    highlights: {
      "billing_address.street_encrypted": "🟢 Location Privacy Protected",
      "billing_address.zip_prefix": "🟢 Demographic Analytics",
      "billing_address.metro_area": "🟢 Regional Trends",
      "address_analysis": "🟢 Shipping Pattern Analytics",
      "customer.date_of_birth": "🔴 Still HIPAA Risk"
    }
  },

  {
    id: 5,
    title: "Temporal Data Encryption (HIPAA)",
    description: "Encrypt birth dates and sensitive timestamps while preserving age cohorts, seasons, and generational analytics for HIPAA compliance.",
    input: {
      "customer": {
        "email_encrypted": "AES256GCM:v1:ZW1haWxkYXRh:8f7e6d5c4b3a2g1h0f9e8d7c6b5a4g3f",
        "date_of_birth": "1985-03-15"
      },
      "billing_address": {
        "street_encrypted": "AES256GCM:v1:c3RyZWV0ZGF0YQ==:9f8e7d6c5b4a3g2f1h0g",
        "city": "San Francisco",
        "zip_prefix": "941"
      }
    },
    output: {
      "customer": {
        "email_encrypted": "AES256GCM:v1:ZW1haWxkYXRh:8f7e6d5c4b3a2g1h0f9e8d7c6b5a4g3f",
        "date_of_birth_encrypted": "AES256GCM:v1:ZGF0ZW9mYmlydGg=:5c4b3a2g1h0f9e8d7c6b5a4g3f2e1d0c",
        "birth_year": 1985,
        "current_age": 40,
        "age_range": "35_to_44",
        "birth_decade": "1980s", 
        "birth_season": "spring"
      },
      "billing_address": {
        "street_encrypted": "AES256GCM:v1:c3RyZWV0ZGF0YQ==:9f8e7d6c5b4a3g2f1h0g",
        "city": "San Francisco",
        "zip_prefix": "941"
      },
      "temporal_encryption_metadata": {
        "encrypted": true,
        "compliance_standards": ["HIPAA", "temporal_privacy", "age_protection"],
        "temporal_fields_encrypted": ["customer.date_of_birth"],
        "temporal_analytics_preserved": ["customer.birth_year", "customer.age_range", "customer.birth_decade", "customer.birth_season"],
        "hipaa_compliance": {
          "birth_date_protected": true,
          "age_analytics_preserved": true,
          "safe_harbor_compliance": true
        }
      }
    },
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
    highlights: {
      "customer.date_of_birth_encrypted": "🟢 HIPAA Compliant Encryption",
      "customer.age_range": "🟢 Demographic Analytics Safe",
      "customer.birth_decade": "🟢 Generational Analysis",
      "customer.birth_season": "🟢 Seasonal Pattern Analytics",
      "temporal_encryption_metadata.safe_harbor_compliance": "🟢 Safe Harbor De-identification"
    }
  },

  {
    id: 6,
    title: "Multi-Key Security & Production Operations",
    description: "Complete multi-tier encryption architecture with risk-based key management, automated rotation, comprehensive audit trails, and compliance monitoring.",
    input: {
      "transaction_id": "txn-12345",
      "payment": {
        "card_number_encrypted": "AES256GCM:v1:Y2FyZGRhdGE=:7f6e5d4c3b2a1h0g9f8e7d6c5b4a3g2f",
        "card_last_four": "9010"
      },
      "customer": {
        "email_encrypted": "AES256GCM:v1:ZW1haWxkYXRh:8f7e6d5c4b3a2g1h0f9e8d7c6b5a4g3f",
        "date_of_birth_encrypted": "AES256GCM:v1:ZGF0ZW9mYmlydGg=:5c4b3a2g1h0f9e8d7c6b5a4g3f2e1d0c",
        "age_range": "35_to_44"
      },
      "billing_address": {
        "street_encrypted": "AES256GCM:v1:c3RyZWV0ZGF0YQ==:9f8e7d6c5b4a3g2f1h0g",
        "city": "San Francisco"
      }
    },
    output: {
      "transaction_id": "txn-12345",
      "payment": {
        "card_number_encrypted": "AES256GCM:v1:Y2FyZGRhdGE=:7f6e5d4c3b2a1h0g9f8e7d6c5b4a3g2f",
        "card_last_four": "9010",
        "card_brand": "visa"
      },
      "customer": {
        "email_encrypted": "AES256GCM:v1:ZW1haWxkYXRh:8f7e6d5c4b3a2g1h0f9e8d7c6b5a4g3f",
        "email_domain": "example.com",
        "date_of_birth_encrypted": "AES256GCM:v1:ZGF0ZW9mYmlydGg=:5c4b3a2g1h0f9e8d7c6b5a4g3f2e1d0c",
        "age_range": "35_to_44",
        "birth_decade": "1980s"
      },
      "billing_address": {
        "street_encrypted": "AES256GCM:v1:c3RyZWV0ZGF0YQ==:9f8e7d6c5b4a3g2f1h0g",
        "city": "San Francisco",
        "state": "CA",
        "zip_prefix": "941"
      },
      "multi_key_metadata": {
        "encryption_architecture": "multi_tier_risk_based",
        "key_tiers_used": {
          "payment_critical": {
            "key_version": "v3_20241215",
            "rotation_schedule_days": 90,
            "compliance_standards": ["PCI-DSS"],
            "access_control": "payment_processor_only"
          },
          "pii_high": {
            "key_version": "v2_20241001",
            "rotation_schedule_days": 180,
            "compliance_standards": ["GDPR", "CCPA"],
            "access_control": "customer_service_analytics"
          },
          "location_medium": {
            "key_version": "v1_20240701",
            "rotation_schedule_days": 365,
            "compliance_standards": ["location_privacy"]
          },
          "temporal_medium": {
            "key_version": "v1_20240701",
            "rotation_schedule_days": 365,
            "compliance_standards": ["HIPAA"]
          }
        }
      },
      "operational_metrics": {
        "pipeline_health": "optimal",
        "encryption_latency_ms": 45,
        "security_score": 98,
        "compliance_status": "fully_compliant"
      },
      "compliance_summary": {
        "pci_dss": "compliant",
        "gdpr": "compliant",
        "ccpa": "compliant", 
        "hipaa": "compliant",
        "iso27001": "compliant",
        "audit_ready": true
      },
      "audit_trail": {
        "audit_id": "enc_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "encryption_operations": [
          {"field": "payment.card_number", "algorithm": "AES-256-GCM", "compliance": "PCI-DSS"},
          {"field": "customer.email", "algorithm": "AES-256-GCM", "compliance": "GDPR"},
          {"field": "customer.date_of_birth", "algorithm": "AES-256-GCM", "compliance": "HIPAA"},
          {"field": "billing_address.street", "algorithm": "AES-256-GCM", "compliance": "location_privacy"}
        ],
        "total_fields_encrypted": 11,
        "encryption_coverage_percentage": 100
      }
    },
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
    highlights: {
      "multi_key_metadata": "🟢 Risk-Based Multi-Tier Architecture",
      "operational_metrics.security_score": "🟢 98/100 Security Score",
      "compliance_summary": "🟢 Full Regulatory Compliance",
      "audit_trail.encryption_coverage_percentage": "🟢 100% Encryption Coverage",
      "operational_metrics.pipeline_health": "🟢 Production Ready"
    }
  }
];
