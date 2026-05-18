import type { RunTask, RunTaskStatus } from "../../shared/types/runTask.js";
import type { QueueLayerApi, QueueTaskSnapshot } from "./types.js";

export function createQueueLayer(): QueueLayerApi {
  const queue: RunTask[] = [];
  const tasks = new Map<string, RunTask>();
  const waiters = new Map<string, Array<(snapshot: QueueTaskSnapshot) => void>>();
  const dequeueWaiters: Array<(task: RunTask) => void> = [];

  function notifyIfCompleted(task: RunTask): void {
    if (task.status !== "done" && task.status !== "failed") {
      return;
    }

    const listeners = waiters.get(task.id);
    if (!listeners || listeners.length === 0) {
      return;
    }

    const snapshot: QueueTaskSnapshot = {
      task: { ...task },
      status: task.status,
    };

    waiters.delete(task.id);
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  return {
    async enqueue(task: RunTask): Promise<void> {
      const storedTask = { ...task };
      tasks.set(storedTask.id, storedTask);
      const nextWaiter = dequeueWaiters.shift();
      if (nextWaiter) {
        nextWaiter(storedTask);
        return;
      }

      queue.push(storedTask);
    },
    async dequeue(): Promise<RunTask | undefined> {
      return queue.shift();
    },
    async waitForTask(): Promise<RunTask> {
      const nextTask = queue.shift();
      if (nextTask) {
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
        return {
          task: { ...task },
          status: task.status,
        };
      }

      return new Promise<QueueTaskSnapshot>((resolve) => {
        const listeners = waiters.get(taskId) ?? [];
        listeners.push(resolve);
        waiters.set(taskId, listeners);
      });
    },
    size(): number {
      return queue.length;
    },
  };
}
