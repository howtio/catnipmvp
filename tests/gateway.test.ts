import test from "node:test";
import assert from "node:assert/strict";
import { parseCliArgs } from "../src/layers/01-gateway/wrapper.js";

test("parseCliArgs reads single-run input text", () => {
  const parsed = parseCliArgs(["readme", "and", "git", "diff"]);

  assert.equal(parsed.showHelp, false);
  assert.equal(parsed.interactive, false);
  assert.equal(parsed.inputText, "readme and git diff");
});

test("parseCliArgs detects interactive and help flags", () => {
  const parsed = parseCliArgs(["--interactive", "--help"]);

  assert.equal(parsed.showHelp, true);
  assert.equal(parsed.interactive, true);
  assert.equal(parsed.inputText, undefined);
});
