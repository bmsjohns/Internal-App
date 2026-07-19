import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { isLumaLive, lumaInternals, publicLumaCalendars, verifyLumaWebhook } from "@/lib/luma";

describe("Luma integration safety", () => {
  it("normalizes non-finite API numbers before they reach the client", () => {
    expect(lumaInternals.finiteNumber("1250")).toBe(1250);
    expect(lumaInternals.finiteNumber(undefined)).toBe(0);
    expect(lumaInternals.finiteNumber(Number.NaN)).toBe(0);
  });

  it("only exposes the two real shop calendars", () => {
    expect(publicLumaCalendars().map(({ id, name, location }) => ({ id, name, location }))).toEqual([
      { id: "simply", name: "Simply Books", location: "Simply Books" },
      { id: "prologue", name: "Prologue", location: "Prologue" },
    ]);
  });

  it("does not treat the retired shared-key variable as a calendar", () => {
    const previousMode = process.env.LUMA_MODE;
    const previousSharedKey = process.env.LUMA_SHARED_API_KEY;
    const previousSimplyKey = process.env.LUMA_SIMPLY_API_KEY;
    const previousPrologueKey = process.env.LUMA_PROLOGUE_API_KEY;
    process.env.LUMA_MODE = "live";
    process.env.LUMA_SHARED_API_KEY = "retired-key";
    delete process.env.LUMA_SIMPLY_API_KEY;
    delete process.env.LUMA_PROLOGUE_API_KEY;
    expect(isLumaLive()).toBe(false);
    if (previousMode === undefined) delete process.env.LUMA_MODE; else process.env.LUMA_MODE = previousMode;
    if (previousSharedKey === undefined) delete process.env.LUMA_SHARED_API_KEY; else process.env.LUMA_SHARED_API_KEY = previousSharedKey;
    if (previousSimplyKey === undefined) delete process.env.LUMA_SIMPLY_API_KEY; else process.env.LUMA_SIMPLY_API_KEY = previousSimplyKey;
    if (previousPrologueKey === undefined) delete process.env.LUMA_PROLOGUE_API_KEY; else process.env.LUMA_PROLOGUE_API_KEY = previousPrologueKey;
  });

  it("normalizes supported Luma links and rejects lookalike domains", () => {
    expect(lumaInternals.normalizedLumaUrl("https://lu.ma/My-Event/")).toBe("/my-event");
    expect(lumaInternals.normalizedLumaUrl("luma.com/my-event?utm_source=test")).toBe("/my-event");
    expect(lumaInternals.normalizedLumaUrl("https://luma.com.example.org/my-event")).toBe("");
  });

  it("converts London local event times to UTC across daylight saving", () => {
    expect(lumaInternals.zonedDateTimeToUtc("2026-01-15", "19:00")).toBe("2026-01-15T19:00:00.000Z");
    expect(lumaInternals.zonedDateTimeToUtc("2026-07-15", "19:00")).toBe("2026-07-15T18:00:00.000Z");
  });

  it("verifies signed webhooks and rejects tampered bodies", () => {
    const secret = "whsec_test";
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({ type: "event.updated", data: { event_id: "evt-test" } });
    const signature = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
    const header = `t=${timestamp},v1=${signature}`;
    expect(verifyLumaWebhook(body, header, secret)).toBe(true);
    expect(verifyLumaWebhook(`${body} `, header, secret)).toBe(false);
  });
});
