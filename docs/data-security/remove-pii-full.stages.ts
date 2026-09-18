import type { Stage } from '@site/src/components/DataPipelineExplorer/types';
import canonicalPipelineYaml from '!!raw-loader!../../examples/data-security/remove-pii-complete.yaml';
import expectedOutputJsonl from '!!raw-loader!../../examples/data-security/remove-pii/expected-output.jsonl';
import canonicalFixture from '../../examples/data-security/remove-pii/sample-data.json';
import fixtureEnvironment from '../../examples/data-security/remove-pii/fixture-environment.json';
import { buildRemovePiiExplorerStages } from '@site/src/catalog/removePiiFidelity';

const generatedStages = buildRemovePiiExplorerStages(
  canonicalPipelineYaml,
  JSON.stringify(canonicalFixture),
  JSON.stringify(fixtureEnvironment),
  expectedOutputJsonl
);

export const removePiiFullStages: Stage[] = [
  {
    id: generatedStages[0].id,
    slug: generatedStages[0].slug,
    title: 'Step 1: Original Input',
    description:
      'Start with a synthetic purchase record containing payment, identity, network, and location fields.',
    inputLines: generatedStages[0].inputLines,
    outputLines: generatedStages[0].outputLines,
    yamlCode: generatedStages[0].yamlCode,
    yamlFilename: generatedStages[0].yamlFilename,
  },
  {
    id: generatedStages[1].id,
    slug: generatedStages[1].slug,
    title: 'Step 2: Delete Payment Data',
    description:
      'Delete the full card number and expiry while retaining the last four digits.',
    inputLines: generatedStages[1].inputLines,
    outputLines: generatedStages[1].outputLines,
    yamlCode: generatedStages[1].yamlCode,
    yamlFilename: generatedStages[1].yamlFilename,
  },
  {
    id: generatedStages[2].id,
    slug: generatedStages[2].slug,
    title: 'Step 3: Hash IP Address',
    description:
      'Replace the source IP address with a keyed, hex-encoded HMAC-SHA-256 value.',
    inputLines: generatedStages[2].inputLines,
    outputLines: generatedStages[2].outputLines,
    yamlCode: generatedStages[2].yamlCode,
    yamlFilename: generatedStages[2].yamlFilename,
  },
  {
    id: generatedStages[3].id,
    slug: generatedStages[3].slug,
    title: 'Step 4: Hash Email',
    description:
      'Replace the email with a keyed hash and retain its domain as a separate field.',
    inputLines: generatedStages[3].inputLines,
    outputLines: generatedStages[3].outputLines,
    yamlCode: generatedStages[3].yamlCode,
    yamlFilename: generatedStages[3].yamlFilename,
  },
  {
    id: generatedStages[4].id,
    slug: generatedStages[4].slug,
    title: 'Step 5: Pseudonymize User',
    description:
      'Replace the name with a stable pseudonymous identifier derived from the input.',
    inputLines: generatedStages[4].inputLines,
    outputLines: generatedStages[4].outputLines,
    yamlCode: generatedStages[4].yamlCode,
    yamlFilename: generatedStages[4].yamlFilename,
  },
  {
    id: generatedStages[5].id,
    slug: generatedStages[5].slug,
    title: 'Step 6: Generalize Location',
    description:
      'Remove precise coordinates while retaining the fixture city and country.',
    inputLines: generatedStages[5].inputLines,
    outputLines: generatedStages[5].outputLines,
    yamlCode: generatedStages[5].yamlCode,
    yamlFilename: generatedStages[5].yamlFilename,
  },
];
