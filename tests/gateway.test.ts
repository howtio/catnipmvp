import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCliStartupArtLines,
  buildCliStartupFrames,
  buildCliStartupBanner,
  buildInteractiveFollowUpInput,
  formatQueueTimerLine,
  formatRunTimerLine,
  getInteractivePrompt,
  parseCliArgs,
  parseInteractiveCommand,
} from "../src/layers/01-gateway/wrapper.js";

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

test("buildInteractiveFollowUpInput includes prior task and refinements", () => {
  const prompt = buildInteractiveFollowUpInput(
    "write a story about buried giant",
    ["use Wang Xiaobo tone", "shorten the ending"],
    {
      taskId: "task_test",
      ok: true,
      finalAnswer: "First version of the story.",
    },
  );

  assert.match(prompt, /Previous user task: write a story about buried giant/);
  assert.match(prompt, /Previous result summary: First version of the story\./);
  assert.match(prompt, /1\. use Wang Xiaobo tone/);
  assert.match(prompt, /2\. shorten the ending/);
});

test("formatRunTimerLine summarizes elapsed and idle time", () => {
  const line = formatRunTimerLine("1/1 task_test", 12_400, 4_400, "think writing draft");

  assert.equal(line, "[timer] 1/1 task_test elapsed=12s idle=4s last=think writing draft");
});

test("formatQueueTimerLine summarizes waiting time and queue position", () => {
  const line = formatQueueTimerLine("2/2 task_test", 7_600, 2);

  assert.equal(line, "[wait] 2/2 task_test waited=8s pos=2");
});

test("getInteractivePrompt keeps catnip-only prompt", () => {
  assert.equal(getInteractivePrompt(), "catnip> ");
});

test("buildCliStartupBanner prints a pink cat banner", () => {
  const banner = buildCliStartupBanner();

  assert.match(banner, /\u001b\[38;5;213m/);
  assert.match(banner, /Welcome to Catnip/);
  assert.match(banner, /\/\\_________________________\/\\\\/);
  assert.ok(banner.split("\n").length >= 20);
});

test("buildCliStartupArtLines uses the large cat art", () => {
  const lines = buildCliStartupArtLines();

  assert.ok(lines.length >= 20);
  assert.equal(lines[0], "/\\_________________________/\\\\");
  assert.match(lines.join("\n"), /::::::@@::::::/);
});

test("buildCliStartupFrames grows across startup animation", () => {
  const frames = buildCliStartupFrames();

  assert.equal(frames.length, 4);
  assert.ok(frames[0]!.split("\n").length < frames[3]!.split("\n").length);
  assert.match(frames[3]!, /Welcome to Catnip/);
});
