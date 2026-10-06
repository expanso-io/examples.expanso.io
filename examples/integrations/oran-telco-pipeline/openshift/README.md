# O-RAN telemetry on Single-Node OpenShift

Manifests for running the Expanso Edge agent on an SNO node under the
restricted-v2 SCC, with the three destinations the pipeline writes to:

| Destination   | What is on the cluster                                   | Pipeline side                                  |
| ------------- | -------------------------------------------------------- | ---------------------------------------------- |
| Observability | OpenTelemetry Collector + ServiceMonitor (user workload) | OTLP/HTTP JSON to `oran-collector:4318`        |
| Storage       | PersistentVolumeClaim `oran-telemetry-data` at `/data`   | `parquet_encode` batches written as `.parquet` |
| Analytics     | AMQ Streams Kafka, TLS listener 9093, SCRAM-SHA-512 user | `kafka` output with the cluster CA mounted     |

Apply order and the secrets you create by hand are documented on the example's
setup page: https://examples.expanso.io/integrations/oran-telco-pipeline/setup

The pipeline is not in these manifests. It is deployed through Expanso Cloud
with `expanso-cli job deploy static/pipelines/oran-telco-pipeline.yaml` and is
scheduled onto this agent by the labels in `31-edge-config.yaml`.
