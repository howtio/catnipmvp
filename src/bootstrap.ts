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
  "worker.heartbeat",
  "prompt.composed",
  "agent.plan.generated",
  "agent.reasoning.summary",
  "agent.step.finished",
  "tool.call.requested",
  "tool.call.result",
  "tool.call.failed",
  "agent.answer.produced",
]);

function readPositiveIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function readNonNegativeIntegerEnv(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return fallback;
  }

  return parsedValue;
}

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
  eventbus.subscribe("worker.heartbeat", writeTraceEvent);
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
    limits: {
      maxSteps: readPositiveIntegerEnv("CATNIP_RUNNER_MAX_STEPS", 5),
      continueOnToolError: process.env.CATNIP_RUNNER_CONTINUE_ON_TOOL_ERROR === "1",
      maxToolRetries: readNonNegativeIntegerEnv("CATNIP_RUNNER_MAX_TOOL_RETRIES", 0),
    },
  });
  const skills = createSkillsLayer();
  const context = createContextLayer();
  const harness = createHarnessLayer({
    context,
    skills,
    runner,
    eventbus,
    reportLogger: jsonlLogger,
    limits: {
      runTimeoutMs: readPositiveIntegerEnv("CATNIP_RUN_TIMEOUT_MS", 60_000),
    },
  });
  const queue = createQueueLayer();
  const worker = createWorkerLayer({
    queue,
    harness,
    heartbeatPublisher: eventbus,
    config: {
      workerCount: readPositiveIntegerEnv("CATNIP_WORKER_COUNT", 1),
      heartbeatIntervalMs: readPositiveIntegerEnv("CATNIP_WORKER_HEARTBEAT_MS", 1000),
    },
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
