import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const priorityQueuesStages: Stage[] = [
  {
    title: "Original Input",
    description: "All messages flow through a single processing path regardless of importance. Critical alerts compete with routine logs, causing latency spikes and SLA violations.",
    inputData: `{
  "timestamp": "2024-01-15T14:30:00Z",
  "severity": "CRITICAL", 
  "event_type": "payment.failed",
  "customer_tier": "enterprise",
  "urgency": "high",
  "service": "payment-service",
  "message": "Payment processing failed",
  "customer_id": "enterprise_123",
  "amount": 50000
}`,
    outputData: `{
  "timestamp": "2024-01-15T14:30:00Z",
  "severity": "CRITICAL",
  "event_type": "payment.failed", 
  "customer_tier": "enterprise",
  "urgency": "high",
  "service": "payment-service",
  "message": "Payment processing failed",
  "customer_id": "enterprise_123",
  "amount": 50000,
  "processed_at": "2024-01-15T14:30:01Z"
}`,
    yamlConfig: `# No priority routing - all messages treated equally
output:
  kafka:
    addresses: ["kafka-broker-1:9092","kafka-broker-2:9092"]
    topic: all-events
    batching:
      count: 100      # Same batching for all
      period: 30s     # Same delay for all
    max_retries: 3    # Same reliability for all`,
    changes: [
      {
        type: "add",
        description: "Processing timestamp added",
        field: "processed_at"
      }
    ]
  },

  {
    title: "Severity-Based Routing", 
    description: "Messages are classified by log severity (CRITICAL, ERROR, WARNING, INFO) and routed to dedicated queues with appropriate batching policies. Critical messages bypass batching entirely.",
    inputData: `{
  "timestamp": "2024-01-15T14:30:00Z", 
  "severity": "CRITICAL",
  "event_type": "payment.failed",
  "customer_tier": "enterprise", 
  "urgency": "high",
  "service": "payment-service",
  "message": "Payment processing failed",
  "customer_id": "enterprise_123",
  "amount": 50000
}`,
    outputData: `{
  "timestamp": "2024-01-15T14:30:00Z",
  "severity": "CRITICAL",
  "event_type": "payment.failed",
  "customer_tier": "enterprise",
  "urgency": "high", 
  "service": "payment-service",
  "message": "Payment processing failed",
  "customer_id": "enterprise_123",
  "amount": 50000,
  "priority": "critical",
  "priority_score": 85,
  "routing_strategy": "severity-based",
  "processed_at": "2024-01-15T14:30:01Z"
}`,
    yamlConfig: `# Severity-based priority classification
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
    changes: [
      {
        type: "add",
        description: "Priority classification based on severity", 
        field: "priority"
      },
      {
        type: "add", 
        description: "Numerical priority score for monitoring",
        field: "priority_score"
      },
      {
        type: "modify",
        description: "Routing strategy specified",
        field: "routing_strategy"
      }
    ]
  },

  {
    title: "Customer Tier Enhancement",
    description: "Customer subscription tier (enterprise, premium, standard, free) influences priority classification. Premium customers get faster processing even for routine messages.",
    inputData: `{
  "timestamp": "2024-01-15T14:30:00Z",
  "severity": "CRITICAL", 
  "event_type": "payment.failed",
  "customer_tier": "enterprise",
  "urgency": "high",
  "service": "payment-service", 
  "message": "Payment processing failed",
  "customer_id": "enterprise_123",
  "amount": 50000
}`,
    outputData: `{
  "timestamp": "2024-01-15T14:30:00Z",
  "severity": "CRITICAL",
  "event_type": "payment.failed", 
  "customer_tier": "enterprise",
  "urgency": "high",
  "service": "payment-service",
  "message": "Payment processing failed",
  "customer_id": "enterprise_123", 
  "amount": 50000,
  "priority": "critical",
  "priority_score": 340,
  "sla_target_ms": 100,
  "routing_strategy": "tier-enhanced",
  "processed_at": "2024-01-15T14:30:01Z",
  "routing_breakdown": {
    "severity_score": 85,
    "tier_multiplier": 4.0,
    "final_score": 340
  }
}`,
    yamlConfig: `# Enhanced priority with customer tier consideration
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
    changes: [
      {
        type: "modify",
        description: "Priority score boosted by customer tier (85 → 340)",
        field: "priority_score" 
      },
      {
        type: "add",
        description: "SLA target based on customer tier",
        field: "sla_target_ms"
      },
      {
        type: "add", 
        description: "Routing decision breakdown for transparency",
        field: "routing_breakdown"
      }
    ]
  },

  {
    title: "Multi-Criteria Scoring",
    description: "Sophisticated scoring algorithm combines severity, customer tier, event type, urgency, and business context into a numerical priority score for precise routing decisions.",
    inputData: `{
  "timestamp": "2024-01-15T14:30:00Z",
  "severity": "CRITICAL",
  "event_type": "payment.failed", 
  "customer_tier": "enterprise",
  "urgency": "high",
  "service": "payment-service",
  "message": "Payment processing failed",
  "customer_id": "enterprise_123",
  "amount": 50000
}`,
    outputData: `{
  "timestamp": "2024-01-15T14:30:00Z", 
  "severity": "CRITICAL",
  "event_type": "payment.failed",
  "customer_tier": "enterprise",
  "urgency": "high",
  "service": "payment-service",
  "message": "Payment processing failed",
  "customer_id": "enterprise_123",
  "amount": 50000,
  "priority": "critical",
  "priority_score": 430,
  "sla_target_ms": 100,
  "routing_strategy": "multi-criteria-scoring",
  "processed_at": "2024-01-15T14:30:01Z",
  "scoring_breakdown": {
    "severity_score": 85,
    "tier_multiplier": 4.0,
    "weighted_base": 340,
    "event_type_boost": 40,
    "urgency_boost": 15,
    "service_boost": 30,
    "business_hours_boost": 15,
    "final_score": 430
  }
}`,
    yamlConfig: `# Multi-criteria scoring with 6+ factors
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
    changes: [
      {
        type: "modify",
        description: "Priority score enhanced with event type, urgency, service criticality (340 → 430)",
        field: "priority_score"
      },
      {
        type: "add",
        description: "Comprehensive scoring breakdown showing all factors",
        field: "scoring_breakdown"
      },
      {
        type: "modify", 
        description: "Routing strategy updated to multi-criteria",
        field: "routing_strategy"
      }
    ]
  }
];
