import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const oranTelcoPipelineStages: Stage[] = [
  {
    id: 1,
    title: "Raw DU Metrics",
    description: "Raw telemetry data from O-RAN DU nodes including PTP timing, PRB utilization, and CPU metrics. This unstructured data needs normalization and enrichment before routing to multiple destinations.",
    yamlFilename: "oran-input.yaml",
    yamlCode: `input:
  prometheus_input:
    url: "http://localhost:9090/api/v1/query_range"
    query: "up{job=~'du-.*'}"
    interval: 30s
    endpoint_metadata: true`,
    inputLines: [
      { content: 'PTP4L_OFFSET=-45ns;CPU_PERCENT=67.2;PRB_DL_UTIL=82.1;PRB_UL_UTIL=34.5;RSRP=-89dBm;SINR=18.3dB;TIMESTAMP=1705315845', indent: 0 },
      { content: 'PTP4L_OFFSET=156ns;CPU_PERCENT=89.4;PRB_DL_UTIL=95.7;PRB_UL_UTIL=88.2;RSRP=-102dBm;SINR=12.1dB;TIMESTAMP=1705315875', indent: 0 },
      { content: 'PTP4L_OFFSET=-12ns;CPU_PERCENT=45.8;PRB_DL_UTIL=23.4;PRB_UL_UTIL=15.9;RSRP=-78dBm;SINR=24.7dB;TIMESTAMP=1705315905', indent: 0 },
    ],
    outputLines: [
      { content: 'PTP4L_OFFSET=-45ns;CPU_PERCENT=67.2;PRB_DL_UTIL=82.1;PRB_UL_UTIL=34.5;RSRP=-89dBm;SINR=18.3dB;TIMESTAMP=1705315845', indent: 0 },
      { content: 'PTP4L_OFFSET=156ns;CPU_PERCENT=89.4;PRB_DL_UTIL=95.7;PRB_UL_UTIL=88.2;RSRP=-102dBm;SINR=12.1dB;TIMESTAMP=1705315875', indent: 0 },
      { content: 'PTP4L_OFFSET=-12ns;CPU_PERCENT=45.8;PRB_DL_UTIL=23.4;PRB_UL_UTIL=15.9;RSRP=-78dBm;SINR=24.7dB;TIMESTAMP=1705315905', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Parse & Normalize Metrics",
    description: "Extract and normalize O-RAN telemetry into structured JSON format with proper data types and units. This enables downstream systems to consume metrics consistently.",
    yamlFilename: "oran-step-1-parse.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        # Parse semicolon-delimited metrics
        let metrics = content().split(";").fold({}, (acc, item) -> {
          let parts = item.split("=")
          acc | { parts[0]: parts[1] }
        })
        
        # Normalize to structured format
        root.timestamp = metrics.TIMESTAMP.number()
        root.ptp_offset_ns = metrics.PTP4L_OFFSET.re_replace_all("ns$", "").number()
        root.cpu_percent = metrics.CPU_PERCENT.number()
        root.prb_dl_util_percent = metrics.PRB_DL_UTIL.number()
        root.prb_ul_util_percent = metrics.PRB_UL_UTIL.number()
        root.rsrp_dbm = metrics.RSRP.re_replace_all("dBm$", "").number()
        root.sinr_db = metrics.SINR.re_replace_all("dB$", "").number()`,
    inputLines: [
      { content: 'PTP4L_OFFSET=156ns;CPU_PERCENT=89.4;PRB_DL_UTIL=95.7;PRB_UL_UTIL=88.2;RSRP=-102dBm;SINR=12.1dB;TIMESTAMP=1705315875', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": 1705315875,', indent: 1, key: 'timestamp', valueType: 'number', type: 'added' },
      { content: '"ptp_offset_ns": 156,', indent: 1, key: 'ptp_offset_ns', valueType: 'number', type: 'added' },
      { content: '"cpu_percent": 89.4,', indent: 1, key: 'cpu_percent', valueType: 'number', type: 'added' },
      { content: '"prb_dl_util_percent": 95.7,', indent: 1, key: 'prb_dl_util_percent', valueType: 'number', type: 'added' },
      { content: '"prb_ul_util_percent": 88.2,', indent: 1, key: 'prb_ul_util_percent', valueType: 'number', type: 'added' },
      { content: '"rsrp_dbm": -102,', indent: 1, key: 'rsrp_dbm', valueType: 'number', type: 'added' },
      { content: '"sinr_db": 12.1', indent: 1, key: 'sinr_db', valueType: 'number', type: 'added' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Enrich with Cell Metadata",
    description: "Add cell site information, compliance status, and operational context using lookup tables and environmental data. This enables proper routing and alerting.",
    yamlFilename: "oran-step-2-enrich.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        root = this
        
        # Add cell site metadata (from env or lookup)
        root.cell_id = env("CELL_ID").or("DU_001")
        root.site_name = env("SITE_NAME").or("tower-downtown-01")
        root.region = "northeast"
        
        # Calculate compliance status
        root.ptp_compliant = this.ptp_offset_ns >= -100 && this.ptp_offset_ns <= 100
        root.ptp_status = if this.ptp_offset_ns >= -100 && this.ptp_offset_ns <= 100 {
          "compliant"
        } else if this.ptp_offset_ns >= -1000 && this.ptp_offset_ns <= 1000 {
          "degraded" 
        } else {
          "critical"
        }
        
        # Add operational flags
        root.prb_congested = this.prb_dl_util_percent > 90 || this.prb_ul_util_percent > 90
        root.cpu_alert = this.cpu_percent > 80`,
    inputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": 1705315875,', indent: 1, key: 'timestamp', valueType: 'number' },
      { content: '"ptp_offset_ns": 156,', indent: 1, key: 'ptp_offset_ns', valueType: 'number' },
      { content: '"cpu_percent": 89.4,', indent: 1, key: 'cpu_percent', valueType: 'number' },
      { content: '"prb_dl_util_percent": 95.7,', indent: 1, key: 'prb_dl_util_percent', valueType: 'number' },
      { content: '"prb_ul_util_percent": 88.2,', indent: 1, key: 'prb_ul_util_percent', valueType: 'number' },
      { content: '"rsrp_dbm": -102,', indent: 1, key: 'rsrp_dbm', valueType: 'number' },
      { content: '"sinr_db": 12.1', indent: 1, key: 'sinr_db', valueType: 'number' },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"timestamp": 1705315875,', indent: 1, key: 'timestamp', valueType: 'number' },
      { content: '"ptp_offset_ns": 156,', indent: 1, key: 'ptp_offset_ns', valueType: 'number' },
      { content: '"cpu_percent": 89.4,', indent: 1, key: 'cpu_percent', valueType: 'number' },
      { content: '"prb_dl_util_percent": 95.7,', indent: 1, key: 'prb_dl_util_percent', valueType: 'number' },
      { content: '"prb_ul_util_percent": 88.2,', indent: 1, key: 'prb_ul_util_percent', valueType: 'number' },
      { content: '"rsrp_dbm": -102,', indent: 1, key: 'rsrp_dbm', valueType: 'number' },
      { content: '"sinr_db": 12.1,', indent: 1, key: 'sinr_db', valueType: 'number' },
      { content: '"cell_id": "DU_001",', indent: 1, key: 'cell_id', valueType: 'string', type: 'added' },
      { content: '"site_name": "tower-downtown-01",', indent: 1, key: 'site_name', valueType: 'string', type: 'added' },
      { content: '"region": "northeast",', indent: 1, key: 'region', valueType: 'string', type: 'added' },
      { content: '"ptp_compliant": false,', indent: 1, key: 'ptp_compliant', valueType: 'boolean', type: 'added' },
      { content: '"ptp_status": "degraded",', indent: 1, key: 'ptp_status', valueType: 'string', type: 'added' },
      { content: '"prb_congested": true,', indent: 1, key: 'prb_congested', valueType: 'boolean', type: 'added' },
      { content: '"cpu_alert": true', indent: 1, key: 'cpu_alert', valueType: 'boolean', type: 'added' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: "Filter Anomalies & Alerts",
    description: "Filter telemetry based on thresholds and compliance status. Only anomalies and alerts are sent to high-priority destinations, reducing noise and costs.",
    yamlFilename: "oran-step-3-filter.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        # Only pass through anomalies and alerts
        if !(this.ptp_status == "critical" || this.prb_congested || this.cpu_alert) {
          root = deleted()
        }
        
        # Add severity classification for routing
        root.severity = if this.ptp_status == "critical" {
          "critical"
        } else if this.cpu_alert {
          "high"
        } else if this.prb_congested {
          "medium"
        } else {
          "low"
        }
        
        root.alert_type = []
        if this.ptp_status == "critical" {
          root.alert_type = this.alert_type.append("timing_violation")
        }
        if this.cpu_alert {
          root.alert_type = this.alert_type.append("resource_exhaustion")
        }
        if this.prb_congested {
          root.alert_type = this.alert_type.append("congestion")
        }`,
    inputLines: [
      { content: '[3 metrics total]', indent: 0, type: 'comment' },
      { content: '• DU_001: PTP degraded, PRB congested, CPU alert', indent: 0, type: 'highlighted' },
      { content: '• DU_002: All normal (filtered out)', indent: 0, type: 'removed' },
      { content: '• DU_003: PTP critical', indent: 0, type: 'highlighted' },
    ],
    outputLines: [
      { content: '[2 anomalies detected - 33% noise reduction]', indent: 0, type: 'highlighted' },
      { content: '• DU_001: Severity HIGH - congestion + resource alerts', indent: 0 },
      { content: '• DU_003: Severity CRITICAL - timing violation', indent: 0 },
      { content: '', indent: 0 },
      { content: '🚨 Alert types: timing_violation, resource_exhaustion, congestion', indent: 0, type: 'highlighted' },
    ],
  },
  {
    id: 5,
    title: "Multi-Destination Output",
    description: "Fan-out alerts and metrics to multiple destinations simultaneously: real-time Grafana dashboards, Parquet storage for analytics, and direct integration with NOC systems.",
    yamlFilename: "oran-output.yaml",
    yamlCode: `output:
  broker:
    outputs:
      # Real-time dashboard (Grafana/Prometheus)
      - http:
          url: "http://prometheus-pushgateway:9091/metrics/job/oran-telemetry"
          verb: POST
          headers:
            Content-Type: "application/json"
      
      # Long-term analytics (Parquet)
      - file:
          path: "/data/oran-metrics/\${!timestamp_unix()}.parquet"
          format: "parquet"
          batching:
            count: 1000
            period: 300s
      
      # ML/AI platform (Cloudera)
      - kafka:
          addresses: ["kafka.cloudera.internal:9092"]
          topic: "oran-telemetry-alerts"
          partition: "round_robin"`,
    inputLines: [
      { content: '[Filtered anomalies ready for routing]', indent: 0 },
    ],
    outputLines: [
      { content: '# Destination 1: Grafana/Prometheus (Real-time)', indent: 0, type: 'highlighted' },
      { content: '# → Real-time NOC dashboards and alerting', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '# Destination 2: Parquet Storage (Analytics)', indent: 0, type: 'highlighted' },
      { content: '# → Long-term capacity planning and ML training', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '# Destination 3: Cloudera Kafka (ML/AI)', indent: 0, type: 'highlighted' },
      { content: '# → Predictive analytics and anomaly detection', indent: 0, type: 'highlighted' },
    ],
  }
];