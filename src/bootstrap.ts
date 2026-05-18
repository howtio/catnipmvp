import { createGatewayLayer } from "./layers/01-gateway/index.js";
import { createQueueLayer } from "./layers/02-queue/index.js";
import { createWorkerLayer } from "./layers/03-worker/index.js";
import { createHarnessLayer } from "./layers/04-harness/index.js";
import { createContextLayer } from "./layers/05-context/index.js";
import { createSkillsLayer } from "./layers/06-skills/index.js";
import { createHeuristicRunnerProvider, createRunnerLayer } from "./layers/07-runner/index.js";
import { createEventBusLayer } from "./layers/08-eventbus/index.js";
import { createToolRegistryLayer } from "./layers/09-tool-registry/index.js";
import { createExecutorLayer } from "./layers/10-executor/index.js";
import { createJsonlLogger } from "./shared/logger/jsonlLogger.js";

export function bootstrapCatnipAgent() {
  const jsonlLogger = createJsonlLogger();
  const eventbus = createEventBusLayer({
    logger: jsonlLogger,
  });
  const toolRegistry = createToolRegistryLayer();
  const runnerProvider = createHeuristicRunnerProvider();
  const executor = createExecutorLayer({
    workspaceRoot: process.cwd(),
    eventbus,
    toolRegistry,
  });
  const runner = createRunnerLayer({
    eventbus,
    toolRegistry,
    provider: runnerProvider,
  });
  const skills = createSkillsLayer();
  const context = createContextLayer();
  const harness = createHarnessLayer({
    context,
    skills,
    runner,
    eventbus,
    reportLogger: jsonlLogger,
  });
  const queue = createQueueLayer();
  const worker = createWorkerLayer({
    queue,
    harness,
    heartbeatPublisher: eventbus,
  });
  const gateway = createGatewayLayer({
    queue,
  });

  return {
    gateway,
    queue,
    worker,
    harness,
    context,
    skills,
    runner,
    eventbus,
    toolRegistry,
    executor,
    jsonlLogger,
  };
}
