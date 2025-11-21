import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const deduplicateEventsStages: Stage[] = [
  {
    id: 1,
    title: "Original Events",
    description: "Multiple events arrive with potential duplicates from network retries, load balancer failovers, and eventual consistency delays.",
    yamlFilename: 'input.json',
    yamlCode: `# Original input - no deduplication yet
input:
  http_server:
    address: "0.0.0.0:8080"
    path: "/webhooks/events"`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_signup_001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "user_signup",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"timestamp": "2025-01-15T10:30:45.123Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_12345",', indent: 2, key: 'id', valueType: 'string' },
      { content: '"email": "alice@example.com"', indent: 2, key: 'email', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_signup_001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "user_signup",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"timestamp": "2025-01-15T10:30:45.123Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_12345",', indent: 2, key: 'id', valueType: 'string' },
      { content: '"email": "alice@example.com"', indent: 2, key: 'email', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Hash-Based Deduplication",
    description: "Generate SHA-256 hash of entire event content and cache it. Identical events (same JSON structure) are detected and filtered.",
    yamlFilename: 'step-1-hash-based.yaml',
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
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_signup_001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "user_signup",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_12345",', indent: 2, key: 'id', valueType: 'string' },
      { content: '"email": "alice@example.com"', indent: 2, key: 'email', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_signup_001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "user_signup",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_12345",', indent: 2, key: 'id', valueType: 'string' },
      { content: '"email": "alice@example.com"', indent: 2, key: 'email', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"dedup_hash": "a1b2c3d4e5f6...",', indent: 1, key: 'dedup_hash', valueType: 'string', type: 'highlighted' },
      { content: '"dedup_metadata": {', indent: 1, type: 'highlighted' },
      { content: '"strategy": "hash-based",', indent: 2, key: 'strategy', valueType: 'string', type: 'highlighted' },
      { content: '"processed_at": "2025-01-15T10:30:45.150Z"', indent: 2, key: 'processed_at', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Fingerprint-Based Deduplication",
    description: "Extract only business-critical fields (user ID, email, action type) to generate a semantic fingerprint. Catches duplicates with different event IDs but same business meaning.",
    yamlFilename: 'step-2-fingerprint-based.yaml',
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
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_signup_002",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "user_signup",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"timestamp": "2025-01-15T10:30:47.892Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_12345",', indent: 2, key: 'id', valueType: 'string' },
      { content: '"email": "alice@example.com"', indent: 2, key: 'email', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "evt_signup_001",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "user_signup",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_12345",', indent: 2, key: 'id', valueType: 'string' },
      { content: '"email": "alice@example.com"', indent: 2, key: 'email', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"business_fingerprint": "fp_a1b2c3d4...",', indent: 1, key: 'business_fingerprint', valueType: 'string', type: 'highlighted' },
      { content: '"fingerprint_metadata": {', indent: 1, type: 'highlighted' },
      { content: '"strategy": "fingerprint-based",', indent: 2, key: 'strategy', valueType: 'string', type: 'highlighted' },
      { content: '"business_fields": ["user.id", "user.email", "event_type"],', indent: 2, key: 'business_fields', valueType: 'array', type: 'highlighted' },
      { content: '"generated_at": "2025-01-15T10:30:45.150Z"', indent: 2, key: 'generated_at', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: "ID-Based Deduplication",
    description: "Use existing unique event IDs for fastest duplicate detection. Ideal when your system guarantees truly unique identifiers like UUIDs.",
    yamlFilename: 'step-3-id-based.yaml',
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
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "550e8400-e29b-41d4-a716-446655440000",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_456"', indent: 2, key: 'id', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase": {', indent: 1 },
      { content: '"amount_cents": 9999', indent: 2, key: 'amount_cents', valueType: 'number' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "550e8400-e29b-41d4-a716-446655440000",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_456"', indent: 2, key: 'id', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"purchase": {', indent: 1 },
      { content: '"amount_cents": 9999', indent: 2, key: 'amount_cents', valueType: 'number' },
      { content: '},', indent: 1 },
      { content: '"dedup_metadata": {', indent: 1, type: 'highlighted' },
      { content: '"strategy": "id-based",', indent: 2, key: 'strategy', valueType: 'string', type: 'highlighted' },
      { content: '"unique_id": "550e8400-e29b-41d4-a716-446655440000",', indent: 2, key: 'unique_id', valueType: 'string', type: 'highlighted' },
      { content: '"id_type": "uuid4",', indent: 2, key: 'id_type', valueType: 'string', type: 'highlighted' },
      { content: '"processed_at": "2025-01-15T10:31:22.500Z"', indent: 2, key: 'processed_at', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 5,
    title: "Production Configuration",
    description: "Adds distributed caching with Redis cluster, monitoring metrics, error handling, and circuit breaker for production deployment across multiple edge nodes.",
    yamlFilename: 'step-4-production.yaml',
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
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "550e8400-e29b-41d4-a716-446655440000",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_456"', indent: 2, key: 'id', valueType: 'string' },
      { content: '}', indent: 1 },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"event_id": "550e8400-e29b-41d4-a716-446655440000",', indent: 1, key: 'event_id', valueType: 'string' },
      { content: '"event_type": "purchase",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"user": {', indent: 1 },
      { content: '"id": "user_456"', indent: 2, key: 'id', valueType: 'string' },
      { content: '},', indent: 1 },
      { content: '"production_metadata": {', indent: 1, type: 'highlighted' },
      { content: '"deduplication_verified": true,', indent: 2, key: 'deduplication_verified', valueType: 'boolean', type: 'highlighted' },
      { content: '"processing_node": "edge-node-01",', indent: 2, key: 'processing_node', valueType: 'string', type: 'highlighted' },
      { content: '"cluster_region": "us-east-1",', indent: 2, key: 'cluster_region', valueType: 'string', type: 'highlighted' },
      { content: '"dedup_strategy": "id-based",', indent: 2, key: 'dedup_strategy', valueType: 'string', type: 'highlighted' },
      { content: '"global_uniqueness_confirmed": true,', indent: 2, key: 'global_uniqueness_confirmed', valueType: 'boolean', type: 'highlighted' },
      { content: '"processing_latency_ms": 2.3', indent: 2, key: 'processing_latency_ms', valueType: 'number', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  }
];
