import { describe, expect, it } from "vitest";
import { parseEventBody, parseRoles, parseSchedule } from "@/lib/events-api";

describe("event input validation", () => {
  it("rejects malformed schedule times and empty roles", () => {
    expect(parseSchedule([{ time: "25:00", phase: "pre", title: "Bad" }])).toEqual([]);
    expect(parseRoles([{ phase: "pre", name: "   ", staff: [] }])).toEqual([]);
  });

  it("accepts only a known shop location", () => {
    expect(parseEventBody({ name: "Event", location: "Prologue" }).location).toBe("Prologue");
    expect(parseEventBody({ name: "Event", location: "Stockport" }).location).toBeNull();
  });
});
