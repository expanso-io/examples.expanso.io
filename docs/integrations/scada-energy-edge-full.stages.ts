import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const scadaEnergyEdgeStages: Stage[] = [
  {
    id: 1,
    title: "Raw Modbus Register Data",
    description: "Raw telemetry from substation RTUs via Modbus TCP. At 50,000 readings/minute across dozens of RTUs, shipping all of this to the SCADA historian burns bandwidth and violates NERC CIP data minimization principles. These are raw register values — still need scaling, mapping, and normalization.",
    yamlFilename: "scada-input.yaml",
    yamlCode: `input:
  socket:
    network: tcp
    address: 0.0.0.0:502
    codec: lines`,
    inputLines: [
      { content: 'REG=40001;VAL=14823;UNIT=V_x100;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
      { content: 'REG=40003;VAL=2341;UNIT=A_x10;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
      { content: 'REG=40005;VAL=6001;UNIT=Hz_x100;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
      { content: 'REG=40007;VAL=423;UNIT=degC_x10;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
      { content: 'REG=40009;VAL=2847;UNIT=MW_x10;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
    ],
    outputLines: [
      { content: 'REG=40001;VAL=14823;UNIT=V_x100;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
      { content: 'REG=40003;VAL=2341;UNIT=A_x10;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
      { content: 'REG=40005;VAL=6001;UNIT=Hz_x100;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
      { content: 'REG=40007;VAL=423;UNIT=degC_x10;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
      { content: 'REG=40009;VAL=2847;UNIT=MW_x10;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
    ],
  },
  {
    id: 2,
    title: "Parse & Normalize Registers",
    description: "Decode raw Modbus register addresses to human-readable field names and apply scaling factors. REG 40001 = voltage (÷100 for kV), REG 40003 = current (÷10 for A), REG 40005 = frequency (÷100 for Hz), REG 40007 = temperature (÷10 for °C), REG 40009 = power (÷10 for MW). Adds substation metadata from environment.",
    yamlFilename: "scada-step-1-parse.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        # Parse semicolon-delimited Modbus register data
        let fields = content().string().split(";").fold({}, (acc, item) -> {
          let parts = item.split("=")
          acc | { parts[0]: parts[1] }
        })
        
        let reg = fields.REG.number()
        let val = fields.VAL.number()
        
        # Map register addresses to field names with scaling
        root.voltage_kv    = if reg == 40001 { val / 100.0 } else { deleted() }
        root.current_a     = if reg == 40003 { val / 10.0 }  else { deleted() }
        root.frequency_hz  = if reg == 40005 { val / 100.0 } else { deleted() }
        root.temp_c        = if reg == 40007 { val / 10.0 }  else { deleted() }
        root.power_mw      = if reg == 40009 { val / 10.0 }  else { deleted() }
        
        # Device and substation metadata
        root.device_id      = fields.DEVICE
        root.register       = reg
        root.raw_value      = val
        root.status         = fields.STATUS.number()
        root.substation_id  = env("SUBSTATION_ID").or("SUB-CENTRAL-01")
        root.region         = env("GRID_REGION").or("WECC-SOUTHWEST")
        root."@timestamp"   = fields.TS.number()`,
    inputLines: [
      { content: 'REG=40001;VAL=14823;UNIT=V_x100;TS=1708290845;DEVICE=RTU-07A;STATUS=0', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      { content: '"voltage_kv": 148.23,', indent: 1, key: 'voltage_kv', valueType: 'number', type: 'added' },
      { content: '"device_id": "RTU-07A",', indent: 1, key: 'device_id', valueType: 'string', type: 'added' },
      { content: '"register": 40001,', indent: 1, key: 'register', valueType: 'number', type: 'added' },
      { content: '"raw_value": 14823,', indent: 1, key: 'raw_value', valueType: 'number', type: 'added' },
      { content: '"status": 0,', indent: 1, key: 'status', valueType: 'number', type: 'added' },
      { content: '"substation_id": "SUB-CENTRAL-01",', indent: 1, key: 'substation_id', valueType: 'string', type: 'added' },
      { content: '"region": "WECC-SOUTHWEST",', indent: 1, key: 'region', valueType: 'string', type: 'added' },
      { content: '"@timestamp": 1708290845', indent: 1, key: '@timestamp', valueType: 'number', type: 'added' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    title: "Filter Noise + Classify Faults",
    description: "Drop readings within normal NERC reliability bands — voltage 110–145 kV (±10% of 132 kV nominal), frequency 59.95–60.05 Hz (±0.5% NERC standard), temperature below 75°C. Only anomalies survive. Each anomaly gets classified: VOLTAGE_DEVIATION, FREQUENCY_DRIFT, THERMAL_OVERLOAD. Result: 83% of readings filtered at the edge, never shipped to historian.",
    yamlFilename: "scada-step-2-filter-classify.yaml",
    yamlCode: `pipeline:
  processors:
    - mapping: |
        # Filter: drop readings within normal operating bounds
        if this.voltage_kv >= 110.0 && this.voltage_kv <= 145.0 &&
           this.frequency_hz >= 59.95 && this.frequency_hz <= 60.05 &&
           this.temp_c <= 75.0 {
          root = deleted()
        }
        
        # Classify fault type for surviving anomalies
        root.fault_type = match {
          this.voltage_kv < 110.0 || this.voltage_kv > 145.0 => "VOLTAGE_DEVIATION"
          this.frequency_hz < 59.95 || this.frequency_hz > 60.05 => "FREQUENCY_DRIFT"
          this.temp_c > 75.0 => "THERMAL_OVERLOAD"
          _ => "NOMINAL"
        }
        root.severity      = if this.fault_type == "NOMINAL" { "info" } else { "critical" }
        root.alert_required = this.fault_type != "NOMINAL"`,
    inputLines: [
      { content: '[6 readings total — 1 voltage spike, 5 nominal]', indent: 0, type: 'comment' },
      { content: '• RTU-07A REG=40001 voltage_kv: 148.23  ✓ NORMAL', indent: 0, type: 'removed' },
      { content: '• RTU-07A REG=40003 current_a: 234.1    ✓ NORMAL', indent: 0, type: 'removed' },
      { content: '• RTU-07A REG=40005 frequency_hz: 60.01 ✓ NORMAL', indent: 0, type: 'removed' },
      { content: '• RTU-07A REG=40007 temp_c: 42.3        ✓ NORMAL', indent: 0, type: 'removed' },
      { content: '• RTU-07A REG=40001 voltage_kv: 104.5   ✗ UNDERVOLTAGE', indent: 0, type: 'highlighted' },
      { content: '• RTU-07A REG=40009 power_mw: 284.7     ✓ NORMAL', indent: 0, type: 'removed' },
    ],
    outputLines: [
      { content: '[1 anomaly passed — 5 of 6 filtered (83% reduction)]', indent: 0, type: 'highlighted' },
      { content: '{', indent: 0 },
      { content: '"voltage_kv": 104.5,', indent: 1, key: 'voltage_kv', valueType: 'number' },
      { content: '"device_id": "RTU-07A",', indent: 1, key: 'device_id', valueType: 'string' },
      { content: '"substation_id": "SUB-CENTRAL-01",', indent: 1, key: 'substation_id', valueType: 'string' },
      { content: '"fault_type": "VOLTAGE_DEVIATION",', indent: 1, key: 'fault_type', valueType: 'string', type: 'added' },
      { content: '"severity": "critical",', indent: 1, key: 'severity', valueType: 'string', type: 'added' },
      { content: '"alert_required": true', indent: 1, key: 'alert_required', valueType: 'boolean', type: 'added' },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    title: "Route to Multiple Destinations",
    description: "Critical faults go to both the SCADA historian (for event record) and PagerDuty (for immediate operator alert). Normal KPI summaries go to the Grafana cloud dashboard. Sensitive topology fields (bus topology, protection relay config) are stripped before any data leaves the substation — NERC CIP §R1.4 compliance by design.",
    yamlFilename: "scada-step-3-route.yaml",
    yamlCode: `output:
  switch:
    cases:
      - check: this.alert_required == true
        output:
          broker:
            outputs:
              - http_client:
                  url: "\${SCADA_HISTORIAN_URL}"
                  verb: POST
                  headers:
                    Content-Type: "application/json"
              - http_client:
                  url: "\${PAGERDUTY_WEBHOOK_URL}"
                  verb: POST
                  headers:
                    Content-Type: "application/json"
      - output:
          http_client:
            url: "\${GRAFANA_CLOUD_URL}"
            verb: POST
            headers:
              Content-Type: "application/json"`,
    inputLines: [
      { content: '[2 events ready for routing]', indent: 0, type: 'comment' },
      { content: '{', indent: 0 },
      { content: '"voltage_kv": 104.5,', indent: 1, key: 'voltage_kv', valueType: 'number' },
      { content: '"fault_type": "VOLTAGE_DEVIATION",', indent: 1, key: 'fault_type', valueType: 'string' },
      { content: '"severity": "critical",', indent: 1, key: 'severity', valueType: 'string' },
      { content: '"alert_required": true', indent: 1, key: 'alert_required', valueType: 'boolean' },
      { content: '}', indent: 0 },
      { content: '{ "power_mw": 284.7, "alert_required": false, ... }', indent: 0, type: 'comment' },
    ],
    outputLines: [
      { content: '# Critical fault → SCADA historian + PagerDuty', indent: 0, type: 'highlighted' },
      { content: '→ SCADA_HISTORIAN_URL  [voltage_kv: 104.5, VOLTAGE_DEVIATION]', indent: 0, type: 'highlighted' },
      { content: '→ PAGERDUTY_WEBHOOK    [🚨 alert_required: true]', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '# KPI summary → Grafana cloud dashboard', indent: 0, type: 'highlighted' },
      { content: '→ GRAFANA_CLOUD_URL    [power_mw: 284.7, severity: info]', indent: 0, type: 'highlighted' },
      { content: '', indent: 0 },
      { content: '# Sensitive topology fields stripped (NERC CIP §R1.4)', indent: 0, type: 'highlighted' },
      { content: '✓ bus_topology: [REDACTED — stays local]', indent: 0 },
      { content: '✓ relay_config: [REDACTED — stays local]', indent: 0 },
    ],
  },
];
