import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const deduplicateEventsStages: Stage[] = [
  {
    id: 1,
    title: "Original Events",
    description: "Multiple events arrive with potential duplicates from network retries, load balancer failovers, and eventual consistency delays.",
    input: {
      "events": [
        {
          "event_id": "evt_signup_001",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:45.123Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        },
        {
          "event_id": "evt_signup_001",
          "event_type": "user_signup", 
          "timestamp": "2025-01-15T10:30:45.123Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        },
        {
          "event_id": "evt_signup_002",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:47.892Z", 
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        },
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          }
        },
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456", 
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          }
        }
      ]
    },
    output: {
      "events": [
        {
          "event_id": "evt_signup_001",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:45.123Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        },
        {
          "event_id": "evt_signup_001",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:45.123Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com", 
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        },
        {
          "event_id": "evt_signup_002",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:47.892Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        },
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          }
        },
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          }
        }
      ]
    },
    yamlCode: `# Original input - no deduplication yet
input:
  http_server:
    address: "0.0.0.0:8080"
    path: "/webhooks/events"`,
    additions: [],
    removals: []
  },
  {
    id: 2,
    title: "Hash-Based Deduplication",
    description: "Generate SHA-256 hash of entire event content and cache it. Identical events (same JSON structure) are detected and filtered.",
    input: {
      "events": [
        {
          "event_id": "evt_signup_001",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:45.123Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        },
        {
          "event_id": "evt_signup_001",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:45.123Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        },
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          }
        },
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase", 
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          }
        }
      ]
    },
    output: {
      "events": [
        {
          "event_id": "evt_signup_001",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:45.123Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          },
          "dedup_hash": "a1b2c3d4e5f6...",
          "dedup_metadata": {
            "strategy": "hash-based",
            "processed_at": "2025-01-15T10:30:45.150Z"
          }
        },
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z", 
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          },
          "dedup_hash": "x7y8z9a0b1c2...",
          "dedup_metadata": {
            "strategy": "hash-based",
            "processed_at": "2025-01-15T10:31:22.500Z"
          }
        }
      ]
    },
    yamlCode: `# Hash-based deduplication processor
cache_resources:
  - label: dedup_cache
    memory:
      default_ttl: 1h
      cap: 100000

pipeline:
  processors:
    - mapping: |
        root = this
        # Generate SHA-256 hash of entire content
        root.dedup_hash = this.json_format().hash("sha256")
        
    - cache:
        resource: dedup_cache
        operator: get
        key: \${! this.dedup_hash }
        
    - mapping: |
        root = if meta("cache").exists() {
          deleted()  # Drop exact duplicates
        } else {
          _ = cache_set("dedup_cache", this.dedup_hash, now(), "1h")
          this
        }`,
    additions: ["dedup_hash", "dedup_metadata"],
    removals: ["Exact duplicate events filtered out"]
  },
  {
    id: 3,
    title: "Fingerprint-Based Deduplication", 
    description: "Extract only business-critical fields (user ID, email, action type) to generate a semantic fingerprint. Catches duplicates with different event IDs but same business meaning.",
    input: {
      "events": [
        {
          "event_id": "evt_signup_001",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:45.123Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        },
        {
          "event_id": "evt_signup_002",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:47.892Z",
          "user": {
            "id": "user_12345", 
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          }
        }
      ]
    },
    output: {
      "events": [
        {
          "event_id": "evt_signup_001",
          "event_type": "user_signup",
          "timestamp": "2025-01-15T10:30:45.123Z",
          "user": {
            "id": "user_12345",
            "email": "alice@example.com",
            "name": "Alice Smith"
          },
          "signup_details": {
            "source": "web_form",
            "plan": "premium"
          },
          "business_fingerprint": "fp_a1b2c3d4...",
          "fingerprint_metadata": {
            "strategy": "fingerprint-based",
            "business_fields": ["user.id", "user.email", "event_type", "signup_details"],
            "generated_at": "2025-01-15T10:30:45.150Z"
          }
        }
      ]
    },
    yamlCode: `# Fingerprint-based deduplication
processors:
  - mapping: |
      # Extract only business-critical fields
      let business_fields = {
        "event_type": this.event_type,
        "user_email": this.user.email,
        "signup_source": this.signup_details.source,
        "signup_plan": this.signup_details.plan
      }
      
      root.business_fingerprint = business_fields.json_format().hash("sha256")
      
  - cache:
      resource: dedup_cache
      operator: get
      key: \${! this.business_fingerprint }
      
  - mapping: |
      root = if meta("cache").exists() {
        deleted()  # Drop semantic duplicates
      } else {
        _ = cache_set("dedup_cache", this.business_fingerprint, now(), "6h") 
        this
      }`,
    additions: ["business_fingerprint", "fingerprint_metadata"],
    removals: ["Semantic duplicate (different event_id, same business operation)"]
  },
  {
    id: 4,
    title: "ID-Based Deduplication",
    description: "Use existing unique event IDs for fastest duplicate detection. Ideal when your system guarantees truly unique identifiers like UUIDs.",
    input: {
      "events": [
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          }
        },
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          }
        }
      ]
    },
    output: {
      "events": [
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          },
          "dedup_metadata": {
            "strategy": "id-based",
            "unique_id": "550e8400-e29b-41d4-a716-446655440000",
            "id_type": "uuid4",
            "processed_at": "2025-01-15T10:31:22.500Z"
          }
        }
      ]
    },
    yamlCode: `# ID-based deduplication (fastest)
processors:
  - mapping: |
      # Validate and extract unique ID
      root = if !this.event_id.exists() || this.event_id == "" {
        throw("Missing event_id for ID-based deduplication")
      } else {
        this
      }
      root.unique_id = this.event_id.trim()
      
  - cache:
      resource: dedup_cache
      operator: get
      key: \${! this.unique_id }
      
  - mapping: |
      root = if meta("cache").exists() {
        deleted()  # Drop ID duplicates
      } else {
        _ = cache_set("dedup_cache", this.unique_id, now(), "30m")
        this
      }`,
    additions: ["unique_id", "id validation"],
    removals: ["Duplicate UUID detected and filtered"]
  },
  {
    id: 5,
    title: "Production Configuration",
    description: "Adds distributed caching with Redis cluster, monitoring metrics, error handling, and circuit breaker for production deployment across multiple edge nodes.",
    input: {
      "events": [
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z",
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          }
        }
      ]
    },
    output: {
      "events": [
        {
          "event_id": "550e8400-e29b-41d4-a716-446655440000",
          "event_type": "purchase",
          "timestamp": "2025-01-15T10:31:22.456Z", 
          "user": {
            "id": "user_456",
            "email": "bob@example.com"
          },
          "purchase": {
            "amount_cents": 9999,
            "product_id": "prod_789"
          },
          "production_metadata": {
            "deduplication_verified": true,
            "processing_node": "edge-node-01",
            "cluster_region": "us-east-1",
            "dedup_strategy": "id-based",
            "global_uniqueness_confirmed": true,
            "processing_latency_ms": 2.3
          }
        }
      ]
    },
    yamlCode: `# Production distributed configuration
cache_resources:
  - label: distributed_cache
    redis:
      cluster_addresses:
        - "redis-node-1:7001"
        - "redis-node-2:7002" 
        - "redis-node-3:7003"
      default_ttl: "1h"
      pool_size: 50

  - label: local_fallback_cache
    memory:
      default_ttl: "5m"
      cap: 50000

http:
  address: "0.0.0.0:9090"
  enabled: true
  path: "/metrics"

pipeline:
  processors:
    # Auto-strategy selection
    - mapping: |
        root.dedup_strategy = if this.event_id.match("^[0-9a-fA-F-]{36}$") {
          "id-based"
        } else if this.event_type.in(["user_signup", "purchase"]) {
          "fingerprint-based" 
        } else {
          "hash-based"
        }
        
    # Circuit breaker with fallback
    - branch:
        request_map: |
          root = if env("CIRCUIT_STATE") == "closed" {
            this
          } else {
            deleted()  # Use local cache
          }
        processors:
          - cache:
              resource: distributed_cache
              operator: get
              key: \${! this.dedup_key }`,
    additions: ["production_metadata", "distributed_cache", "circuit_breaker", "monitoring"],
    removals: []
  }
];
