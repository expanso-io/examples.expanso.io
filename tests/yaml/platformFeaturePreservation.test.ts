import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { resolve } from 'node:path';

import {
  FEATURE_CATEGORIES,
  inventoryYamlSource,
  tutorialYamlBlocks,
  type FeatureCategory,
  type FeatureInventory,
} from '../../scripts/platform-feature-inventory';

type Exception = { feature: string; reason: string };
type Family = {
  exampleId: string;
  files: string[];
  baseline: FeatureInventory;
  exceptions: Partial<Record<FeatureCategory, Exception[]>>;
};
type Manifest = {
  schemaVersion: string;
  baselineCommit: string;
  families: Family[];
};

const root = process.cwd();
const manifest = JSON.parse(
  readFileSync(
    resolve(root, 'content/platform-feature-baseline-v1.json'),
    'utf8'
  )
) as Manifest;

function familySource(family: Family): string {
  return family.files
    .filter((file) => existsSync(resolve(root, file)))
    .map((file) => {
      const source = readFileSync(resolve(root, file), 'utf8');
      if (!file.endsWith('.mdx')) return source;
      return tutorialYamlBlocks(source).join('\n---\n');
    })
    .filter((source) => source.trim())
    .join('\n---\n');
}

test('every public example family preserves its pre-sweep semantic contract', () => {
  assert.equal(manifest.schemaVersion, 'platform-feature-baseline-v1');
  assert.equal(
    manifest.baselineCommit,
    'd167350ffad085c267b1bbe884c5b28b6f95d03b'
  );
  assert.equal(manifest.families.length, 26);
  assert.equal(
    new Set(manifest.families.map((family) => family.exampleId)).size,
    26
  );

  const failures: string[] = [];
  for (const family of manifest.families) {
    assert.ok(family.files.length > 0, `${family.exampleId} has artifacts`);
    const current = inventoryYamlSource(familySource(family));
    for (const category of FEATURE_CATEGORIES) {
      const actual = new Set(current[category]);
      const exceptions = new Map(
        (family.exceptions[category] ?? []).map((item) => [
          item.feature,
          item.reason,
        ])
      );
      for (const feature of family.baseline[category]) {
        if (actual.has(feature)) {
          if (exceptions.has(feature)) {
            failures.push(
              `${family.exampleId} ${category}.${feature}: stale exception`
            );
          }
          continue;
        }
        const reason = exceptions.get(feature);
        if (!reason?.trim() || reason.startsWith('TODO ')) {
          failures.push(
            `${family.exampleId} ${category}.${feature}: missing without a specific approved substitution`
          );
        }
      }
      for (const feature of exceptions.keys()) {
        if (!family.baseline[category].includes(feature)) {
          failures.push(
            `${family.exampleId} ${category}.${feature}: exception is not a baseline feature`
          );
        }
      }
    }
  }
  assert.deepEqual(failures, []);
});
