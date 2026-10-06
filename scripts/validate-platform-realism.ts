import { readFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { glob } from 'glob';
import { parseAllDocuments } from 'yaml';

import { PUBLIC_CATALOG } from '../src/catalog/registry';

export interface PlatformRealismFinding {
  exampleId: string;
  file: string;
  path: string;
  rule: string;
  message: string;
}

export interface PlatformRealismResult {
  examplesChecked: number;
  manifestsChecked: number;
  findings: PlatformRealismFinding[];
  status: 'PASS' | 'FAIL';
}

type YamlScalar = string | number | boolean | null;

type YamlValue = YamlScalar | YamlObject | YamlValue[];

type OptionalYamlValue = YamlValue | undefined;

interface YamlObject {
  [key: string]: YamlValue;
}

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

const placeholderPattern =
  /(?:example\.com|company\.com|\.local(?=[:/}]|$)|your[-_. ]|change[-_. ]?me|placeholder)/i;

const secretKeyPattern =
  /^(?:access_?key|api_?key|auth_?token|client_?secret|password|private_?key|secret|token)$/i;

const requiredComponents = {
  'circuit-breakers': ['http_client'],
  'content-routing': ['http_client'],
  'content-splitting': ['http_client', 'kafka', 'file'],
  'fan-out-pattern': ['kafka', 'aws_s3', 'http_client'],
  'priority-queues': ['kafka'],
  'smart-buffering': ['http_client'],
  'cross-border-gdpr': ['sql_select', 'gcp_bigquery', 'gcp_cloud_storage'],
  'encrypt-data': ['http_server', 'http_client'],
  'encryption-patterns': ['mapping'],
  'enforce-schema': ['http_server', 'http_client', 'file'],
  'remove-pii': ['http_server', 'file'],
  'aggregate-time-windows': ['http_server', 'http_client'],
  'deduplicate-events': ['http_server', 'http_client'],
  'normalize-timestamps': ['http_server', 'http_client', 'kafka', 'file'],
  'parse-logs': ['file', 'http_client'],
  'transform-formats': ['http_server', 'kafka'],
  'db2-to-bigquery': ['sql_select', 'gcp_bigquery'],
  'nightly-backup': ['sql_select', 'gcp_cloud_storage'],
  'medical-device-intelligence': ['csv', 'file', 'command', 'http_client'],
  'motherduck-retail-analytics': ['generate', 'parquet_encode', 'aws_s3'],
  'oran-telco-pipeline': ['http_client', 'kafka', 'file'],
  'scada-energy-edge': ['socket', 'kafka', 'file'],
  'splunk-edge-processing': ['file_watcher', 'http_client', 'aws_s3'],
  'enrich-export': ['generate', 'aws_s3'],
  'filter-severity': ['file', 'stdout'],
  'production-pipeline': ['http_server', 'http_client', 'aws_s3'],
} as const satisfies Record<string, readonly string[]>;

function isObject(value: OptionalYamlValue): value is YamlObject {
  return (
    value !== null &&
    value !== undefined &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

function isString(value: OptionalYamlValue): value is string {
  return Object.prototype.toString.call(value) === '[object String]';
}

function hasInterpolation(value: string): boolean {
  return /\$\{[^}]+\}|env\(["'][A-Z0-9_]+["']\)/.test(value);
}

function stringValues(value: OptionalYamlValue): string[] {
  if (isString(value)) return [value];

  if (Array.isArray(value)) return value.flatMap(stringValues);

  return [];
}

function isLoopbackOrClusterHttp(url: string): boolean {
  return (
    /^http:\/\/(?:127\.0\.0\.1|localhost)(?=[:/]|$)/i.test(url) ||
    /^http:\/\/[a-z0-9.-]+\.svc(?=[:/]|$)/i.test(url)
  );
}

function isExternalHttpUrl(url: string): boolean {
  if (isLoopbackOrClusterHttp(url)) return false;
  const defaultUrl = url.match(/^\$\{[^}:]+:(https?:\/\/[^}]+)\}/i)?.[1];

  if (defaultUrl && isLoopbackOrClusterHttp(defaultUrl)) return false;

  return /^(?:https?:\/\/|\$\{[^}]+\})/i.test(url);
}

function collectKeys(value: YamlValue, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);

    return keys;
  }

  if (!isObject(value)) return keys;

  for (const [key, child] of Object.entries(value)) {
    keys.add(key);
    collectKeys(child, keys);
  }

  return keys;
}

function hasAuthorization(component: YamlObject, url: string): boolean {
  const headers = isObject(component.headers) ? component.headers : {};
  const headerNames = Object.keys(headers).map((name) => name.toLowerCase());

  if (
    headerNames.includes('authorization') ||
    isObject(component.basic_auth) ||
    isString(component.api_key) ||
    isObject(component.oauth) ||
    isObject(component.oauth2)
  ) {
    return true;
  }

  // These APIs carry the credential in the URL or documented request body.
  return /webhook|hooks\.slack\.com|events\.pagerduty\.com/i.test(url);
}

function finding(
  exampleId: string,
  file: string,
  path: string,
  rule: string,
  message: string
): PlatformRealismFinding {
  return { exampleId, file, path, rule, message };
}

function inspectUrl(
  exampleId: string,
  file: string,
  path: string,
  component: YamlObject,
  url: string
): PlatformRealismFinding[] {
  const findings: PlatformRealismFinding[] = [];

  if (placeholderPattern.test(url)) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'no-placeholder-endpoints',
        `endpoint is a placeholder: ${url}`
      )
    );
  }

  if (
    (/^http:\/\//i.test(url) && !isLoopbackOrClusterHttp(url)) ||
    (isExternalHttpUrl(url) && /^\$\{/.test(url) &&
      (!isObject(component.tls) || component.tls.enabled !== true))
  ) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'https-for-external-http',
        `external endpoint must use HTTPS: ${url}`
      )
    );
  }

  if (isExternalHttpUrl(url) && !hasAuthorization(component, url)) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'authenticated-http-output',
        'external HTTP output has no Authorization, basic-auth, OAuth, or authenticated webhook contract'
      )
    );
  }

  const headers = isObject(component.headers) ? component.headers : {};

  const contentType = Object.entries(headers).find(
    ([name]) => name.toLowerCase() === 'content-type'
  )?.[1];

  if (
    /pushgateway/i.test(url) &&
    (!isString(contentType) || !/^text\/plain(?:;|$)/i.test(contentType))
  ) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'pushgateway-text-format',
        'Prometheus Pushgateway requests must use the text exposition media type'
      )
    );
  }

  if (/\/services\/collector\/event(?:\?|$)/i.test(url)) {
    const authorization = Object.entries(headers).find(
      ([name]) => name.toLowerCase() === 'authorization'
    )?.[1];

    if (
      !isString(authorization) ||
      !/^Splunk\s+\$\{[A-Z0-9_]+\}$/i.test(authorization)
    ) {
      findings.push(
        finding(
          exampleId,
          file,
          path,
          'splunk-hec-auth',
          'Splunk HEC event requests must use a deployment-supplied Splunk token'
        )
      );
    }

    if (
      !isString(contentType) ||
      !/^application\/json(?:;|$)/i.test(contentType)
    ) {
      findings.push(
        finding(
          exampleId,
          file,
          path,
          'splunk-hec-json',
          'Splunk HEC event requests must use the JSON media type'
        )
      );
    }
  }

  return findings;
}

function inspectKafka(
  exampleId: string,
  file: string,
  path: string,
  component: YamlObject
): PlatformRealismFinding[] {
  const findings: PlatformRealismFinding[] = [];
  const addresses = stringValues(component.addresses);

  if (addresses.length === 0) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'kafka-addresses',
        'Kafka output has no broker addresses'
      )
    );
  }

  for (const address of addresses) {
    if (placeholderPattern.test(address)) {
      findings.push(
        finding(
          exampleId,
          file,
          path,
          'no-placeholder-endpoints',
          `Kafka address is a placeholder: ${address}`
        )
      );
    }
  }

  const tls = isObject(component.tls) ? component.tls : {};

  if (tls.enabled !== true) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'kafka-tls',
        'Kafka output must set tls.enabled: true'
      )
    );
  }

  if (!isString(tls.root_cas_file) || tls.root_cas_file.length === 0) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'kafka-trust-root',
        'Kafka TLS must name the mounted or deployment-supplied CA bundle'
      )
    );
  }

  const sasl = isObject(component.sasl) ? component.sasl : {};

  if (
    !isString(sasl.mechanism) ||
    !isString(sasl.user) ||
    !isString(sasl.password) ||
    !hasInterpolation(sasl.user) ||
    !hasInterpolation(sasl.password)
  ) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'kafka-auth',
        'Kafka output must load the SASL mechanism, user, and password from the deployment environment'
      )
    );
  }

  return findings;
}

function inspectElasticsearch(
  exampleId: string,
  file: string,
  path: string,
  component: YamlObject
): PlatformRealismFinding[] {
  const findings = stringValues(component.urls).flatMap((url) =>
    inspectUrl(exampleId, file, `${path}.urls`, component, url)
  );

  if (!isObject(component.basic_auth) && !isString(component.api_key)) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'elasticsearch-auth',
        'Elasticsearch output must configure basic_auth or api_key'
      )
    );
  }

  return findings;
}

function inspectSql(
  exampleId: string,
  file: string,
  path: string,
  component: YamlObject
): PlatformRealismFinding[] {
  const dsn = isString(component.dsn) ? component.dsn : '';
  const driver = isString(component.driver) ? component.driver : '';
  const findings: PlatformRealismFinding[] = [];

  if (
    driver.toLowerCase() === 'postgres' &&
    !/sslmode=verify-full/i.test(dsn)
  ) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'postgres-verify-full',
        'PostgreSQL DSN must use sslmode=verify-full'
      )
    );
  }

  if (
    (driver.toLowerCase() === 'odbc' || /db2/i.test(dsn)) &&
    (!/Security=SSL/i.test(dsn) || !/SSLServerCertificate=/i.test(dsn))
  ) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'db2-tls',
        'Db2 ODBC DSN must enable SSL and name the trusted server certificate'
      )
    );
  }

  return findings;
}

function inspectAwsS3(
  exampleId: string,
  file: string,
  path: string,
  component: YamlObject
): PlatformRealismFinding[] {
  const findings: PlatformRealismFinding[] = [];
  const bucket = isString(component.bucket) ? component.bucket : '';

  if (!/^\$\{[A-Z0-9_]+(?::-\$\{[A-Z0-9_]+\})?\}$/.test(bucket)) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        's3-deployment-bucket',
        'S3 bucket must be supplied by the deployment without a literal fallback'
      )
    );
  }

  if (isObject(component.credentials) && 'profile' in component.credentials) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'aws-workload-identity',
        'S3 output must use the ambient workload identity instead of a node-local profile'
      )
    );
  }

  if (component.server_side_encryption !== 'aws:kms') {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        's3-kms',
        'S3 output must enable aws:kms server-side encryption'
      )
    );
  }

  if (
    !isString(component.kms_key_id) ||
    !hasInterpolation(component.kms_key_id)
  ) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        's3-kms-key',
        'S3 output must load kms_key_id from the deployment environment'
      )
    );
  }

  return findings;
}

function inspectGcpCloudStorage(
  exampleId: string,
  file: string,
  path: string,
  component: YamlObject
): PlatformRealismFinding[] {
  const findings: PlatformRealismFinding[] = [];
  const bucket = isString(component.bucket) ? component.bucket : '';
  const objectPath = isString(component.path) ? component.path : '';

  if (!/^\$\{[A-Z0-9_]+\}$/.test(bucket)) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'gcs-deployment-bucket',
        'GCS bucket must be supplied by the deployment without a literal fallback'
      )
    );
  }

  if (/\.gz$/.test(objectPath) && component.content_encoding !== 'gzip') {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'gzip-content-encoding',
        'gzip-compressed cloud objects must declare content_encoding: gzip'
      )
    );
  }

  return findings;
}

function inspectTree(
  value: YamlValue,
  exampleId: string,
  file: string,
  path: string[] = []
): PlatformRealismFinding[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      inspectTree(item, exampleId, file, [...path, String(index)])
    );
  }

  if (!isObject(value)) return [];

  return Object.entries(value).flatMap(([key, child]) => {
    const childPath = [...path, key];
    const renderedPath = childPath.join('.');
    const findings: PlatformRealismFinding[] = [];

    if (
      secretKeyPattern.test(key) &&
      isString(child) &&
      child.length > 0 &&
      !hasInterpolation(child)
    ) {
      findings.push(
        finding(
          exampleId,
          file,
          renderedPath,
          'no-inline-secrets',
          `${key} must be supplied by the deployment environment`
        )
      );
    }

    if ((key === 'http_client' || key === 'http') && isObject(child)) {
      const url = isString(child.url) ? child.url : '';

      if (url) {
        findings.push(...inspectUrl(exampleId, file, renderedPath, child, url));
      }
    }

    if (key === 'kafka' && isObject(child)) {
      findings.push(...inspectKafka(exampleId, file, renderedPath, child));
    }

    if (key === 'elasticsearch' && isObject(child)) {
      findings.push(
        ...inspectElasticsearch(exampleId, file, renderedPath, child)
      );
    }

    if ((key === 'sql_select' || key === 'sql_insert') && isObject(child)) {
      findings.push(...inspectSql(exampleId, file, renderedPath, child));
    }

    if ((key === 'aws_s3' || key === 's3') && isObject(child)) {
      findings.push(...inspectAwsS3(exampleId, file, renderedPath, child));
    }

    if (key === 'gcp_cloud_storage' && isObject(child)) {
      findings.push(
        ...inspectGcpCloudStorage(exampleId, file, renderedPath, child)
      );
    }

    if (key === 'hostPath') {
      findings.push(
        finding(
          exampleId,
          file,
          renderedPath,
          'no-host-path',
          'Kubernetes and OpenShift deployment manifests must use persistentVolumeClaim storage instead of hostPath'
        )
      );
    }

    if (key === 'path' && isString(child) && child.startsWith('/tmp/')) {
      findings.push(
        finding(
          exampleId,
          file,
          renderedPath,
          'no-ephemeral-output',
          `published output path is ephemeral: ${child}`
        )
      );
    }

    findings.push(...inspectTree(child, exampleId, file, childPath));

    return findings;
  });
}

function workloadPodSpec(value: YamlObject): YamlObject | undefined {
  const kind = isString(value.kind) ? value.kind : '';
  const spec = isObject(value.spec) ? value.spec : undefined;

  if (!spec) return undefined;

  if (kind === 'Pod') return spec;

  if (kind === 'CronJob') {
    const jobTemplate = isObject(spec.jobTemplate) ? spec.jobTemplate : {};
    const jobSpec = isObject(jobTemplate.spec) ? jobTemplate.spec : {};
    const template = isObject(jobSpec.template) ? jobSpec.template : {};

    return isObject(template.spec) ? template.spec : undefined;
  }

  if (['DaemonSet', 'Deployment', 'Job', 'StatefulSet'].includes(kind)) {
    const template = isObject(spec.template) ? spec.template : {};

    return isObject(template.spec) ? template.spec : undefined;
  }

  return undefined;
}

function inspectWorkloadSecurity(
  value: YamlValue,
  exampleId: string,
  file: string,
  documentIndex: number
): PlatformRealismFinding[] {
  if (!isObject(value)) return [];
  const podSpec = workloadPodSpec(value);

  if (!podSpec) return [];
  const path = `$[${documentIndex}].spec`;
  const findings: PlatformRealismFinding[] = [];

  if (podSpec.hostNetwork === true) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'no-host-network',
        'published workloads must not join the node network namespace'
      )
    );
  }

  if (podSpec.automountServiceAccountToken !== false) {
    findings.push(
      finding(
        exampleId,
        file,
        path,
        'no-service-account-token',
        'published workloads must disable automatic service-account token mounts'
      )
    );
  }

  const podSecurity = isObject(podSpec.securityContext)
    ? podSpec.securityContext
    : {};

  const seccomp = isObject(podSecurity.seccompProfile)
    ? podSecurity.seccompProfile
    : {};

  if (podSecurity.runAsNonRoot !== true || seccomp.type !== 'RuntimeDefault') {
    findings.push(
      finding(
        exampleId,
        file,
        `${path}.securityContext`,
        'restricted-pod-security',
        'published workloads must run as non-root with RuntimeDefault seccomp'
      )
    );
  }

  const containers = [podSpec.initContainers, podSpec.containers].flatMap(
    (entries) => (Array.isArray(entries) ? entries : [])
  );

  for (const [index, container] of containers.entries()) {
    if (!isObject(container)) continue;

    const security = isObject(container.securityContext)
      ? container.securityContext
      : {};

    const capabilities = isObject(security.capabilities)
      ? security.capabilities
      : {};

    const dropped = stringValues(capabilities.drop).map((item) =>
      item.toUpperCase()
    );

    if (
      security.allowPrivilegeEscalation !== false ||
      !dropped.includes('ALL')
    ) {
      findings.push(
        finding(
          exampleId,
          file,
          `${path}.containers[${index}].securityContext`,
          'restricted-container-security',
          'published containers must disable privilege escalation and drop all capabilities'
        )
      );
    }
  }

  return findings;
}

export function validateDeploymentManifestSource(
  source: string,
  options: { exampleId?: string; file?: string } = {}
): PlatformRealismFinding[] {
  const exampleId = options.exampleId ?? 'deployment-manifest';
  const file = options.file ?? 'inline.yaml';

  const documents = parseAllDocuments(source, {
    strict: true,
    uniqueKeys: true,
  });

  const parseFindings = documents.flatMap((document, index) =>
    [...document.errors, ...document.warnings].map((error) =>
      finding(exampleId, file, `$[${index}]`, 'valid-yaml', error.message)
    )
  );

  if (parseFindings.length > 0) return parseFindings;

  return documents.flatMap((document, index) => {
    if (document.contents === null) {
      return [
        finding(
          exampleId,
          file,
          `$[${index}]`,
          'valid-yaml',
          'empty YAML document'
        ),
      ];
    }

    const value = document.toJS({ maxAliasCount: 100 });

    const storageFindings = inspectTree(value, exampleId, file, [
      `$[${index}]`,
    ]).filter((item) => item.rule === 'no-host-path');

    return [
      ...storageFindings,
      ...inspectWorkloadSecurity(value, exampleId, file, index),
    ];
  });
}

export function validatePlatformYamlSource(
  source: string,
  options: {
    exampleId?: string;
    file?: string;
    requiredComponents?: readonly string[];
  } = {}
): PlatformRealismFinding[] {
  const exampleId = options.exampleId ?? 'inline';
  const file = options.file ?? 'inline.yaml';

  const documents = parseAllDocuments(source, {
    strict: true,
    uniqueKeys: true,
  });

  const parseFindings = documents.flatMap((document, index) =>
    [...document.errors, ...document.warnings].map((error) =>
      finding(exampleId, file, `$[${index}]`, 'valid-yaml', error.message)
    )
  );

  if (
    parseFindings.length > 0 ||
    documents.length === 0 ||
    documents.some((document) => document.contents === null)
  ) {
    return parseFindings.length > 0
      ? parseFindings
      : [finding(exampleId, file, '$', 'valid-yaml', 'empty YAML document')];
  }

  const values = documents.map((document) =>
    document.toJS({ maxAliasCount: 100 })
  );

  const findings = values.flatMap((value, index) =>
    inspectTree(value, exampleId, file, [`$[${index}]`])
  );

  const keys = values.reduce(
    (result, value) => collectKeys(value, result),
    new Set<string>()
  );

  for (const component of options.requiredComponents ?? []) {
    if (!keys.has(component)) {
      findings.push(
        finding(
          exampleId,
          file,
          '$',
          'required-platform-component',
          `canonical pipeline is missing required ${component} configuration`
        )
      );
    }
  }

  return findings;
}

export async function validatePublishedPlatformExamples(
  root = repositoryRoot
): Promise<PlatformRealismResult> {
  const published = PUBLIC_CATALOG.records.filter(
    (record) => record.status === 'published'
  );

  const findings: PlatformRealismFinding[] = [];

  for (const record of published) {
    if (!record.completePipelinePath) {
      findings.push(
        finding(
          record.id,
          'src/catalog/registry.ts',
          'completePipelinePath',
          'canonical-pipeline',
          'published example has no canonical pipeline'
        )
      );
      continue;
    }

    const absolutePath = resolve(root, record.completePipelinePath);

    try {
      const source = await readFile(absolutePath, 'utf8');
      findings.push(
        ...validatePlatformYamlSource(source, {
          exampleId: record.id,
          file: record.completePipelinePath,
          requiredComponents: requiredComponents[record.id],
        })
      );
    } catch (error) {
      findings.push(
        finding(
          record.id,
          record.completePipelinePath,
          '$',
          'canonical-pipeline',
          error instanceof Error ? error.message : String(error)
        )
      );
    }


  }

  const manifestPaths = await glob('**/*.{yaml,yml}', {
    cwd: root,
    nodir: true,
    ignore: [
      'node_modules/**',
      'build/**',
      '.docusaurus/**',
      'static/files/**',
      'static/pipelines/**',
      'examples/explorer-stages/**',
    ],
  });

  let manifestsChecked = 0;

  for (const manifestPath of manifestPaths.sort()) {
    const source = await readFile(resolve(root, manifestPath), 'utf8');

    if (!/^apiVersion:/m.test(source) || !/^kind:/m.test(source)) continue;
    manifestsChecked += 1;

    const manifestFindings = validateDeploymentManifestSource(source, {
      exampleId: 'deployment-manifest',
      file: manifestPath,
    });

    findings.push(...manifestFindings);
  }

  return {
    examplesChecked: published.length,
    manifestsChecked,
    findings,
    status: findings.length === 0 ? 'PASS' : 'FAIL',
  };
}

async function main() {
  const result = await validatePublishedPlatformExamples();

  for (const item of result.findings) {
    console.error(
      `PLATFORM_REALISM ${item.rule} ${item.exampleId} ${item.file}#${item.path}: ${item.message}`
    );
  }

  console.log(
    `Platform realism ${result.status}: ${result.examplesChecked} published examples / ${result.manifestsChecked} deployment manifests / ${result.findings.length} findings.`
  );

  if (result.status === 'FAIL') process.exitCode = 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';

if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
