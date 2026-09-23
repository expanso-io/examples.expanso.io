import type { Stage } from '@site/src/components/DataPipelineExplorer/types';

export const oranTelcoPipelineStages: Stage[] = [
  {
    id: 1,
    slug: 'adapter-output',
    title: 'Adapter output',
    description:
      'Inspect authored telemetry after a site-specific exporter has decoded and emitted it. No O-RAN protocol collection occurs in this stage.',
    inputLines: [
      {
        content:
          'PTP4L_OFFSET=-45ns;CPU_PERCENT=67.2;PRB_DL_UTIL=82.1;PRB_UL_UTIL=34.5;RSRP=-89dBm;SINR=18.3dB;TIMESTAMP=1705315845',
        indent: 0,
      },
      {
        content:
          'PTP4L_OFFSET=156ns;CPU_PERCENT=89.4;PRB_DL_UTIL=95.7;PRB_UL_UTIL=88.2;RSRP=-102dBm;SINR=12.1dB;TIMESTAMP=1705315875',
        indent: 0,
      },
      {
        content:
          'PTP4L_OFFSET=-12ns;CPU_PERCENT=45.8;PRB_DL_UTIL=23.4;PRB_UL_UTIL=15.9;RSRP=-78dBm;SINR=24.7dB;TIMESTAMP=1705315905',
        indent: 0,
      },
    ],
    outputLines: [
      {
        content:
          'PTP4L_OFFSET=-45ns;CPU_PERCENT=67.2;PRB_DL_UTIL=82.1;PRB_UL_UTIL=34.5;RSRP=-89dBm;SINR=18.3dB;TIMESTAMP=1705315845',
        indent: 0,
      },
      {
        content:
          'PTP4L_OFFSET=156ns;CPU_PERCENT=89.4;PRB_DL_UTIL=95.7;PRB_UL_UTIL=88.2;RSRP=-102dBm;SINR=12.1dB;TIMESTAMP=1705315875',
        indent: 0,
      },
      {
        content:
          'PTP4L_OFFSET=-12ns;CPU_PERCENT=45.8;PRB_DL_UTIL=23.4;PRB_UL_UTIL=15.9;RSRP=-78dBm;SINR=24.7dB;TIMESTAMP=1705315905',
        indent: 0,
      },
    ],
  },
  {
    id: 2,
    slug: 'parse-authored-fields',
    title: 'Parse authored fields',
    description:
      'Split the example record and convert its authored values into a typed JSON shape.',
    inputLines: [
      {
        content:
          'PTP4L_OFFSET=156ns;CPU_PERCENT=89.4;PRB_DL_UTIL=95.7;PRB_UL_UTIL=88.2;RSRP=-102dBm;SINR=12.1dB;TIMESTAMP=1705315875',
        indent: 0,
      },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      {
        content: '"timestamp": 1705315875,',
        indent: 1,
        key: 'timestamp',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"ptp_offset_ns": 156,',
        indent: 1,
        key: 'ptp_offset_ns',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"cpu_percent": 89.4,',
        indent: 1,
        key: 'cpu_percent',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"prb_dl_util_percent": 95.7,',
        indent: 1,
        key: 'prb_dl_util_percent',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"prb_ul_util_percent": 88.2,',
        indent: 1,
        key: 'prb_ul_util_percent',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"rsrp_dbm": -102,',
        indent: 1,
        key: 'rsrp_dbm',
        valueType: 'number',
        type: 'added',
      },
      {
        content: '"sinr_db": 12.1',
        indent: 1,
        key: 'sinr_db',
        valueType: 'number',
        type: 'added',
      },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 3,
    slug: 'add-review-metadata',
    title: 'Add review metadata',
    description:
      'Add configured site identifiers and label values against authored review bands.',
    inputLines: [
      { content: '{', indent: 0 },
      {
        content: '"timestamp": 1705315875,',
        indent: 1,
        key: 'timestamp',
        valueType: 'number',
      },
      {
        content: '"ptp_offset_ns": 156,',
        indent: 1,
        key: 'ptp_offset_ns',
        valueType: 'number',
      },
      {
        content: '"cpu_percent": 89.4,',
        indent: 1,
        key: 'cpu_percent',
        valueType: 'number',
      },
      {
        content: '"prb_dl_util_percent": 95.7,',
        indent: 1,
        key: 'prb_dl_util_percent',
        valueType: 'number',
      },
      {
        content: '"prb_ul_util_percent": 88.2,',
        indent: 1,
        key: 'prb_ul_util_percent',
        valueType: 'number',
      },
      {
        content: '"rsrp_dbm": -102,',
        indent: 1,
        key: 'rsrp_dbm',
        valueType: 'number',
      },
      {
        content: '"sinr_db": 12.1',
        indent: 1,
        key: 'sinr_db',
        valueType: 'number',
      },
      { content: '}', indent: 0 },
    ],
    outputLines: [
      { content: '{', indent: 0 },
      {
        content: '"timestamp": 1705315875,',
        indent: 1,
        key: 'timestamp',
        valueType: 'number',
      },
      {
        content: '"ptp_offset_ns": 156,',
        indent: 1,
        key: 'ptp_offset_ns',
        valueType: 'number',
      },
      {
        content: '"cpu_percent": 89.4,',
        indent: 1,
        key: 'cpu_percent',
        valueType: 'number',
      },
      {
        content: '"prb_dl_util_percent": 95.7,',
        indent: 1,
        key: 'prb_dl_util_percent',
        valueType: 'number',
      },
      {
        content: '"prb_ul_util_percent": 88.2,',
        indent: 1,
        key: 'prb_ul_util_percent',
        valueType: 'number',
      },
      {
        content: '"rsrp_dbm": -102,',
        indent: 1,
        key: 'rsrp_dbm',
        valueType: 'number',
      },
      {
        content: '"sinr_db": 12.1,',
        indent: 1,
        key: 'sinr_db',
        valueType: 'number',
      },
      {
        content: '"cell_id": "DU_001",',
        indent: 1,
        key: 'cell_id',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"site_name": "tower-downtown-01",',
        indent: 1,
        key: 'site_name',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"region": "northeast",',
        indent: 1,
        key: 'region',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"within_example_timing_band": false,',
        indent: 1,
        key: 'within_example_timing_band',
        valueType: 'boolean',
        type: 'added',
      },
      {
        content: '"timing_review": "review",',
        indent: 1,
        key: 'timing_review',
        valueType: 'string',
        type: 'added',
      },
      {
        content: '"prb_review": true,',
        indent: 1,
        key: 'prb_review',
        valueType: 'boolean',
        type: 'added',
      },
      {
        content: '"cpu_review": true',
        indent: 1,
        key: 'cpu_review',
        valueType: 'boolean',
        type: 'added',
      },
      { content: '}', indent: 0 },
    ],
  },
  {
    id: 4,
    slug: 'select-review-candidates',
    title: 'Select review candidates',
    description:
      'Retain records that match at least one authored review condition. The labels do not diagnose network state.',
    inputLines: [
      { content: '[Authored telemetry fixture]', indent: 0, type: 'comment' },
      {
        content: '• DU_001: matches PRB and CPU review bands',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '• DU_002: no authored condition matched',
        indent: 0,
        type: 'removed',
      },
      {
        content: '• DU_003: matches timing review band',
        indent: 0,
        type: 'highlighted',
      },
    ],
    outputLines: [
      {
        content: '[Records retained for review]',
        indent: 0,
        type: 'highlighted',
      },
      { content: '• DU_001: prb-band + cpu-band', indent: 0 },
      { content: '• DU_003: timing-band', indent: 0 },
      { content: '', indent: 0 },
      {
        content: 'Review reasons are authored routing labels.',
        indent: 0,
        type: 'highlighted',
      },
    ],
  },
  {
    id: 5,
    slug: 'external-destinations',
    title: 'External destinations',
    description:
      'Inspect separate output shapes for observability, storage, and analytics services. Each service remains an external boundary.',
    inputLines: [
      { content: '[Filtered anomalies ready for routing]', indent: 0 },
    ],
    outputLines: [
      {
        content: '# External observability receiver',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '# → Contract and authentication require validation',
        indent: 0,
        type: 'highlighted',
      },
      { content: '', indent: 0 },
      { content: '# External object storage', indent: 0, type: 'highlighted' },
      {
        content: '# → Encoding and recovery require validation',
        indent: 0,
        type: 'highlighted',
      },
      { content: '', indent: 0 },
      {
        content: '# External analytics broker',
        indent: 0,
        type: 'highlighted',
      },
      {
        content: '# → Delivery and schema require validation',
        indent: 0,
        type: 'highlighted',
      },
    ],
  },
];
