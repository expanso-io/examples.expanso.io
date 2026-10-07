import assert from 'node:assert/strict';
import { test } from 'node:test';
import { writeFileSync, rmSync } from 'node:fs';
import {
  extractCodeBlocks,
  extractYamlCodeBlocks,
} from '../../src/lib/pipelineCode';
import { discoverPipelineFiles } from '../../scripts/validation/inventory';

test('unclosed executable fences retain malformed pipeline content at EOF', () => {
  for (const marker of ['```', '~~~']) {
    const source = 'input: {generate: {}}\noutput: [invalid';
    const blocks = extractYamlCodeBlocks(
      `# Example\n\n${marker}yaml\n${source}`
    );
    assert.deepEqual(blocks, [{ source, line: 4, language: 'yaml' }]);
  }
});

test('unclosed indented Bloblang fences consume the remaining lines', () => {
  assert.deepEqual(
    extractCodeBlocks('  ```bloblang\n  root = this\n  INVALID'),
    [{ source: 'root = this\nINVALID', line: 2, language: 'bloblang' }]
  );
});

test('inventory includes invalid YAML in an unclosed final page fence', () => {
  const path = 'docs/review-eof-fence.mdx';
  try {
    writeFileSync(
      path,
      '# Example\n\n```yaml\ninput: {generate: {}}\noutput: [invalid'
    );
    const file = discoverPipelineFiles(process.cwd()).find(
      (file) => file.sourcePath === path
    );
    assert.ok(file);
    assert.equal(file.kind, 'invalid-yaml');
    assert.equal(file.sourceLine, 4);
  } finally {
    rmSync(path, { force: true });
  }
});
