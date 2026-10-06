/** Public reference page for the complete pipeline owned by each example. */
export const COMPLETE_PIPELINE_ROUTES = {
  'circuit-breakers':
    '/data-routing/circuit-breakers/complete-circuit-breakers/',
  'content-routing': '/data-routing/content-routing/complete-content-routing/',
  'content-splitting':
    '/data-routing/content-splitting/complete-content-splitting/',
  'fan-out-pattern': '/data-routing/fan-out-pattern/complete-fan-out-pipeline/',
  'priority-queues':
    '/data-routing/priority-queues/complete-priority-pipeline/',
  'smart-buffering': '/data-routing/smart-buffering/complete-smart-buffering/',
  'cross-border-gdpr': '/data-security/cross-border-gdpr/complete-pipeline/',
  'encrypt-data': '/data-security/encrypt-data/complete-pipeline/',
  'encryption-patterns':
    '/data-security/encryption-patterns/complete-encryption-pipeline/',
  'enforce-schema': '/data-security/enforce-schema/complete-schema-validation/',
  'remove-pii': '/data-security/remove-pii/complete-pipeline/',
  'aggregate-time-windows':
    '/data-transformation/aggregate-time-windows/complete-aggregation-pipeline/',
  'deduplicate-events':
    '/data-transformation/deduplicate-events/complete-deduplication-pipeline/',
  'normalize-timestamps':
    '/data-transformation/normalize-timestamps/complete-pipeline/',
  'parse-logs': '/data-transformation/parse-logs/complete-parser/',
  'transform-formats':
    '/data-transformation/transform-formats/complete-pipeline/',
  'db2-to-bigquery': '/enterprise-migration/db2-to-bigquery/complete-pipeline/',
  'nightly-backup': '/enterprise-migration/nightly-backup/complete-pipeline/',
  'motherduck-retail-analytics':
    '/integrations/motherduck-retail-analytics/complete-pipeline/',
  'oran-telco-pipeline':
    '/integrations/oran-telco-pipeline/complete-oran-pipeline/',
  'scada-energy-edge':
    '/integrations/scada-energy-edge/complete-scada-integration/',
  'splunk-edge-processing':
    '/integrations/splunk-edge-processing/complete-splunk-integration/',
  'enrich-export': '/log-processing/enrich-export/complete-log-enrichment/',
  'filter-severity':
    '/log-processing/filter-severity/complete-filter-severity/',
  'production-pipeline':
    '/log-processing/production-pipeline/complete-production-pipeline/',
} as const;

export function completePipelineRouteForFamily(
  family: string
): string | undefined {
  return Object.entries(COMPLETE_PIPELINE_ROUTES).find(
    ([candidate]) => candidate === family
  )?.[1];
}

export function completePipelineRouteForPath(
  pathname: string
): string | undefined {
  return Object.entries(COMPLETE_PIPELINE_ROUTES).find(([, route]) => {
    const familyRoot = route.split('/').slice(0, -2).join('/');

    return pathname === familyRoot || pathname.startsWith(`${familyRoot}/`);
  })?.[1];
}
