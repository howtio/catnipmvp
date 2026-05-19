import test from "node:test";
import assert from "node:assert/strict";
import { createQueueLayer } from "../src/layers/02-queue/index.js";
import type { RunTask } from "../src/shared/types/runTask.js";

function createTask(id: string, input: string): RunTask {
  return {
    id,
    sessionId: "session_test",
    input,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

test("queue subscription reports pending position updates after dequeue", async () => {
  const queue = createQueueLayer();
  const snapshots: Array<{ id: string; status: string; queuePosition: number | undefined; queueDepth: number }> = [];
  const unsubscribe = queue.subscribe((snapshot) => {
    snapshots.push({
      id: snapshot.task.id,
      status: snapshot.status,
      queuePosition: snapshot.task.queuePosition,
      queueDepth: snapshot.queueDepth,
    });
  });

  await queue.enqueue(createTask("task_one", "first"));
  await queue.enqueue(createTask("task_two", "second"));
  const dequeued = await queue.dequeue();

  unsubscribe();

  assert.equal(dequeued?.id, "task_one");
  assert.deepEqual(
    snapshots
      .filter((snapshot) => snapshot.id === "task_two")
      .map((snapshot) => ({ status: snapshot.status, queuePosition: snapshot.queuePosition, queueDepth: snapshot.queueDepth })),
    [
      { status: "pending", queuePosition: 2, queueDepth: 2 },
      { status: "pending", queuePosition: 1, queueDepth: 1 },
    ],
  );
});
