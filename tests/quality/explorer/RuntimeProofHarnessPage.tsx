import Head from '@docusaurus/Head';
import { useLocation } from '@docusaurus/router';
import Layout from '@theme/Layout';

import ExplorerV2, {
  type ExplorerPresentation,
  type ExplorerStage,
} from '../../../src/components/ExplorerV2';
import RuntimeExplorer from '../../../src/components/ExplorerV2/runtime/RuntimeExplorer';
import {
  disconnectedEdgeCheckpoints,
  disconnectedEdgeEvidence,
  disconnectedEdgeSource,
} from '../../../src/components/ExplorerV2/runtime/proof';

const proofPresentation: ExplorerPresentation = {
  kind: 'curated-explanation',
  label: 'Curated explanation',
  executionStatus: 'architecture-only',
  operationalEvidence: 'not-assessed',
  fixtureLabel: 'Component proof fixture',
};

const denseLines = Array.from({ length: 180 }, (_, index) => ({
  content: `sensor-${String(index + 1).padStart(3, '0')}: nominal`,
  indent: index % 3,
  state: index % 11 === 0 ? ('changed' as const) : ('unchanged' as const),
}));

const oneStageFixture: ExplorerStage[] = [
  {
    slug: 'one-stage-with-a-deliberately-long-name',
    title:
      'Normalize a deliberately long industrial telemetry stage name without clipping its meaning',
    description:
      'A dense, single-stage component fixture for overflow and disabled-navigation behavior.',
    inputLines: denseLines,
    outputLines: denseLines,
    yamlCode: 'pipeline:\n  processors: []\n',
    yamlFilename: 'single-stage.yaml',
    provenance: 'curated-explanation',
    inputFormat: 'text',
    outputFormat: 'text',
  },
];

const malformedFixture: ExplorerStage[] = [
  oneStageFixture[0],
  {
    ...oneStageFixture[0],
    title: 'Duplicate stable identifier',
  },
];

const oversizedFixture: ExplorerStage[] = [
  {
    ...oneStageFixture[0],
    slug: 'oversized-inline-fixture',
    title: 'Oversized inline fixture',
    rawInput: 'x'.repeat(2_000_001),
  },
];

export default function ExplorerRuntimeProofHarnessPage() {
  const location = useLocation();
  const fixtureCase = new URLSearchParams(location.search).get('case');
  const transformationStages =
    fixtureCase === 'zero'
      ? []
      : fixtureCase === 'malformed'
        ? malformedFixture
        : fixtureCase === 'oversized'
          ? oversizedFixture
          : oneStageFixture;
  const showTransformation = fixtureCase !== null;

  return (
    <Layout>
      <Head>
        <title>Runtime Explorer test harness</title>
        <meta
          name="description"
          content="Deterministic Explorer component test harness."
        />
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Head>
      <main>
        {showTransformation ? (
          <ExplorerV2
            exampleId={`component-proof-${fixtureCase}`}
            stages={transformationStages}
            title="Transformation Explorer component proof"
            presentation={proofPresentation}
          />
        ) : (
          <RuntimeExplorer
            title="Disconnected edge simulation"
            source={disconnectedEdgeSource}
            checkpoints={disconnectedEdgeCheckpoints}
            evidence={disconnectedEdgeEvidence}
          />
        )}
      </main>
    </Layout>
  );
}
