import test from "node:test";
import assert from "node:assert/strict";
import { createQueueLayer } from "../src/layers/02-queue/index.js";
import { createWorkerLayer } from "../src/layers/03-worker/index.js";
import type { RunTask } from "../src/shared/types/runTask.js";
import { TimeoutError } from "../src/shared/errors/TimeoutError.js";

function createTask(id: string, input: string): RunTask {
  return {
    id,
    sessionId: "session_test",
    input,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

async function waitForCondition(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const startedAt = Date.now();
  while (!predicate()) {
    if (Date.now() - startedAt > timeoutMs) {
      throw new Error(`Condition was not met within ${timeoutMs}ms.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

test("worker pool can process multiple queued tasks concurrently", async () => {
  const queue = createQueueLayer();
  let activeRuns = 0;
  let maxActiveRuns = 0;
  let startedRuns = 0;
  let releaseRuns: (() => void) | undefined;

  const allStarted = new Promise<void>((resolve) => {
    releaseRuns = resolve;
  });

  const worker = createWorkerLayer({
    queue,
    harness: {
      async runTask(task) {
        void task;
        activeRuns += 1;
        maxActiveRuns = Math.max(maxActiveRuns, activeRuns);
        startedRuns += 1;
        if (startedRuns === 2) {
          releaseRuns?.();
        }
        await allStarted;
        await new Promise((resolve) => setTimeout(resolve, 5));
        activeRuns -= 1;
        return {
          runId: `run_${task.id}`,
          taskId: task.id,
          sessionId: task.sessionId,
          success: true,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          selectedSkills: [],
          loadedDocuments: [],
          stepsUsed: 0,
          finalAnswer: task.input,
          toolSummaryCount: 0,
        };
      },
    },
    config: {
      workerCount: 2,
      heartbeatIntervalMs: 50,
    },
  });

  worker.start();
  await queue.enqueue(createTask("task_one", "first"));
  await queue.enqueue(createTask("task_two", "second"));

  const [firstResult, secondResult] = await Promise.all([
    queue.waitForCompletion("task_one"),
    queue.waitForCompletion("task_two"),
  ]);

  assert.equal(firstResult.status, "done");
  assert.equal(secondResult.status, "done");
  assert.equal(maxActiveRuns, 2);
});

test("worker heartbeat reports pool activity and queue depth", async () => {
  const queue = createQueueLayer();
  const heartbeats: Array<{
    activeWorkers: number;
    idleWorkers: number;
    queueDepth: number;
    completedTasks: number;
    failedTasks: number;
  }> = [];
  let releaseRun: (() => void) | undefined;

  const blockedRun = new Promise<void>((resolve) => {
    releaseRun = resolve;
  });

  const worker = createWorkerLayer({
    queue,
    harness: {
      async runTask(task) {
        void task;
        await blockedRun;
        return {
          runId: `run_${task.id}`,
          taskId: task.id,
          sessionId: task.sessionId,
          success: true,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          selectedSkills: [],
          loadedDocuments: [],
          stepsUsed: 0,
          finalAnswer: task.input,
          toolSummaryCount: 0,
        };
      },
    },
    heartbeatPublisher: {
      publish(event) {
        heartbeats.push({
          activeWorkers: event.activeWorkers,
          idleWorkers: event.idleWorkers,
          queueDepth: event.queueDepth,
          completedTasks: event.completedTasks,
          failedTasks: event.failedTasks,
        });
      },
    },
    config: {
      workerCount: 1,
      heartbeatIntervalMs: 10,
    },
  });

  worker.start();
  await queue.enqueue(createTask("task_one", "first"));
  await queue.enqueue(createTask("task_two", "second"));

  await waitForCondition(() =>
    heartbeats.some((event) => event.activeWorkers === 1 && event.idleWorkers === 0 && event.queueDepth === 1),
  );

  releaseRun?.();
  await Promise.all([
    queue.waitForCompletion("task_one"),
    queue.waitForCompletion("task_two"),
  ]);

  assert.ok(heartbeats.some((event) => event.completedTasks >= 1));
  assert.ok(heartbeats.some((event) => event.activeWorkers === 1 && event.queueDepth === 1));
  assert.ok(heartbeats.some((event) => event.failedTasks === 0));
});

test("worker marks timeout failures with failure kind", async () => {
  const queue = createQueueLayer();
  const worker = createWorkerLayer({
    queue,
    harness: {
      async runTask() {
        throw new TimeoutError("Run exceeded timeout of 123ms.");
      },
    },
    config: {
      workerCount: 1,
      heartbeatIntervalMs: 10,
    },
  });

  worker.start();
  await queue.enqueue(createTask("task_timeout", "slow"));
  const result = await queue.waitForCompletion("task_timeout");

  assert.equal(result.status, "failed");
  assert.equal(result.task.failureKind, "timeout");
});
