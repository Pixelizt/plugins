import assert from "node:assert/strict";
import { test } from "node:test";
import { moveTab } from "./logic.ts";

test("arrows wrap, Home and End jump, other keys do nothing", () => {
  assert.equal(moveTab(0, 3, "ArrowRight"), 1);
  assert.equal(moveTab(2, 3, "ArrowRight"), 0);
  assert.equal(moveTab(0, 3, "ArrowLeft"), 2);
  assert.equal(moveTab(1, 3, "ArrowRight", true), 0);
  assert.equal(moveTab(1, 3, "Home"), 0);
  assert.equal(moveTab(0, 3, "End"), 2);
  assert.equal(moveTab(0, 3, "Enter"), null);
  assert.equal(moveTab(0, 0, "ArrowRight"), null);
});
