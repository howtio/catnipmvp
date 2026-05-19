import type { RunTask, RunTaskStatus } from "../../shared/types/runTask.js";
import type { QueueLayerApi, QueueTaskSnapshot } from "./types.js";

export function createQueueLayer(): QueueLayerApi {
  const queue: RunTask[] = [];
  const tasks = new Map<string, RunTask>();
  const waiters = new Map<string, Array<(snapshot: QueueTaskSnapshot) => void>>();
  const dequeueWaiters: Array<(task: RunTask) => void> = [];
  const listeners = new Set<(snapshot: QueueTaskSnapshot) => void>();

  function buildSnapshot(task: RunTask): QueueTaskSnapshot {
    return {
      task: { ...task },
      status: task.status,
      queueDepth: queue.length,
      pendingCount: queue.length,
    };
  }

  function notifyTask(task: RunTask): void {
    const snapshot = buildSnapshot(task);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  function refreshPendingPositions(): void {
    for (const [index, task] of queue.entries()) {
      const nextPosition = index + 1;
      if (task.queuePosition === nextPosition) {
        continue;
      }
      task.queuePosition = nextPosition;
      task.updatedAt = new Date().toISOString();
      notifyTask(task);
    }
  }

  function notifyIfCompleted(task: RunTask): void {
    if (task.status !== "done" && task.status !== "failed") {
      return;
    }

    const listeners = waiters.get(task.id);
    if (!listeners || listeners.length === 0) {
      return;
    }

    const snapshot = buildSnapshot(task);

    waiters.delete(task.id);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  return {
    async enqueue(task: RunTask): Promise<void> {
      const now = new Date().toISOString();
      const storedTask = {
        ...task,
        updatedAt: task.updatedAt ?? now,
        queueEnteredAt: task.queueEnteredAt ?? now,
      };
      tasks.set(storedTask.id, storedTask);
      const nextWaiter = dequeueWaiters.shift();
      if (nextWaiter) {
        storedTask.queuePosition = 0;
        storedTask.updatedAt = new Date().toISOString();
        notifyTask(storedTask);
        nextWaiter(storedTask);
        return;
      }

      queue.push(storedTask);
      storedTask.queuePosition = queue.length;
      storedTask.updatedAt = new Date().toISOString();
      notifyTask(storedTask);
    },
    async dequeue(): Promise<RunTask | undefined> {
      const task = queue.shift();
      if (!task) {
        return undefined;
      }

      task.queuePosition = 0;
      task.updatedAt = new Date().toISOString();
      notifyTask(task);
      refreshPendingPositions();
      return task;
    },
    async waitForTask(): Promise<RunTask> {
      const nextTask = queue.shift();
      if (nextTask) {
        nextTask.queuePosition = 0;
        nextTask.updatedAt = new Date().toISOString();
        notifyTask(nextTask);
        refreshPendingPositions();
        return nextTask;
      }

      return new Promise<RunTask>((resolve) => {
        dequeueWaiters.push(resolve);
      });
    },
    setStatus(taskId: string, status: RunTaskStatus, patch?: Partial<RunTask>): void {
      const task = tasks.get(taskId);
      if (!task) {
        return;
      }

      Object.assign(task, patch);
      task.status = status;
      task.updatedAt = new Date().toISOString();
      if (status === "running") {
        task.queuePosition = 0;
      }
      if (status === "done" || status === "failed") {
        task.queuePosition = 0;
      }
      notifyTask(task);
      notifyIfCompleted(task);
    },
    getStatus(taskId: string): RunTaskStatus | undefined {
      return tasks.get(taskId)?.status;
    },
    getTask(taskId: string): RunTask | undefined {
      const task = tasks.get(taskId);
      return task ? { ...task } : undefined;
    },
    async waitForCompletion(taskId: string): Promise<QueueTaskSnapshot> {
      const task = tasks.get(taskId);
      if (!task) {
        throw new Error(`Task not found: ${taskId}`);
      }

      if (task.status === "done" || task.status === "failed") {
        return buildSnapshot(task);
      }

      return new Promise<QueueTaskSnapshot>((resolve) => {
        const listeners = waiters.get(taskId) ?? [];
        listeners.push(resolve);
        waiters.set(taskId, listeners);
      });
    },
    subscribe(listener: (snapshot: QueueTaskSnapshot) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    size(): number {
      return queue.length;
    },
  };
}
