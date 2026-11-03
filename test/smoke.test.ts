import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionHandler,
} from "@earendil-works/pi-coding-agent";
import extension from "../src/index.ts";

type Handler = ExtensionHandler<unknown>;

function recordingApi(): { pi: ExtensionAPI; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>();
  const pi = {
    on(event: string, handler: Handler): () => void {
      handlers.set(event, handler);
      return () => {};
    },
  };
  return { pi: pi as unknown as ExtensionAPI, handlers };
}

function nonTuiContext(): { ctx: ExtensionContext; touched: string[] } {
  const touched: string[] = [];
  const target = { mode: "print" } as Record<PropertyKey, unknown>;
  const ctx = new Proxy(target, {
    get(object, property, receiver) {
      if (property === "mode") return Reflect.get(object, property, receiver);
      touched.push(String(property));
      throw new Error(`non-TUI session touched ctx.${String(property)}`);
    },
  });
  return { ctx: ctx as unknown as ExtensionContext, touched };
}

test("the default export is an extension factory", () => {
  assert.equal(typeof extension, "function");
});

test("the extension registers session start and session shutdown handlers", () => {
  const { pi, handlers } = recordingApi();
  extension(pi);
  assert.deepEqual([...handlers.keys()].sort(), ["session_shutdown", "session_start"]);
});

test("session start and shutdown do nothing in a non-TUI session", async () => {
  const { pi, handlers } = recordingApi();
  extension(pi);

  for (const name of ["session_start", "session_shutdown"]) {
    const handler = handlers.get(name);
    assert.ok(handler, `${name} handler is registered`);
    const { ctx, touched } = nonTuiContext();
    await handler({}, ctx);
    assert.deepEqual(touched, [], `${name} leaves ui, events and settings untouched`);
  }
});
