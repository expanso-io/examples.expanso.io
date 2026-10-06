import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  validateDeploymentManifestSource,
  validateCanonicalWithExpansoEdge,
  validatePlatformYamlSource,
  validatePublishedPlatformExamples,
  validatePlatformPayloadContracts,
} from '../../scripts/validate-platform-realism';

describe('platform realism policy', () => {
  it('executes Slack payload processors and rejects a warning without text or blocks', async () => {
    const output =
      'output:\n  http_client:\n    url: ${SLACK_HTTPS_WEBHOOK_URL}\n';
    const options = { exampleId: 'fixture', file: 'slack.yaml' };
    assert.deepEqual(
      (await validatePlatformPayloadContracts(output, options)).map(
        (f) => f.rule
      ),
      ['slack-payload']
    );
    const mapped =
      output +
      '  processors:\n    - mapping: |\n        root.text = this.message\n';
    assert.deepEqual(
      await validatePlatformPayloadContracts(mapped, options),
      []
    );
  });
  it('rejects plaintext and unauthenticated external HTTP outputs', () => {
    const findings = validatePlatformYamlSource(`
output:
  http_client:
    url: http://events.example.com/ingest
    verb: POST
`);

    assert.deepEqual(
      new Set(findings.map((item) => item.rule)),
      new Set([
        'no-placeholder-endpoints',
        'https-for-external-http',
        'authenticated-http-output',
      ])
    );
  });

  it('accepts authenticated HTTPS output contracts', () => {
    const findings = validatePlatformYamlSource(`
output:
  http_client:
    url: "${'${DOWNSTREAM_URL}'}/events"
    tls:
      enabled: true
    verb: POST
    headers:
      Authorization: "Bearer ${'${LOG_API_TOKEN}'}"
`);

    assert.deepEqual(findings, []);
  });

  it('rejects Kafka without TLS and authentication', () => {
    const findings = validatePlatformYamlSource(`
output:
  kafka:
    addresses: ["broker:9092"]
    topic: events
`);

    assert.deepEqual(
      new Set(findings.map((item) => item.rule)),
      new Set(['kafka-tls', 'kafka-auth'])
    );
  });

  it('accepts TLS and SCRAM Kafka configured by the deployment', () => {
    const findings = validatePlatformYamlSource(`
output:
  kafka:
    addresses: ["broker:9092"]
    topic: events
    tls:
      enabled: true
    sasl:
      mechanism: SCRAM-SHA-512
      user: "${'${KAFKA_USERNAME}'}"
      password: "${'${KAFKA_PASSWORD}'}"
`);

    assert.deepEqual(findings, []);
  });

  it('accepts Kafka client authentication with system trust', () => {
    const findings = validatePlatformYamlSource(`
output:
  kafka:
    addresses: [broker:9092]
    topic: events
    tls:
      enabled: true
      client_certs:
        - cert_file: /mounted/client.pem
          key_file: /mounted/client.key
`);
    assert.deepEqual(findings, []);
  });

  it('rejects an incomplete Kafka client certificate', () => {
    const findings = validatePlatformYamlSource(`
output:
  kafka:
    addresses: [broker:9092]
    topic: events
    tls:
      enabled: true
      client_certs:
        - cert_file: /mounted/client.pem
`);
    assert.deepEqual(
      findings.map((item) => item.rule),
      ['kafka-auth']
    );
  });

  it('accepts residency routing to KMS-encrypted S3 buckets', () => {
    const findings = validatePlatformYamlSource(`
output:
  aws_s3:
    bucket: '${'${S3_BUCKET_PREFIX}'}-${'${! metadata("data_residency") }'}'
    server_side_encryption: aws:kms
    kms_key_id: "${'${S3_KMS_KEY_ARN}'}"
`);
    assert.deepEqual(findings, []);
  });

  it('rejects hostPath, weak database TLS, and unencrypted S3', () => {
    const findings = validatePlatformYamlSource(`
input:
  sql_select:
    driver: postgres
    dsn: "postgres://user:pass@db:5432/app?sslmode=require"
output:
  broker:
    outputs:
      - aws_s3:
          bucket: archive
      - file:
          path: "${'${LOCAL_ARCHIVE_PATH:/tmp/archive.jsonl}'}"
volumes:
  - hostPath:
      path: /data
`);

    assert.deepEqual(
      new Set(findings.map((item) => item.rule)),
      new Set([
        'postgres-verify-full',
        's3-kms',
        's3-kms-key',
        'no-host-path',
        'no-ephemeral-output',
      ])
    );
  });

  it('rejects incomplete gzip object metadata', () => {
    const findings = validatePlatformYamlSource(`
output:
  broker:
    outputs:
      - aws_s3:
          bucket: "${'${S3_BUCKET:logs-archive}'}"
          server_side_encryption: aws:kms
          kms_key_id: "${'${S3_KMS_KEY_ARN}'}"
      - gcp_cloud_storage:
          bucket: provisioned-archive-bucket
          path: "backup/data.jsonl.gz"
          content_type: application/x-ndjson
`);

    assert.deepEqual(
      new Set(findings.map((item) => item.rule)),
      new Set(['gzip-content-encoding'])
    );
  });

  it('checks wire formats for Pushgateway and Splunk HEC', () => {
    const findings = validatePlatformYamlSource(`
output:
  broker:
    outputs:
      - http_client:
          url: "${'${PROMETHEUS_PUSHGATEWAY_HTTPS_URL}'}/metrics/job/edge"
          tls:
            enabled: true
          headers:
            Authorization: "Bearer ${'${PROMETHEUS_TOKEN}'}"
            Content-Type: application/json
      - http_client:
          url: "https://${'${SPLUNK_HOST}'}/services/collector/event"
          headers:
            Authorization: "Bearer ${'${HEC_TOKEN}'}"
            Content-Type: text/plain
`);

    assert.deepEqual(
      new Set(findings.map((item) => item.rule)),
      new Set(['pushgateway-text-format', 'splunk-hec-auth', 'splunk-hec-json'])
    );
  });

  it('checks every document and restricted workload controls', () => {
    const findings = validateDeploymentManifestSource(`
apiVersion: v1
kind: ConfigMap
metadata:
  name: settings
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: unsafe
spec:
  template:
    spec:
      hostNetwork: true
      volumes:
        - name: data
          hostPath:
            path: /data
      containers:
        - name: app
          image: example.invalid/app:latest
`);

    assert.deepEqual(
      new Set(findings.map((item) => item.rule)),
      new Set([
        'no-host-path',
        'no-host-network',
        'no-service-account-token',
        'restricted-pod-security',
        'restricted-container-security',
      ])
    );
  });

  it('sweeps every published catalog entry', async () => {
    const result = await validatePublishedPlatformExamples();
    assert.equal(result.examplesChecked, 26);
    assert.equal(result.edgeJobsChecked, 26);
    assert.equal(result.stagesChecked, 126);
    assert.ok(result.copiesChecked >= 20);
    assert.ok(result.tutorialsChecked > 0);
    assert.equal(
      result.status,
      'PASS',
      result.findings
        .map(
          (item) =>
            `${item.exampleId} ${item.file} ${item.rule}: ${item.message}`
        )
        .join('\n')
    );
  });
  it('uses pinned Expanso Edge and rejects an untyped job that skips config validation', () => {
    const scratch = mkdtempSync(resolve('.nm-edge-job-'));
    try {
      const file = resolve(scratch, 'untyped.yaml');
      writeFileSync(
        file,
        [
          'name: untyped',
          'config:',
          '  input:',
          '    generate:',
          '      count: 1',
          '      mapping: root = {}',
          '  output:',
          '    drop: {}',
          '',
        ].join('\n')
      );
      assert.deepEqual(
        validateCanonicalWithExpansoEdge(process.cwd(), 'fixture', file).map(
          (item) => item.rule
        ),
        ['typed-expanso-edge-job']
      );
    } finally {
      rmSync(scratch, { recursive: true });
    }
  });
  it('rejects insecure published stage configurations and complete copies', async () => {
    const scratch = mkdtempSync(resolve('.nm-review-policy-'));
    try {
      mkdirSync(resolve(scratch, 'content'));
      mkdirSync(resolve(scratch, 'static/files/data-security'), {
        recursive: true,
      });
      writeFileSync(
        resolve(scratch, 'content/explorer-stage-bindings-v1.json'),
        JSON.stringify({
          explorers: [
            {
              exampleId: 'encrypt-data',
              stages: [{ id: 1, configPath: 'stage.yaml' }],
            },
          ],
        })
      );
      writeFileSync(
        resolve(scratch, 'content/public-pipeline-copies.json'),
        JSON.stringify([{ exampleId: 'encrypt-data', copyPath: 'copy.yaml' }])
      );
      writeFileSync(
        resolve(scratch, 'static/files/data-security/encrypt-data.yaml'),
        'output:\n  stdout: {}\n'
      );
      writeFileSync(
        resolve(scratch, 'copy.yaml'),
        'output:\n  http_client:\n    url: http://external.invalid/events\n'
      );
      mkdirSync(resolve(scratch, 'docs/data-security/encrypt-data'), {
        recursive: true,
      });
      writeFileSync(
        resolve(scratch, 'docs/data-security/encrypt-data/step-test.mdx'),
        '---\ncontentArchetype: step\n---\n\x60\x60\x60yaml\noutput:\n  kafka:\n    addresses: [broker:9092]\n    topic: tutorial-events\n\x60\x60\x60\n\x60\x60\x60bash\nexpanso-edge run --config pipeline.yaml\nexpanso-cli job deploy pipeline.yaml\nexpanso-edge validate pipeline.yaml\n\x60\x60\x60\n'
      );
      writeFileSync(
        resolve(scratch, 'stage.yaml'),
        'output:\n  kafka:\n    addresses: [broker:9092]\n    topic: events\n'
      );
      const result = await validatePublishedPlatformExamples(scratch);
      assert.ok(
        result.findings.some(
          (item) =>
            item.file.includes('step-test.mdx') && item.rule === 'kafka-auth'
        )
      );
      assert.ok(
        result.findings.some(
          (item) =>
            item.file.includes('step-test.mdx') &&
            item.rule === 'unsupported-edge-run-config'
        )
      );
      assert.ok(
        result.findings.some(
          (item) =>
            item.file.includes('step-test.mdx') &&
            item.rule === 'validate-before-deploy'
        )
      );
      assert.ok(
        result.findings.some(
          (item) => item.file === 'stage.yaml' && item.rule === 'kafka-tls'
        )
      );
      assert.ok(
        result.findings.some(
          (item) =>
            item.file === 'copy.yaml' && item.rule === 'https-for-external-http'
        )
      );
      assert.ok(
        result.findings.some(
          (item) => item.file === 'copy.yaml' && item.rule === 'canonical-copy'
        )
      );
    } finally {
      rmSync(scratch, { recursive: true });
    }
  });
});
