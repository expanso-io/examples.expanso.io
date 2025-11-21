import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const priorityQueuesStages: Stage[] = [
  {
    id: 1,
    title: "Original Input",
    description: "All messages flow through a single processing path regardless of importance. Critical alerts compete with routine logs, causing latency spikes and SLA violations.",
    yamlFilename: 'input.yaml',
    yamlCode: `# No priority routing - all messages treated equally
output:
  kafka:
    addresses: ["kafka-broker-1:9092","kafka-broker-2:9092"]
    topic: all-events
    batching:
      count: 100      # Same batching for all
      period: 30s     # Same delay for all
    max_retries: 3    # Same reliability for all`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"customer_tier": "enterprise",', indent: 1, key: 'customer_tier', valueType: 'string' },
      { content: '"urgency": "high",', indent: 1, key: 'urgency', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"amount": 50000', indent: 1, key: 'amount', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"customer_tier": "enterprise",', indent: 1, key: 'customer_tier', valueType: 'string' },
      { content: '"urgency": "high",', indent: 1, key: 'urgency', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"amount": 50000,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"processed_at": "2024-01-15T14:30:01Z"', indent: 1, key: 'processed_at', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Severity-Based Routing",
    description: "Messages are classified by log severity (CRITICAL, ERROR, WARNING, INFO) and routed to dedicated queues with appropriate batching policies. Critical messages bypass batching entirely.",
    yamlFilename: 'step-1-severity-routing.yaml',
    yamlCode: `# Severity-based priority classification
pipeline:
  processors:
    - mapping: |
        root = this

        # Map severity to priority
        root.priority = match root.severity {
          "CRITICAL" => "critical"
          "FATAL" => "critical"
          "ERROR" => "high"
          "WARNING" => "normal"
          "INFO" => "low"
          _ => "normal"
        }

        root.priority_score = match root.priority {
          "critical" => 85
          "high" => 60
          "normal" => 35
          "low" => 15
          _ => 0
        }

output:
  switch:
    cases:
      - check: this.priority == "critical"
        output:
          kafka:
            topic: logs-critical
            batching:
              count: 1        # Immediate delivery
              period: 0s      # No batching delay
            max_retries: 10   # Maximum reliability

      - check: this.priority == "high"
        output:
          kafka:
            topic: logs-high
            batching:
              count: 10       # Small batches
              period: 1s      # Fast delivery`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"customer_tier": "enterprise",', indent: 1, key: 'customer_tier', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed"', indent: 1, key: 'message', valueType: 'string' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": "2024-01-15T14:30:00Z",', indent: 1, key: 'timestamp', valueType: 'string' },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"customer_tier": "enterprise",', indent: 1, key: 'customer_tier', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"message": "Payment processing failed",', indent: 1, key: 'message', valueType: 'string' },
      { content: '"priority": "critical",', indent: 1, key: 'priority', valueType: 'string', type: 'highlighted' },
      { content: '"priority_score": 85,', indent: 1, key: 'priority_score', valueType: 'number', type: 'highlighted' },
      { content: '"routing_strategy": "severity-based"', indent: 1, key: 'routing_strategy', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Customer Tier Enhancement",
    description: "Customer subscription tier (enterprise, premium, standard, free) influences priority classification. Premium customers get faster processing even for routine messages.",
    yamlFilename: 'step-2-tier-enhancement.yaml',
    yamlCode: `# Enhanced priority with customer tier consideration
pipeline:
  processors:
    - mapping: |
        root = this

        # Calculate base severity score
        let severity_score = match root.severity {
          "CRITICAL" => 85
          "ERROR" => 60
          "WARNING" => 35
          "INFO" => 15
          _ => 20
        }

        # Customer tier multiplier
        let tier_multiplier = match root.customer_tier {
          "enterprise" => 4.0   # 4x boost
          "premium" => 3.0      # 3x boost
          "standard" => 2.0     # 2x boost
          "free" => 1.0         # No boost
          _ => 1.0
        }

        # Calculate final score
        root.priority_score = severity_score * tier_multiplier

        # Map to priority tier
        root.priority = match {
          root.priority_score >= 200 => "critical"
          root.priority_score >= 120 => "high"
          root.priority_score >= 60 => "normal"
          _ => "low"
        }

        # SLA targets by tier
        root.sla_target_ms = match root.customer_tier {
          "enterprise" => 100   # 100ms SLA
          "premium" => 500      # 500ms SLA
          "standard" => 2000    # 2s SLA
          _ => 5000            # 5s default
        }

output:
  switch:
    cases:
      - check: this.customer_tier == "enterprise" && this.priority == "critical"
        output:
          kafka:
            addresses: ["enterprise-kafka-1:9092","enterprise-kafka-2:9092"]
            topic: enterprise-critical-events
            batching:
              count: 1
              period: 0s
            max_retries: 15     # Extra retries for enterprise`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"customer_tier": "enterprise",', indent: 1, key: 'customer_tier', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"amount": 50000', indent: 1, key: 'amount', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"customer_tier": "enterprise",', indent: 1, key: 'customer_tier', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"amount": 50000,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"priority": "critical",', indent: 1, key: 'priority', valueType: 'string', type: 'highlighted' },
      { content: '"priority_score": 340,', indent: 1, key: 'priority_score', valueType: 'number', type: 'highlighted' },
      { content: '"sla_target_ms": 100,', indent: 1, key: 'sla_target_ms', valueType: 'number', type: 'highlighted' },
      { content: '"routing_strategy": "tier-enhanced"', indent: 1, key: 'routing_strategy', valueType: 'string', type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: "Multi-Criteria Scoring",
    description: "Sophisticated scoring algorithm combines severity, customer tier, event type, urgency, and business context into a numerical priority score for precise routing decisions.",
    yamlFilename: 'step-3-multi-criteria.yaml',
    yamlCode: `# Multi-criteria scoring with 6+ factors
pipeline:
  processors:
    - mapping: |
        root = this

        # Base severity score
        let severity_score = match root.severity {
          "CRITICAL" => 85, "ERROR" => 60,
          "WARNING" => 35, "INFO" => 15, _ => 20
        }

        # Customer tier multiplier
        let tier_multiplier = match root.customer_tier {
          "enterprise" => 4.0, "premium" => 3.0,
          "standard" => 2.0, "free" => 1.0, _ => 1.0
        }

        # Event type bonus
        let event_type_score = match {
          root.event_type.has_prefix("payment.failed") => 40
          root.event_type.has_prefix("security.") => 50
          root.event_type.has_prefix("auth.") => 45
          root.event_type.has_prefix("payment.") => 25
          _ => 10
        }

        # Urgency bonus
        let urgency_score = match root.urgency {
          "critical" => 20, "high" => 15,
          "normal" => 5, "low" => 0, _ => 5
        }

        # Service criticality
        let service_score = match root.service {
          "payment-service" => 30
          "auth-service" => 30
          "billing-service" => 25
          _ => 12
        }

        # Business hours boost
        let business_hours = now().hour() >= 9 && now().hour() < 17
        let temporal_score = if business_hours { 15 } else { 0 }

        # Final calculation
        let base_score = severity_score * tier_multiplier
        let bonus_score = event_type_score + urgency_score + service_score + temporal_score
        root.priority_score = base_score + bonus_score`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"customer_tier": "enterprise",', indent: 1, key: 'customer_tier', valueType: 'string' },
      { content: '"urgency": "high",', indent: 1, key: 'urgency', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"amount": 50000', indent: 1, key: 'amount', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"severity": "CRITICAL",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"event_type": "payment.failed",', indent: 1, key: 'event_type', valueType: 'string' },
      { content: '"customer_tier": "enterprise",', indent: 1, key: 'customer_tier', valueType: 'string' },
      { content: '"urgency": "high",', indent: 1, key: 'urgency', valueType: 'string' },
      { content: '"service": "payment-service",', indent: 1, key: 'service', valueType: 'string' },
      { content: '"amount": 50000,', indent: 1, key: 'amount', valueType: 'number' },
      { content: '"priority": "critical",', indent: 1, key: 'priority', valueType: 'string', type: 'highlighted' },
      { content: '"priority_score": 430,', indent: 1, key: 'priority_score', valueType: 'number', type: 'highlighted' },
      { content: '"routing_strategy": "multi-criteria-scoring",', indent: 1, key: 'routing_strategy', valueType: 'string', type: 'highlighted' },
      { content: '"scoring_breakdown": {', indent: 1, type: 'highlighted' },
      { content: '"severity_score": 85,', indent: 2, key: 'severity_score', valueType: 'number', type: 'highlighted' },
      { content: '"tier_multiplier": 4.0,', indent: 2, key: 'tier_multiplier', valueType: 'number', type: 'highlighted' },
      { content: '"event_type_boost": 40,', indent: 2, key: 'event_type_boost', valueType: 'number', type: 'highlighted' },
      { content: '"urgency_boost": 15,', indent: 2, key: 'urgency_boost', valueType: 'number', type: 'highlighted' },
      { content: '"final_score": 430', indent: 2, key: 'final_score', valueType: 'number', type: 'highlighted' },
      { content: '}', indent: 1, type: 'highlighted' },
      { content: '}', indent: 0 },
    ],
  },
];
