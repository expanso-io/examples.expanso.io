import type { PipelineStage } from '../../src/components/ProgressivePipelineExplorer/types';

/**
 * Sample input data containing PII
 */
export const piiSampleInput = {
  event_id: "evt_20240115_1030",
  timestamp: "2024-01-15T10:30:00Z",
  event_type: "purchase",
  user_name: "Sarah Johnson",
  email: "sarah.johnson@example.com",
  ip_address: "192.168.1.100",
  payment_method: {
    type: "credit_card",
    full_number: "4532-1234-5678-9010",
    expiry: "12/25",
    last_four: "9010"
  },
  location: {
    latitude: 37.7749,
    longitude: -122.4194,
    city: "San Francisco",
    country: "USA"
  },
  purchase_amount: 49.99,
  currency: "USD"
};

/**
 * Progressive stages for PII removal pipeline
 */
export const piiRemovalStages: PipelineStage[] = [
  {
    id: 1,
    title: "1. Original Input",
    description: "Raw user activity event with PII fields exposed",
    yaml: `# Accept incoming events via HTTP
config:
  input:
    http_server:
      address: "0.0.0.0:8080"
      path: /events/ingest
      allowed_verbs:
        - POST`,
    outputData: piiSampleInput,
    highlightPaths: [],
  },

  {
    id: 2,
    title: "2. Delete Payment Data",
    description: "Remove high-risk PII: credit card numbers (PCI-DSS compliance)",
    yaml: `# Add processor to remove credit card data
pipeline:
  processors:
    - mapping: |
        root = this

        # Remove credit card numbers (PCI-DSS)
        root.payment_method = this.payment_method.without(
          "full_number",
          "expiry"
        )`,
    outputData: {
      event_id: "evt_20240115_1030",
      timestamp: "2024-01-15T10:30:00Z",
      event_type: "purchase",
      user_name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      ip_address: "192.168.1.100",
      payment_method: {
        type: "credit_card",
        last_four: "9010"
      },
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        city: "San Francisco",
        country: "USA"
      },
      purchase_amount: 49.99,
      currency: "USD"
    },
    highlightPaths: ["payment_method"],
    removedPaths: ["payment_method.full_number", "payment_method.expiry"],
  },

  {
    id: 3,
    title: "3. Hash IP Address",
    description: "Replace IP address with SHA-256 hash (preserve uniqueness, prevent identification)",
    yaml: `# Add processor to hash IP addresses
pipeline:
  processors:
    - mapping: |
        root = this

        # Hash IP with SHA-256 (with salt)
        root.ip_address_hash = if this.ip_address.exists() {
          (this.ip_address + env("IP_SALT").or("default_salt"))
            .hash("sha256")
            .slice(0, 16)
        }

        # Remove original IP
        root = this.without("ip_address")`,
    outputData: {
      event_id: "evt_20240115_1030",
      timestamp: "2024-01-15T10:30:00Z",
      event_type: "purchase",
      user_name: "Sarah Johnson",
      email: "sarah.johnson@example.com",
      ip_address_hash: "a3f2e1d4c5b6a7f8",
      payment_method: {
        type: "credit_card",
        last_four: "9010"
      },
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        city: "San Francisco",
        country: "USA"
      },
      purchase_amount: 49.99,
      currency: "USD"
    },
    highlightPaths: ["ip_address_hash"],
    removedPaths: ["ip_address"],
  },

  {
    id: 4,
    title: "4. Hash Email",
    description: "Hash email address and extract domain for analytics",
    yaml: `# Add processor to hash emails
pipeline:
  processors:
    - mapping: |
        root = this

        # Extract domain (allowed under GDPR)
        root.email_domain = if this.email.exists() {
          this.email.split("@").index(1).lowercase()
        }

        # Hash email address
        root.email_hash = if this.email.exists() {
          (this.email.lowercase() + env("EMAIL_SALT").or("default_salt"))
            .hash("sha256")
            .slice(0, 16)
        }

        # Remove original email
        root = this.without("email")`,
    outputData: {
      event_id: "evt_20240115_1030",
      timestamp: "2024-01-15T10:30:00Z",
      event_type: "purchase",
      user_name: "Sarah Johnson",
      email_hash: "b8e3c6d9a1f4e7b2",
      email_domain: "example.com",
      ip_address_hash: "a3f2e1d4c5b6a7f8",
      payment_method: {
        type: "credit_card",
        last_four: "9010"
      },
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        city: "San Francisco",
        country: "USA"
      },
      purchase_amount: 49.99,
      currency: "USD"
    },
    highlightPaths: ["email_hash", "email_domain"],
    removedPaths: ["email"],
  },

  {
    id: 5,
    title: "5. Pseudonymize User",
    description: "Replace username with consistent user ID",
    yaml: `# Add processor to pseudonymize usernames
pipeline:
  processors:
    - mapping: |
        root = this

        # Create consistent user ID
        root.user_id = if this.user_name.exists() {
          "user_" + (this.user_name.lowercase() +
                    env("USER_SALT").or("default_salt"))
                    .hash("sha256")
                    .slice(0, 12)
        }

        # Remove original name
        root = this.without("user_name")`,
    outputData: {
      event_id: "evt_20240115_1030",
      timestamp: "2024-01-15T10:30:00Z",
      event_type: "purchase",
      user_id: "user_c7d8e9f0a1b2",
      email_hash: "b8e3c6d9a1f4e7b2",
      email_domain: "example.com",
      ip_address_hash: "a3f2e1d4c5b6a7f8",
      payment_method: {
        type: "credit_card",
        last_four: "9010"
      },
      location: {
        latitude: 37.7749,
        longitude: -122.4194,
        city: "San Francisco",
        country: "USA"
      },
      purchase_amount: 49.99,
      currency: "USD"
    },
    highlightPaths: ["user_id"],
    removedPaths: ["user_name"],
  },

  {
    id: 6,
    title: "6. Generalize Location",
    description: "Remove precise coordinates, keep city/country for regional analytics",
    yaml: `# Add processor to generalize location
pipeline:
  processors:
    - mapping: |
        root = this

        # Keep only city/country for regional analytics
        root.location = if this.location.exists() {
          {
            "city": this.location.city,
            "country": this.location.country
          }
        }`,
    outputData: {
      event_id: "evt_20240115_1030",
      timestamp: "2024-01-15T10:30:00Z",
      event_type: "purchase",
      user_id: "user_c7d8e9f0a1b2",
      email_hash: "b8e3c6d9a1f4e7b2",
      email_domain: "example.com",
      ip_address_hash: "a3f2e1d4c5b6a7f8",
      payment_method: {
        type: "credit_card",
        last_four: "9010"
      },
      location: {
        city: "San Francisco",
        country: "USA"
      },
      purchase_amount: 49.99,
      currency: "USD"
    },
    highlightPaths: ["location"],
    removedPaths: ["location.latitude", "location.longitude"],
  },
];
