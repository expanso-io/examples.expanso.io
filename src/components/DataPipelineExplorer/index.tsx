import React, { useMemo } from 'react';
import { resolveCatalogExplorerBinding } from '../../catalog/explorerBinding';
import { bindCanonicalExplorerStages } from '../../catalog/explorerStageBinding';
import ExplorerV2 from '../ExplorerV2';
import type { ExplorerPresentation } from '../ExplorerV2';
import type { DataPipelineExplorerProps } from './types';

const provenanceLabels: Record<ExplorerPresentation['kind'], string> = {
  'executed-pipeline': 'Executed pipeline',
  'deterministic-simulation': 'Deterministic simulation',
  'curated-explanation': 'Curated explanation',
};

const DataPipelineExplorer: React.FC<DataPipelineExplorerProps> = ({
  exampleId,
  stages: rawStages,
  fullYaml,
  fullYamlFilename,
  title = 'DATA PIPELINE',
  subtitle = 'Curated configuration walkthrough',
}) => {
  const binding = useMemo(
    () => resolveCatalogExplorerBinding(exampleId),
    [exampleId]
  );
  const stages = useMemo(
    () =>
      bindCanonicalExplorerStages(
        binding,
        rawStages,
        fullYaml,
        fullYamlFilename
      ),
    [binding, fullYaml, fullYamlFilename, rawStages]
  );
  const presentation: ExplorerPresentation = {
    kind: binding.provenance,
    label: provenanceLabels[binding.provenance],
    executionStatus: binding.executionStatus,
    operationalEvidence: binding.operationalEvidence,
    fixtureLabel: binding.fixtureLabel,
  };

  return (
    <ExplorerV2
      exampleId={binding.exampleId}
      stages={stages}
      title={title}
      subtitle={subtitle}
      fullYaml={fullYaml}
      fullYamlFilename={fullYamlFilename}
      presentation={presentation}
      comparisonMode={binding.comparisonMode}
    />
  );
};

export default DataPipelineExplorer;
