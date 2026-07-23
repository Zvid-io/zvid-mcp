import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isToolEnabled,
  isToolProfile,
  parseToolProfile,
  resolveToolProfile,
} from "../profiles.js";

test("creator profile exposes the promoted quality authoring toolset", () => {
  for (const name of [
    "create_media",
    "revise_media",
    "render_media",
    "plan_creative_video",
    "find_matching_examples",
    "start_from_example",
    "search_creative_library",
    "search_stock_media",
    "validate_project_json",
    "create_project",
    "create_template",
  ]) {
    assert.equal(isToolEnabled("creator", name), true, name);
  }
  assert.equal(isToolEnabled("creator", "create_render"), false);
  assert.equal(isToolEnabled("creator", "create_bulk_render"), false);
  assert.equal(isToolEnabled("creator", "create_webhook"), false);
});

test("profiles progressively expose automation capabilities", () => {
  assert.equal(isToolEnabled("creator", "validate_project_json"), true);
  assert.equal(isToolEnabled("creator", "create_render"), false);
  assert.equal(isToolEnabled("automation", "create_bulk_render"), true);
  assert.equal(isToolEnabled("developer", "anything_registered"), true);
  assert.equal(isToolEnabled("readonly", "get_media"), true);
  assert.equal(isToolEnabled("readonly", "render_media"), false);
});

test("profile parsing and validation are conservative", () => {
  assert.equal(parseToolProfile(undefined), "creator");
  assert.equal(parseToolProfile("AUTOMATION"), "automation");
  assert.equal(parseToolProfile("advanced"), "creator");
  assert.equal(parseToolProfile("unknown"), "creator");
  assert.equal(isToolProfile("advanced"), false);
  assert.equal(resolveToolProfile("advanced"), "creator");
  assert.equal(isToolProfile("ADVANCED"), false);
  assert.equal(isToolProfile("admin"), false);
});
