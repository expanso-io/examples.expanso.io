import type { Root } from 'mdast';
import type {} from 'mdast-util-mdx';
import type {} from 'mdast-util-to-hast';
import type { VFile } from 'vfile';
import { readFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { completePipelineRouteForPath } from '../src/catalog/completePipelineRoutes';
import {
  classifyPipelineCode,
  isPipelineCodeLanguage,
} from '../src/lib/pipelineCode';

/** Classify static code during MDX compilation, rather than in the browser. */
export default function pipelineCodeBadges() {
  return async (tree: Root, file: VFile) => {
    const pagePath = file.path
      ? relative(resolve(file.cwd, 'docs'), file.path).split(sep).join('/')
      : '';

    const completeHref = completePipelineRouteForPath(`/${pagePath}`);
    const { visit } = await import('unist-util-visit');
    const importedCode = new Map<string, string>();

    visit(tree, 'mdxjsEsm', (node) => {
      for (const statement of node.data?.estree?.body ?? []) {
        if (statement.type !== 'ImportDeclaration') continue;

        const source = String(statement.source.value);

        if (!source.startsWith('!!raw-loader!')) continue;

        const code = readFileSync(
          resolve(dirname(file.path), source.slice('!!raw-loader!'.length)),
          'utf8'
        );

        for (const specifier of statement.specifiers) {
          if (specifier.type === 'ImportDefaultSpecifier')
            importedCode.set(specifier.local.name, code);
        }
      }
    });

    visit(tree, 'mdxJsxFlowElement', (node) => {
      if (node.name !== 'CodeBlock') return;

      const language = node.attributes.find(
        (attribute) =>
          attribute.type === 'mdxJsxAttribute' && attribute.name === 'language'
      );

      if (
        !language ||
        language.type !== 'mdxJsxAttribute' ||
        !isPipelineCodeLanguage(String(language.value))
      )
        return;

      for (const child of node.children) {
        if (child.type !== 'mdxFlowExpression') continue;

        const statement = child.data?.estree?.body[0];

        if (
          statement?.type !== 'ExpressionStatement' ||
          statement.expression.type !== 'Identifier'
        )
          continue;

        const code = importedCode.get(statement.expression.name);

        if (code === undefined) continue;

        const kind = classifyPipelineCode(code, String(language.value));

        if (!kind) continue;

        node.attributes.push({
          type: 'mdxJsxAttribute',
          name: 'pipelineCodeKind',
          value: kind,
        });

        if (completeHref)
          node.attributes.push({
            type: 'mdxJsxAttribute',
            name: 'completePipelineHref',
            value: completeHref,
          });
      }
    });

    visit(tree, 'code', (node) => {
      if (!isPipelineCodeLanguage(node.lang ?? '')) return;
      const kind = classifyPipelineCode(node.value, node.lang ?? 'yaml');

      if (!kind) return;
      node.data ??= {};
      node.data.hProperties ??= {};
      node.data.hProperties.pipelineCodeKind = kind;

      if (completeHref)
        node.data.hProperties.completePipelineHref = completeHref;
    });
  };
}
