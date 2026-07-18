import { afterEach, describe, expect, it, vi } from "vitest";
import { replaceChildren } from "@/lib/data/events-airtable";

describe("Airtable child replacement", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates the full replacement before deleting old rows", async () => {
    process.env.AIRTABLE_API_KEY = "test";
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      if (!init?.method) return new Response(JSON.stringify({ records: [{ id: "old", fields: { Event: ["ev1"] } }] }), { status: 200 });
      if (init.method === "POST") return new Response(JSON.stringify({ records: [{ id: "new" }] }), { status: 200 });
      return new Response(JSON.stringify({ records: [] }), { status: 200 });
    }));
    await replaceChildren("Event Roles", "ev1", [{ Event: ["ev1"], Role: "Door" }]);
    expect(methods).toEqual(["GET", "POST", "DELETE"]);
  });

  it("does not delete the old rows when staging fails", async () => {
    process.env.AIRTABLE_API_KEY = "test";
    const methods: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      methods.push(init?.method ?? "GET");
      if (!init?.method) return new Response(JSON.stringify({ records: [{ id: "old", fields: { Event: ["ev1"] } }] }), { status: 200 });
      return new Response("failed", { status: 500 });
    }));
    await expect(replaceChildren("Event Roles", "ev1", [{ Event: ["ev1"], Role: "Door" }])).rejects.toThrow("Airtable 500");
    expect(methods).toEqual(["GET", "POST"]);
  });
});
