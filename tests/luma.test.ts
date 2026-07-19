import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { lumaInternals, verifyLumaWebhook } from "@/lib/luma";

describe("Luma integration safety", () => {
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
