import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { updateConversationStreamingOwner } from "./conversation-streaming-state.ts";
import { ConversationRunStore } from "../../../features/chat/model/conversation-run-store.ts";

const globalStyles = readFileSync(new URL("../../../app/globals.css", import.meta.url), "utf8");
const sidebarConversationItem = readFileSync(
  new URL("../../../features/layouts/components/navigation/sidebar-conversation-item.tsx", import.meta.url),
  "utf8",
);
const recentList = readFileSync(
  new URL("../../../features/recent/components/sections/recent-list.tsx", import.meta.url),
  "utf8",
);

test("a conversation remains streaming until its final run owner finishes", () => {
  const owners = new Map();

  assert.equal(updateConversationStreamingOwner(owners, "conversation-1", "run-1", true), true);
  assert.equal(updateConversationStreamingOwner(owners, "conversation-1", "run-2", true), true);
  assert.equal(updateConversationStreamingOwner(owners, "conversation-1", "run-1", false), true);
  assert.equal(updateConversationStreamingOwner(owners, "conversation-1", "run-2", false), false);
});

test("run owners are isolated by conversation", () => {
  const owners = new Map();

  updateConversationStreamingOwner(owners, "conversation-1", "run-1", true);
  updateConversationStreamingOwner(owners, "conversation-2", "run-2", true);

  assert.equal(updateConversationStreamingOwner(owners, "conversation-1", "run-1", false), false);
  assert.equal(owners.has("conversation-2"), true);
});

test("background completion stays visible until the conversation is viewed", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const store = new ConversationRunStore();
  const statuses = [];
  store.subscribe("conversation-1", () => {
    statuses.push(store.getConversationStatus("conversation-1"));
  });

  store.register("run-1", "conversation-1");
  store.complete("run-1", "conversation-1");
  t.mock.timers.tick(60_000);
  assert.equal(store.getConversationStatus("conversation-1"), "completed");

  store.acknowledgeConversationCompletion("conversation-1");
  assert.equal(store.getConversationStatus("conversation-1"), "idle");
  assert.deepEqual(statuses, ["running", "completed", "idle"]);
});

test("viewing one completed conversation does not clear other completion reminders", () => {
  const store = new ConversationRunStore();
  store.applyCompleted("conversation-1");
  store.applyCompleted("conversation-2");

  store.acknowledgeConversationCompletion("conversation-1");

  assert.equal(store.getConversationStatus("conversation-1"), "idle");
  assert.equal(store.getConversationStatus("conversation-2"), "completed");
});

test("a new run replaces the previous completion reminder", () => {
  const store = new ConversationRunStore();
  store.complete("run-1", "conversation-1");
  store.register("run-2", "conversation-1");
  assert.equal(store.getConversationStatus("conversation-1"), "running");

  store.settle("run-2");
  assert.equal(store.getConversationStatus("conversation-1"), "idle");
});

test("acknowledging a completion does not stop an active run", () => {
  const store = new ConversationRunStore();
  store.register("run-1", "conversation-1");
  store.register("run-2", "conversation-1");
  store.complete("run-1", "conversation-1");
  store.acknowledgeConversationCompletion("conversation-1");

  assert.equal(store.getConversationStatus("conversation-1"), "running");
  store.complete("run-2", "conversation-1");
  assert.equal(store.getConversationStatus("conversation-1"), "completed");
  store.clear();
  assert.equal(store.getConversationStatus("conversation-1"), "idle");
});

test("streaming titles sweep only their text while unread dots remain completion-only", () => {
  const sweepStyles = globalStyles.slice(
    globalStyles.indexOf("@supports ((background-clip: text)"),
    globalStyles.indexOf("@keyframes trace-sweep-move"),
  );

  assert.match(globalStyles, /background-clip:\s*text/);
  assert.match(globalStyles, /-webkit-text-fill-color:\s*transparent/);
  assert.match(globalStyles, /animation:\s*trace-sweep-move/);
  assert.match(globalStyles, /currentColor\s+0%[\s\S]*currentColor\s+100%/);
  assert.match(sweepStyles, /rgb\(255\s+255\s+255\s*\/\s*98%\)/);
  assert.doesNotMatch(sweepStyles, /var\(--primary\)/);
  assert.match(globalStyles, /background-position:\s*100%\s+0[\s\S]*background-position:\s*0%\s+0/);
  assert.doesNotMatch(globalStyles, /background-position:\s*(?:130%|-30%)\s+0/);
  assert.doesNotMatch(globalStyles, /\.trace-sweep::after/);
  assert.match(globalStyles, /prefers-reduced-motion:\s*reduce[\s\S]*\.trace-sweep[\s\S]*animation:\s*none/);

  for (const source of [sidebarConversationItem, recentList]) {
    assert.match(source, /isRunning\s*=\s*streaming\s*\|\|\s*conversationStatus\s*===\s*"running"/);
    assert.match(source, /isRunning\s*&&\s*"trace-sweep"/);
    assert.match(source, /Spinner/);
    assert.match(source, /CheckCircle2/);
    assert.match(source, /text-emerald-6/);
  }
});

test("trace text masks never enclose scrollable group or tool content", (t) => {
  const cases = [
    ["../../../features/agent-groups/components/message-agent-group-trace.tsx", "AccordionItem"],
    ["../../../features/chat/components/message/message-tool-trace.tsx", "li"],
  ];
  const available = cases.filter(([path]) => existsSync(new URL(path, import.meta.url)));
  if (available.length === 0) {
    t.skip("trace components are not part of this custom UI surface");
    return;
  }
  for (const [path, container] of available) {
    const source = readFileSync(new URL(path, import.meta.url), "utf8");
    const openings = source.match(new RegExp(`<${container}\\b[\\s\\S]*?>`, "g")) ?? [];
    assert.ok(openings.length > 0);
    for (const opening of openings) assert.ok(!opening.includes('"trace-sweep"'), `${container} must not paint clipped descendant text`);
    assert.match(source, /trace-sweep/);
  }
});
