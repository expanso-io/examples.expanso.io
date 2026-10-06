import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';

import { PUBLIC_CATALOG } from '../src/catalog/registry';
import {
  FEATURE_CATEGORIES,
  inventoryYamlSource,
  tutorialYamlBlocks,
  type FeatureCategory,
  type FeatureInventory,
} from './platform-feature-inventory';

const baselineCommit = 'd167350ffad085c267b1bbe884c5b28b6f95d03b';
const manifestPath = 'content/platform-feature-baseline-v1.json';

type Exception = { feature: string; reason: string };

type Family = {
  exampleId: string;
  files: string[];
  baselineSha256: string;
  baseline: FeatureInventory;
  exceptions: Partial<Record<FeatureCategory, Exception[]>>;
};

function sha256(source: string): string {
  return `sha256:${createHash('sha256').update(source).digest('hex')}`;
}

function lines(output: string): string[] {
  return output.trim().split('\n').filter(Boolean);
}

function baselineFiles(): string[] {
  return lines(
    execFileSync(
      'git',
      [
        'ls-tree',
        '-r',
        '--name-only',
        baselineCommit,
        '--',
        'docs',
        'examples',
        'static',
      ],
      { encoding: 'utf8' }
    )
  );
}

function currentFiles(): string[] {
  return lines(
    execFileSync('git', ['ls-files', '--', 'docs', 'examples', 'static'], {
      encoding: 'utf8',
    })
  );
}

function isPublicConfiguration(file: string): boolean {
  return /\.(?:mdx|ya?ml)$/.test(file);
}

function sourceAtBaseline(file: string): string {
  return execFileSync('git', ['show', `${baselineCommit}:${file}`], {
    encoding: 'utf8',
  });
}

function yamlSource(file: string, source: string): string {
  if (!file.endsWith('.mdx')) return source;
  return tutorialYamlBlocks(source).join('\n---\n');
}

function aggregateSource(
  files: string[],
  available: ReadonlySet<string>,
  read: (file: string) => string
): string {
  return files
    .filter((file) => available.has(file))
    .map((file) => {
      const source = yamlSource(file, read(file));
      return source.trim() ? `# source: ${file}\n${source}` : '';
    })
    .filter(Boolean)
    .join('\n---\n');
}

function exceptionReason(
  exampleId: string,
  category: FeatureCategory,
  feature: string
): string {
  if (category === 'inputs' && feature === 'file_watcher') {
    return 'Deprecated file_watcher shape replaced by the validated Expanso Edge file input with a read-only source mount.';
  }
  if (category === 'outputs' && feature === 'elasticsearch') {
    return 'Placeholder Elasticsearch component replaced by its authenticated HTTPS document API with a scoped API key and mounted CA.';
  }
  if (
    category === 'outputs' &&
    exampleId === 'nightly-backup' &&
    (feature === 'aws_s3' || feature === 'switch')
  ) {
    return 'Incomplete cross-cloud S3 switch removed from the Google Cloud backup example; the retained output is encrypted Google Cloud Storage through workload identity.';
  }
  if (category === 'encryptedFields' && feature === 'cvv_encrypted') {
    return 'CVV retention removed: the current pipeline deletes CVV after authorization instead of storing an encrypted authentication code.';
  }
  if (category === 'encryptedFields' && feature === 'us_s3_encrypted') {
    return 'Placeholder destination label replaced by real residency-selected S3 outputs with KMS encryption and key-scoped workload identity.';
  }
  if (category !== 'environmentControls') {
    throw new Error(
      `Missing approved history substitution for ${exampleId} ${category}.${feature}`
    );
  }
  if (/^KAFKA_BROKER/.test(feature)) {
    return 'Ambiguous broker variable replaced by KAFKA_TLS_BROKERS plus a mounted CA and deployment-supplied SCRAM credentials with topic-scoped ACLs.';
  }
  if (
    [
      'ADDR_KEY',
      'ADDRESS_ENCRYPTION_KEY',
      'CARD_ENCRYPTION_KEY',
      'CARD_KEY',
      'PAYMENT_ENCRYPTION_KEY',
      'PII_ENCRYPTION_KEY',
      'PII_KEY',
      'TEMPORAL_ENCRYPTION_KEY',
    ].includes(feature)
  ) {
    return 'Unvalidated encryption-key variable replaced by a fail-closed 64-character hexadecimal secret that Expanso Edge decodes and checks as a 32-byte AES key.';
  }
  if (
    exampleId === 'encrypt-data' &&
    (feature === 'ENCRYPTION_KEY' || feature === 'KEY')
  ) {
    return 'Legacy generic encryption-key names replaced by CARD_ENCRYPTION_KEY_HEX, whose hexadecimal value is decoded and checked as a 32-byte AES key.';
  }
  if (
    exampleId === 'encryption-patterns' &&
    (feature === 'KEY' || feature === 'NEW_KEY')
  ) {
    return `Legacy ${feature} renamed to descriptive CARD_ENCRYPTION_KEY_V2, whose hexadecimal value is decoded and checked as a 32-byte AES key.`;
  }
  if (exampleId === 'encryption-patterns' && feature === 'OLD_KEY') {
    return 'Legacy OLD_KEY renamed to descriptive CARD_ENCRYPTION_KEY_V1, whose hexadecimal value is decoded and checked as a 32-byte AES key.';
  }
  if (exampleId === 'encryption-patterns' && feature === 'PAYMENT_KEY') {
    return 'Legacy PAYMENT_KEY renamed to descriptive CARD_ENCRYPTION_KEY_HEX, whose hexadecimal value is decoded and checked as a 32-byte AES key.';
  }
  if (exampleId === 'encryption-patterns' && feature === 'KEY_ID') {
    return 'Legacy KEY_ID renamed to KEY_VERSION so ciphertext metadata selects the validated active or previous key.';
  }
  if (feature === 'ANONYMIZATION_SALT') {
    return 'Unkeyed anonymization salt replaced by required GDPR_CUSTOMER_HMAC_KEY secret material for stable HMAC-SHA-256 pseudonyms.';
  }
  if (
    [
      'ALERTING_WEBHOOK_URL',
      'ALERT_SERVICE_URL',
      'ALERT_WEBHOOK',
      'ANALYTICS_ENDPOINT',
      'LOG_ENDPOINT',
      'METRICS_ENDPOINT',
      'PAYMENT_PROCESSOR_ENDPOINT',
      'PROMETHEUS_PUSHGATEWAY_URL',
      'SLACK_WEBHOOK_URL',
      'TIMESERIES_ENDPOINT',
    ].includes(feature)
  ) {
    return `Ambiguous endpoint ${feature} replaced by an explicitly HTTPS endpoint contract with scoped authentication and mounted trust material.`;
  }
  if (
    feature === 'ELASTICSEARCH' ||
    feature.startsWith('ELASTICSEARCH_') ||
    feature.startsWith('ES_')
  ) {
    return `Legacy Elasticsearch control ${feature} replaced by ELASTICSEARCH_HTTPS_URL, a scoped API key, and a mounted CA for the document API.`;
  }
  if (feature === 'PAGERDUTY_TOKEN') {
    return 'Generic token replaced by the PagerDuty Events API routing key in its required request-body field.';
  }
  if (feature === 'DB_CONNECTION_STRING') {
    return 'Unvalidated SQL fallback DSN removed; the circuit-breaker example now uses authenticated primary and secondary HTTPS fallbacks.';
  }
  if (feature === 'DB2_PORT') {
    return 'Plain Db2 port replaced by DB2_TLS_PORT inside the SSL ODBC DSN together with the required server CA certificate.';
  }
  if (feature === 'AWS_PROFILE') {
    return 'Node-local AWS profile removed in favor of the workload ambient identity with bucket-prefix and KMS-key scoped permissions.';
  }
  if (feature === 'AWS_REGION') {
    return 'Single AWS region variable replaced by one region per residency route so every S3 bucket and KMS key remain co-located.';
  }
  if (feature === 'KMS_KEY_ID') {
    return 'Single KMS key placeholder replaced by residency-specific S3_KMS_KEY_ARN values validated against each bucket region.';
  }
  if (feature === 'ENVIRONMENT') {
    return 'Generic environment switch replaced by explicit data-residency labels and destination-specific deployment controls.';
  }
  if (
    ['BATCH_COUNT', 'BATCH_SIZE', 'GENERATE_COUNT', 'LOG_LEVEL'].includes(
      feature
    )
  ) {
    return `Untyped runtime interpolation ${feature} replaced by a fixed, schema-valid numeric or enum setting in the validated job.`;
  }
  if (feature === 'S3_BACKUP_BUCKET') {
    return 'Unrelated S3 bucket placeholder removed from the Google Cloud backup; the retained GCS bucket uses workload identity.';
  }
  throw new Error(
    `Missing approved history substitution for ${exampleId} ${category}.${feature}`
  );
}

function missingFeatures(
  exampleId: string,
  baseline: FeatureInventory,
  current: FeatureInventory
): Family['exceptions'] {
  const result: Family['exceptions'] = {};
  for (const category of FEATURE_CATEGORIES) {
    const currentSet = new Set(current[category]);
    const missing = baseline[category].filter((item) => !currentSet.has(item));
    if (missing.length > 0) {
      result[category] = missing.map((feature) => ({
        feature,
        reason: exceptionReason(exampleId, category, feature),
      }));
    }
  }
  return result;
}

const historical = new Set(baselineFiles().filter(isPublicConfiguration));
const current = new Set(currentFiles().filter(isPublicConfiguration));
const allFiles = [...new Set([...historical, ...current])].sort();
const publicCopies = JSON.parse(
  readFileSync('content/public-pipeline-copies.json', 'utf8')
) as { exampleId: string; copyPath?: string }[];
const stageManifest = JSON.parse(
  readFileSync('content/explorer-stage-bindings-v1.json', 'utf8')
) as {
  explorers: {
    exampleId: string;
    stages: { configPath: string }[];
  }[];
};

const families: Family[] = PUBLIC_CATALOG.records
  .filter((record) => record.status === 'published')
  .map((record) => {
    const selected = new Set<string>();
    if (record.completePipelinePath) selected.add(record.completePipelinePath);
    for (const file of allFiles) {
      if (file.startsWith(`docs${record.routes.overview}`)) selected.add(file);
    }
    for (const copy of publicCopies) {
      if (copy.exampleId === record.id && copy.copyPath) {
        selected.add(copy.copyPath);
      }
    }
    for (const explorer of stageManifest.explorers) {
      if (explorer.exampleId !== record.id) continue;
      for (const stage of explorer.stages) {
        if (!stage.configPath.includes('#')) selected.add(stage.configPath);
      }
    }
    const files = [...selected]
      .filter((file) => historical.has(file) || current.has(file))
      .sort();
    const baselineSource = aggregateSource(files, historical, sourceAtBaseline);
    const currentSource = aggregateSource(files, current, (file) =>
      readFileSync(file, 'utf8')
    );
    const baseline = inventoryYamlSource(baselineSource);
    return {
      exampleId: record.id,
      files,
      baselineSha256: sha256(baselineSource),
      baseline,
      exceptions: missingFeatures(
        record.id,
        baseline,
        inventoryYamlSource(currentSource)
      ),
    };
  });

const manifest = {
  schemaVersion: 'platform-feature-baseline-v1',
  baselineCommit,
  generatedForSweepDate: '2026-10-06',
  families,
};

async function writeManifest(): Promise<void> {
  writeFileSync(
    manifestPath,
    await format(JSON.stringify(manifest), { parser: 'json' })
  );
  console.log(
    `Wrote ${manifestPath}: ${families.length} example-family contracts.`
  );
}

writeManifest().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
