import test from "node:test";
import assert from "node:assert/strict";
import { parseCliArgs, parseInteractiveCommand } from "../src/layers/01-gateway/wrapper.js";

test("parseCliArgs reads single-run input text", () => {
  const parsed = parseCliArgs(["readme", "and", "git", "diff"]);

  assert.equal(parsed.showHelp, false);
  assert.equal(parsed.interactive, false);
  assert.equal(parsed.debug, false);
  assert.deepEqual(parsed.tasks, ["readme and git diff"]);
});

test("parseCliArgs detects interactive and help flags", () => {
  const parsed = parseCliArgs(["--interactive", "--help", "--debug"]);

  assert.equal(parsed.showHelp, true);
  assert.equal(parsed.interactive, true);
  assert.equal(parsed.debug, true);
  assert.deepEqual(parsed.tasks, []);
});

test("parseCliArgs collects repeated task flags and tasks file", () => {
  const parsed = parseCliArgs([
    "--task",
    "read README",
    "--task",
    "run git diff",
    "--tasks-file",
    "tasks.txt",
  ]);

  assert.deepEqual(parsed.tasks, ["read README", "run git diff"]);
  assert.equal(parsed.tasksFilePath, "tasks.txt");
});

test("parseInteractiveCommand detects slash commands", () => {
  assert.deepEqual(parseInteractiveCommand("/history"), { type: "history" });
  assert.deepEqual(parseInteractiveCommand("/last"), { type: "last" });
  assert.deepEqual(parseInteractiveCommand("/clear"), { type: "clear" });
  assert.deepEqual(parseInteractiveCommand("/exit"), { type: "exit" });
});

test("parseInteractiveCommand preserves task input", () => {
  assert.deepEqual(parseInteractiveCommand("readme and git diff"), {
    type: "task",
    taskInput: "readme and git diff",
  });
});
