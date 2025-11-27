import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

/**
 * 6-Stage PII Removal Pipeline
 * Demonstrates incremental PII removal techniques:
 * 1. Original Input - Raw data with all PII
 * 2. Delete Payment Data - Remove credit card numbers (PCI-DSS)
 * 3. Hash IP Address - Convert IP to irreversible hash
 * 4. Hash Email - Convert email to hash + extract domain
 * 5. Pseudonymize User - Replace name with consistent user_id
 * 6. Generalize Location - Remove precise coordinates, keep city/country
 */

export const removePiiFullStages: Stage[] = [
  // ============================================================================
  // STAGE 1: Original Input - All PII Intact
  // ============================================================================
  {
    id: 1,
    title: 'Step 1: Original Input',
    description: 'Raw purchase event containing all PII fields: credit card, email, IP address, user name, and precise location coordinates. This is the baseline we will transform in the following stages.',
    yamlFilename: 'input.json',
    yamlCode: `# No processing yet - this is the raw input
# Contains PII that violates:
# - PCI-DSS (credit card: full_number, expiry)
# - GDPR (email, IP, precise location)
# - CCPA (personal identifiers: user_name)`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_name": "Sarah Johnson",', indent: 1, key: 'user_name', valueType: 'string' },
      { content: '"email": "sarah.johnson@example.com",', indent: 1, key: 'email', valueType: 'string' },
      { content: '"ip_address": "192.168.1.100",', indent: 1, key: 'ip_address', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"full_number": "4532-1234-5678-9010",', indent: 2, key: 'full_number', valueType: 'string' },
      { content: '"expiry": "12/25",', indent: 2, key: 'expiry', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_name": "Sarah Johnson",', indent: 1, key: 'user_name', valueType: 'string' },
      { content: '"email": "sarah.johnson@example.com",', indent: 1, key: 'email', valueType: 'string' },
      { content: '"ip_address": "192.168.1.100",', indent: 1, key: 'ip_address', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"full_number": "4532-1234-5678-9010",', indent: 2, key: 'full_number', valueType: 'string' },
      { content: '"expiry": "12/25",', indent: 2, key: 'expiry', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },

  // ============================================================================
  // STAGE 2: Delete Payment Data - Remove Credit Card Numbers
  // ============================================================================
  {
    id: 2,
    title: 'Step 2: Delete Payment Data',
    description: 'Remove full credit card number and expiry date using .without(). This is the highest-risk PII and violates PCI-DSS Level 1 compliance if stored.',
    yamlFilename: 'step-1-delete-payment.yaml',
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this

        # Remove credit card numbers (PCI-DSS Level 1)
        # Keep last_four for fraud detection and analytics
        root.payment_method = this.payment_method.without(
          "full_number",
          "expiry"
        )`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_name": "Sarah Johnson",', indent: 1, key: 'user_name', valueType: 'string' },
      { content: '"email": "sarah.johnson@example.com",', indent: 1, key: 'email', valueType: 'string' },
      { content: '"ip_address": "192.168.1.100",', indent: 1, key: 'ip_address', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"full_number": "4532-1234-5678-9010",', indent: 2, key: 'full_number', valueType: 'string', type: 'removed' },
      { content: '"expiry": "12/25",', indent: 2, key: 'expiry', valueType: 'string', type: 'removed' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_name": "Sarah Johnson",', indent: 1, key: 'user_name', valueType: 'string' },
      { content: '"email": "sarah.johnson@example.com",', indent: 1, key: 'email', valueType: 'string' },
      { content: '"ip_address": "192.168.1.100",', indent: 1, key: 'ip_address', valueType: 'string' },
      { content: '"payment_method": {', indent: 1, type: 'highlighted' },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string', type: 'highlighted' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1, type: 'highlighted' },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },

  // ============================================================================
  // STAGE 3: Hash IP Address
  // ============================================================================
  {
    id: 3,
    title: 'Step 3: Hash IP Address',
    description: 'Convert IP address to SHA-256 hash with salt. Preserves uniqueness for abuse detection while making it irreversible. GDPR considers IP addresses as PII.',
    yamlFilename: 'step-2-hash-ip.yaml',
    yamlCode: `pipeline:
  processors:
    # Step 1: Delete payment data
    - mapping: |
        root = this
        root.payment_method = this.payment_method.without(
          "full_number", "expiry"
        )

    # Step 2: Hash IP address
    - mapping: |
        root = this

        # Get salt from environment (keep secret!)
        let ip_salt = env("IP_SALT").or("default-salt-change-me")

        # SHA-256 hash with salt, take first 16 chars
        root.ip_address_hash = (this.ip_address + ip_salt)
          .hash("sha256").slice(0, 16)

        # Remove original IP
        root = this.without("ip_address")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_name": "Sarah Johnson",', indent: 1, key: 'user_name', valueType: 'string' },
      { content: '"email": "sarah.johnson@example.com",', indent: 1, key: 'email', valueType: 'string' },
      { content: '"ip_address": "192.168.1.100",', indent: 1, key: 'ip_address', valueType: 'string', type: 'removed' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_name": "Sarah Johnson",', indent: 1, key: 'user_name', valueType: 'string' },
      { content: '"email": "sarah.johnson@example.com",', indent: 1, key: 'email', valueType: 'string' },
      { content: '"ip_address_hash": "7b9d4e2f1c8a6e3b",', indent: 1, key: 'ip_address_hash', valueType: 'string', type: 'highlighted' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },

  // ============================================================================
  // STAGE 4: Hash Email + Extract Domain
  // ============================================================================
  {
    id: 4,
    title: 'Step 4: Hash Email',
    description: 'Convert email to hash while extracting domain separately. Allows organizational analytics (e.g., "10% of users are @gmail.com") without storing personal emails.',
    yamlFilename: 'step-3-hash-email.yaml',
    yamlCode: `pipeline:
  processors:
    # Steps 1-2 from previous stages...

    # Step 3: Hash email and extract domain
    - mapping: |
        root = this

        # Get salt from environment
        let email_salt = env("EMAIL_SALT").or("default-salt")

        # Hash email for unique counting
        root.email_hash = (this.email + email_salt)
          .hash("sha256").slice(0, 16)

        # Extract domain for org analytics
        root.email_domain = this.email.split("@")[1]

        # Remove original email
        root = this.without("email")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_name": "Sarah Johnson",', indent: 1, key: 'user_name', valueType: 'string' },
      { content: '"email": "sarah.johnson@example.com",', indent: 1, key: 'email', valueType: 'string', type: 'removed' },
      { content: '"ip_address_hash": "7b9d4e2f1c8a6e3b",', indent: 1, key: 'ip_address_hash', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_name": "Sarah Johnson",', indent: 1, key: 'user_name', valueType: 'string' },
      { content: '"email_hash": "a4c2f1e9b3d7c5e8",', indent: 1, key: 'email_hash', valueType: 'string', type: 'highlighted' },
      { content: '"email_domain": "example.com",', indent: 1, key: 'email_domain', valueType: 'string', type: 'highlighted' },
      { content: '"ip_address_hash": "7b9d4e2f1c8a6e3b",', indent: 1, key: 'ip_address_hash', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },

  // ============================================================================
  // STAGE 5: Pseudonymize User Name
  // ============================================================================
  {
    id: 5,
    title: 'Step 5: Pseudonymize User',
    description: 'Replace user name with consistent pseudonym (hashed user_id). Same user always gets same ID, enabling user journey tracking without storing real names.',
    yamlFilename: 'step-4-pseudonymize-user.yaml',
    yamlCode: `pipeline:
  processors:
    # Steps 1-3 from previous stages...

    # Step 4: Pseudonymize user name
    - mapping: |
        root = this

        # Get salt from environment
        let user_salt = env("USER_SALT").or("default-salt")

        # Create consistent user_id from name
        # Same name = same ID (pseudonymization)
        # Different names = different IDs
        root.user_id = "user_" + (this.user_name + user_salt)
          .hash("sha256").slice(0, 12)

        # Remove original name
        root = this.without("user_name")`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_name": "Sarah Johnson",', indent: 1, key: 'user_name', valueType: 'string', type: 'removed' },
      { content: '"email_hash": "a4c2f1e9b3d7c5e8",', indent: 1, key: 'email_hash', valueType: 'string' },
      { content: '"email_domain": "example.com",', indent: 1, key: 'email_domain', valueType: 'string' },
      { content: '"ip_address_hash": "7b9d4e2f1c8a6e3b",', indent: 1, key: 'ip_address_hash', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_id": "user_8f3e7a9c2d1b",', indent: 1, key: 'user_id', valueType: 'string', type: 'highlighted' },
      { content: '"email_hash": "a4c2f1e9b3d7c5e8",', indent: 1, key: 'email_hash', valueType: 'string' },
      { content: '"email_domain": "example.com",', indent: 1, key: 'email_domain', valueType: 'string' },
      { content: '"ip_address_hash": "7b9d4e2f1c8a6e3b",', indent: 1, key: 'ip_address_hash', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1 },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },

  // ============================================================================
  // STAGE 6: Generalize Location - Remove Precise Coordinates
  // ============================================================================
  {
    id: 6,
    title: 'Step 6: Generalize Location',
    description: 'Final step: Remove precise GPS coordinates, keeping only city and country. Enables regional analytics without tracking exact user locations. GDPR compliant!',
    yamlFilename: 'step-5-generalize-location.yaml',
    yamlCode: `pipeline:
  processors:
    # Steps 1-4 from previous stages...

    # Step 5: Generalize location data
    - mapping: |
        root = this

        # Keep only city and country
        # Remove precise lat/long coordinates
        root.location = {
          "city": this.location.city,
          "country": this.location.country,
          "region": this.location.country  # For analytics
        }

# ✅ PII-FREE OUTPUT!
# All PII removed or transformed:
# ✓ Credit card deleted
# ✓ IP hashed
# ✓ Email hashed (domain extracted)
# ✓ User name pseudonymized
# ✓ Location generalized`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_id": "user_8f3e7a9c2d1b",', indent: 1, key: 'user_id', valueType: 'string' },
      { content: '"email_hash": "a4c2f1e9b3d7c5e8",', indent: 1, key: 'email_hash', valueType: 'string' },
      { content: '"email_domain": "example.com",', indent: 1, key: 'email_domain', valueType: 'string' },
      { content: '"ip_address_hash": "7b9d4e2f1c8a6e3b",', indent: 1, key: 'ip_address_hash', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1, type: 'removed' },
      { content: '"latitude": 37.7749,', indent: 2, key: 'latitude', valueType: 'number', type: 'removed' },
      { content: '"longitude": -122.4194,', indent: 2, key: 'longitude', valueType: 'number', type: 'removed' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string' },
      { content: '"country": "USA"', indent: 2, key: 'country', valueType: 'string' },
      { content: '},', indent: 1, type: 'removed' },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_20240115_1030",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"timestamp": "2024-01-15T10:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user_id": "user_8f3e7a9c2d1b",', indent: 1, key: 'user_id', valueType: 'string' },
      { content: '"email_hash": "a4c2f1e9b3d7c5e8",', indent: 1, key: 'email_hash', valueType: 'string' },
      { content: '"email_domain": "example.com",', indent: 1, key: 'email_domain', valueType: 'string' },
      { content: '"ip_address_hash": "7b9d4e2f1c8a6e3b",', indent: 1, key: 'ip_address_hash', valueType: 'string' },
      { content: '"payment_method": {', indent: 1 },
      { content: '"type": "credit_card",', indent: 2, key: 'type', valueType: 'string' },
      { content: '"last_four": "9010"', indent: 2, key: 'last_four', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"location": {', indent: 1, type: 'highlighted' },
      { content: '"city": "San Francisco",', indent: 2, key: 'city', valueType: 'string', type: 'highlighted' },
      { content: '"country": "USA",', indent: 2, key: 'country', valueType: 'string', type: 'highlighted' },
      { content: '"region": "USA"', indent: 2, key: 'region', valueType: 'string', type: 'highlighted' },
      { content: '},', indent: 1, type: 'highlighted' },
      { content: '"purchase_amount": 49.99,', indent: 1, key: 'purchase_amount', valueType: 'number' },
      { content: '"currency": "USD"', indent: 1, key: 'currency', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },
];
