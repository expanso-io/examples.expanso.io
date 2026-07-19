import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestError,
  TestResult,
} from '@playwright/test/reporter';

import {
  ACCESSIBILITY_OBSERVATION_VERSION,
  type AccessibilityObservation,
  type AccessibilityObservationManifest,
} from './accessibility-lib';

const ATTACHMENT_NAME = 'accessibility-observation-v1';
const BLOCKED_CAPABILITY_PATTERN =
  /MachPortRendezvousServer|bootstrap_check_in[\s\S]*Permission denied|Executable doesn't exist[\s\S]*ms-playwright|browser.*closed before the harness could run/i;
const playwrightVersion = JSON.parse(
  readFileSync(resolve('node_modules/@playwright/test/package.json'), 'utf8')
).version as string;

function errorMessage(error: TestError): string {
  return (
    error.message || error.value || error.stack || 'Unknown Playwright error'
  );
}

function observationKey(observation: AccessibilityObservation): string {
  return createHash('sha256')
    .update(
      JSON.stringify([
        observation.routePath,
        observation.oracleId,
        observation.environmentIds,
        observation.themes,
        observation.interactionModes,
        observation.stateIds,
        observation.projectName,
      ])
    )
    .digest('hex');
}

class AccessibilityReporter implements Reporter {
  private startedAt = new Date().toISOString();
  private observations: AccessibilityObservation[] = [];
  private runnerErrors: string[] = [];
  private capabilityBlocks: string[] = [];
  private outputPath = resolve(
    process.env.A11Y_OBSERVATIONS_PATH ??
      'test-results/quality/accessibility/observations.json'
  );

  onBegin(_config: FullConfig, _suite: Suite): void {
    this.startedAt = new Date().toISOString();
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    let attachmentCount = 0;
    for (const attachment of result.attachments) {
      if (attachment.name !== ATTACHMENT_NAME || !attachment.body) continue;
      attachmentCount += 1;
      try {
        const value = JSON.parse(
          attachment.body.toString('utf8')
        ) as AccessibilityObservation;
        this.observations.push({
          ...value,
          observationVersion: ACCESSIBILITY_OBSERVATION_VERSION,
          projectName: test.parent.project()?.name ?? value.projectName,
          durationMs: result.duration,
        });
      } catch (error) {
        this.runnerErrors.push(
          `${test.title}: invalid accessibility observation attachment: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    }

    if (result.status === 'failed' && attachmentCount === 0) {
      const messages = result.errors.map(errorMessage);
      const message = `${test.title}: ${messages.join('\n')}`;
      if (BLOCKED_CAPABILITY_PATTERN.test(message)) {
        this.capabilityBlocks.push(message);
      } else {
        this.runnerErrors.push(message);
      }
    }
  }

  onError(error: TestError): void {
    const message = errorMessage(error);
    if (BLOCKED_CAPABILITY_PATTERN.test(message)) {
      this.capabilityBlocks.push(message);
    } else {
      this.runnerErrors.push(message);
    }
  }

  async onEnd(_result: FullResult): Promise<void> {
    const uniqueObservations = new Map<string, AccessibilityObservation>();
    for (const observation of this.observations) {
      const key = observationKey(observation);
      if (uniqueObservations.has(key)) {
        this.runnerErrors.push(
          `Duplicate accessibility observation was emitted for ${observation.oracleId} on ${observation.routePath}`
        );
      } else {
        uniqueObservations.set(key, observation);
      }
    }

    const manifest: AccessibilityObservationManifest = {
      manifestVersion: 'accessibility-observations-v1',
      startedAt: this.startedAt,
      finishedAt: new Date().toISOString(),
      environment: {
        platform: process.platform,
        architecture: process.arch,
        node: process.versions.node,
        playwright: playwrightVersion,
      },
      observations: [...uniqueObservations.values()].sort((left, right) =>
        `${left.routePath}\0${left.oracleId}`.localeCompare(
          `${right.routePath}\0${right.oracleId}`
        )
      ),
      runnerErrors: [...new Set(this.runnerErrors)].sort(),
      capabilityBlocks: [...new Set(this.capabilityBlocks)].sort(),
    };

    mkdirSync(dirname(this.outputPath), { recursive: true });
    writeFileSync(this.outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

export default AccessibilityReporter;
