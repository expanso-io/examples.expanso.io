import React, { useMemo } from 'react';
import { bindCanonicalExplorerStages } from '../../catalog/explorerStageBinding';
import ExplorerV2 from '../ExplorerV2';
import ExplorerGuide from './ExplorerGuide';
import type { DataPipelineExplorerProps } from './types';

const DataPipelineExplorer: React.FC<DataPipelineExplorerProps> = ({
  exampleId,
  stages: rawStages,
  generatedFamily,
  fullYaml,
  fullYamlFilename,
  title = 'DATA PIPELINE',
  subtitle = 'Curated configuration walkthrough',
}) => {
  const binding = useMemo(() => {
    if (generatedFamily.binding.exampleId !== exampleId) {
      throw new Error(
        `Explorer generated family does not match route: ${exampleId}`
      );
    }

    return generatedFamily.binding;
  }, [exampleId, generatedFamily]);

  const stages = useMemo(
    () =>
      bindCanonicalExplorerStages(
        binding,
        rawStages,
        fullYaml,
        fullYamlFilename,
        generatedFamily
      ),
    [binding, fullYaml, fullYamlFilename, generatedFamily, rawStages]
  );

  return (
    <>
      <ExplorerGuide stages={stages} />
      <ExplorerV2
        exampleId={binding.exampleId}
        stages={stages}
        title={title}
        subtitle={subtitle}
        fullYaml={fullYaml}
        fullPipelineCodeKind={generatedFamily.fullPipelineCodeKind}
        completePipelineHref={generatedFamily.completePipelineHref}
        fullYamlFilename={fullYamlFilename}
        presentation={{ kind: binding.provenance }}
        comparisonMode={binding.comparisonMode}
      />
    </>
  );
};

export default DataPipelineExplorer;
