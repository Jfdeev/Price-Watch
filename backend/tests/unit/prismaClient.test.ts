import { afterEach, describe, expect, it } from "vitest";
import { buildLogOptions } from "../../src/prisma/client";

const original = process.env.PRISMA_QUERY_EVENTS;

afterEach(() => {
  if (original === undefined) {
    delete process.env.PRISMA_QUERY_EVENTS;
  } else {
    process.env.PRISMA_QUERY_EVENTS = original;
  }
});

describe("buildLogOptions", () => {
  it("does not log queries by default", () => {
    delete process.env.PRISMA_QUERY_EVENTS;
    expect(buildLogOptions()).toEqual([]);
  });

  it("emits query events when PRISMA_QUERY_EVENTS is 1", () => {
    process.env.PRISMA_QUERY_EVENTS = "1";
    expect(buildLogOptions()).toEqual([{ emit: "event", level: "query" }]);
  });

  it("ignores other values", () => {
    process.env.PRISMA_QUERY_EVENTS = "true";
    expect(buildLogOptions()).toEqual([]);
  });
});
