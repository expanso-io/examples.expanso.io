import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as runtime from 'react/jsx-runtime';
import pipelineCodeBadges from '../../plugins/pipeline-code-badges';
import { GENERATED_EXPLORER_STAGE_CONFIGS } from '../../src/catalog/explorerStageConfigs.generated';
import { classifyPipelineCode } from '../../src/lib/pipelineCode';
import { bindCanonicalExplorerStages } from '../../src/catalog/explorerStageBinding';
import { normalizeExplorerStages } from '../../src/components/ExplorerV2/normalize';

test('imported YAML CodeBlocks receive classification and link props during compilation', async () => {
  const [
    { unified },
    { default: remarkParse },
    { default: remarkMdx },
    { VFile },
  ] = await Promise.all([
    import('unified'),
    import('remark-parse'),
    import('remark-mdx'),
    import('vfile'),
  ]);

  const processor = unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(pipelineCodeBadges);

  const file = new VFile({
    path: 'docs/data-security/remove-pii/complete-pipeline.mdx',
    value:
      'import pipelineYaml from \'!!raw-loader!../../../examples/data-security/remove-pii.yaml\';\n\n<CodeBlock language="yaml">\n{pipelineYaml}\n</CodeBlock>',
  });

  const tree = await processor.run(processor.parse(file), file);

  const element = tree.children.find(
    (node) => node.type === 'mdxJsxFlowElement'
  );

  assert.ok(element && element.type === 'mdxJsxFlowElement');

  const props = Object.fromEntries(
    element.attributes.flatMap((attribute) =>
      attribute.type === 'mdxJsxAttribute'
        ? [[attribute.name, attribute.value]]
        : []
    )
  );

  assert.equal(props.pipelineCodeKind, 'complete');
  assert.equal(
    props.completePipelineHref,
    '/data-security/remove-pii/complete-pipeline/'
  );
});

test('compiled MDX delivers pipeline classifications without browser parsing', async () => {
  const { evaluate } = await import('@mdx-js/mdx');

  const { default: Content } = await evaluate(
    {
      path: 'docs/data-security/remove-pii/step.mdx',
      value:
        '```yaml\ninput:\n  stdin: {}\noutput:\n  stdout: {}\n```\n\n' +
        '```bloblang\nroot = this\n```\n\n' +
        '```yaml\napiVersion: v1\nkind: Pod\n```\n\n' +
        '```sh\necho hello\n```',
    },
    { ...runtime, remarkPlugins: [pipelineCodeBadges] }
  );

  const kinds: Array<string | undefined> = [];
  const links: Array<string | undefined> = [];

  renderToStaticMarkup(
    createElement(Content, {
      components: {
        code: ({
          pipelineCodeKind,
          completePipelineHref,
          children,
        }: {
          pipelineCodeKind?: string;
          completePipelineHref?: string;
          children?: string;
        }) => {
          kinds.push(pipelineCodeKind);
          links.push(completePipelineHref);

          return createElement('code', null, children);
        },
      },
    })
  );

  assert.deepEqual(kinds, ['complete', 'fragment', undefined, undefined]);
  assert.deepEqual(links, [
    '/data-security/remove-pii/complete-pipeline/',
    '/data-security/remove-pii/complete-pipeline/',
    undefined,
    undefined,
  ]);
});

test('generated Explorer classifications survive binding and normalization', () => {
  for (const family of Object.values(GENERATED_EXPLORER_STAGE_CONFIGS)) {
    assert.equal(
      family.fullPipelineCodeKind,
      classifyPipelineCode(family.fullYaml) ?? 'fragment'
    );

    const bound = bindCanonicalExplorerStages(
      family.binding,
      family.stages,
      family.fullYaml,
      family.fullYamlFilename,
      family
    );

    const normalized = normalizeExplorerStages(
      bound,
      family.binding.provenance
    );

    for (const stage of normalized) {
      assert.equal(
        stage.pipelineCodeKind,
        classifyPipelineCode(stage.yamlCode) ?? 'fragment'
      );
    }
  }
});
