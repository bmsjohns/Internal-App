import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { airtableDataSource, clearListCache } from "@/lib/data/airtable";

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const record = { id: "rec1", createdTime: "2026-01-01T00:00:00.000Z", fields: { "Book Title": "Dune" } };

describe("Airtable rate-limit defences", () => {
  beforeEach(() => {
    process.env.AIRTABLE_API_KEY = "test";
    clearListCache();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("retries a 429 with backoff and then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("rate limited", { status: 429 }))
      .mockResolvedValueOnce(ok({ records: [record] }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = airtableDataSource.listOrders();
    await vi.runAllTimersAsync();
    const orders = await promise;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(orders[0].bookTitle).toBe("Dune");
  });

  it("gives up after repeated 429s", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = airtableDataSource.getOrder("rec1");
    await vi.runAllTimersAsync();
    // getOrder swallows errors into null; the retry budget is 1 try + 3 retries.
    expect(await promise).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("coalesces concurrent list reads and caches within the TTL", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ records: [record] }));
    vi.stubGlobal("fetch", fetchMock);

    await Promise.all([airtableDataSource.listOrders(), airtableDataSource.listOrders()]);
    await airtableDataSource.listOrders();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed list read", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("boom", { status: 500 }))
      .mockResolvedValue(ok({ records: [record] }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(airtableDataSource.listOrders()).rejects.toThrow("Airtable 500");
    const orders = await airtableDataSource.listOrders();

    expect(orders).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("invalidates the cache on writes so the next list refetches", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "POST" ? ok(record) : ok({ records: [record] })
    );
    vi.stubGlobal("fetch", fetchMock);

    await airtableDataSource.listOrders();
    await airtableDataSource.createOrder({ bookTitle: "Dune" } as never);
    await airtableDataSource.listOrders();

    const gets = fetchMock.mock.calls.filter(([, init]) => !init?.method);
    expect(gets).toHaveLength(2);
  });
});
