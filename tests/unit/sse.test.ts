import { encodeSseEvent, parseSseChunk } from "@/lib/sse";
import { describe, expect, it } from "vitest";

describe("SSE encode/parse round trip", () => {
  it("parses a single complete event", () => {
    const raw = encodeSseEvent({ type: "token", value: "hi" });
    const { events, rest } = parseSseChunk(raw);

    expect(events).toEqual([{ type: "token", value: "hi" }]);
    expect(rest).toBe("");
  });

  it("parses multiple events arriving in one chunk", () => {
    const raw =
      encodeSseEvent({ type: "token", value: "a" }) +
      encodeSseEvent({ type: "token", value: "b" }) +
      encodeSseEvent({ type: "done", messageId: "m1" });

    const { events, rest } = parseSseChunk(raw);

    expect(events).toEqual([
      { type: "token", value: "a" },
      { type: "token", value: "b" },
      { type: "done", messageId: "m1" },
    ]);
    expect(rest).toBe("");
  });

  it("holds back a partial trailing event until the next chunk", () => {
    const full = encodeSseEvent({ type: "token", value: "hello" });
    const splitPoint = Math.floor(full.length / 2);
    const firstChunk = full.slice(0, splitPoint);
    const secondChunk = full.slice(splitPoint);

    const first = parseSseChunk(firstChunk);
    expect(first.events).toEqual([]);
    expect(first.rest).toBe(firstChunk);

    const second = parseSseChunk(first.rest + secondChunk);
    expect(second.events).toEqual([{ type: "token", value: "hello" }]);
    expect(second.rest).toBe("");
  });

  it("skips malformed data lines instead of throwing", () => {
    const { events } = parseSseChunk("data: {not json}\n\n");
    expect(events).toEqual([]);
  });
});
