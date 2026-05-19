import { createGatewayLayer } from "./layers/01-gateway/index.js";
import { createQueueLayer } from "./layers/02-queue/index.js";
import { createWorkerLayer } from "./layers/03-worker/index.js";
import { createHarnessLayer } from "./layers/04-harness/index.js";
import { createContextLayer } from "./layers/05-context/index.js";
import { createSkillsLayer } from "./layers/06-skills/index.js";
import { createRunnerLayer, createRunnerProviderFromEnv } from "./layers/07-runner/index.js";
import { createEventBusLayer } from "./layers/08-eventbus/index.js";
import { createToolRegistryLayer } from "./layers/09-tool-registry/index.js";
import { createExecutorLayer } from "./layers/10-executor/index.js";
import { createJsonlLogger } from "./shared/logger/jsonlLogger.js";
import { loadLocalEnvFiles } from "./shared/utils/loadLocalEnv.js";
import type { EventBusEvent } from "./layers/08-eventbus/index.js";

const TRACE_EVENT_TYPES = new Set([
  "run.started",
  "run.finished",
  "run.heartbeat",
  "prompt.composed",
  "agent.plan.generated",
  "agent.reasoning.summary",
  "agent.step.finished",
  "tool.call.requested",
  "tool.call.result",
  "tool.call.failed",
  "agent.answer.produced",
]);

export function bootstrapCatnipAgent() {
  loadLocalEnvFiles();
  const jsonlLogger = createJsonlLogger();
  const traceLogger = createJsonlLogger({
    filePath: `${process.cwd()}/logs/catnip-trace.jsonl`,
  });
  const eventbus = createEventBusLayer({
    logger: jsonlLogger,
  });
  eventbus.subscribe("prompt.composed", writeTraceEvent);
  eventbus.subscribe("agent.plan.generated", writeTraceEvent);
  eventbus.subscribe("agent.reasoning.summary", writeTraceEvent);
  eventbus.subscribe("tool.call.requested", writeTraceEvent);
  eventbus.subscribe("tool.call.result", writeTraceEvent);
  eventbus.subscribe("tool.call.failed", writeTraceEvent);
  eventbus.subscribe("agent.answer.produced", writeTraceEvent);
  const toolRegistry = createToolRegistryLayer();
  const runnerProvider = createRunnerProviderFromEnv();
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
    eventbus,
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

  function writeTraceEvent(event: EventBusEvent): void {
    if (!TRACE_EVENT_TYPES.has(event.type)) {
      return;
    }

    traceLogger.write({
      ts: new Date().toISOString(),
      event: event.type,
      payload: event,
    });
  }
}
