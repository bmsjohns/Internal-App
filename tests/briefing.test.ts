import { describe, expect, it } from "vitest";
import {
  addDays,
  briefingEvents,
  dateParts,
  eventVenues,
  fmtMin,
  onShiftNow,
  relLabel,
  splitEventTime,
} from "@/lib/briefing";
import type { ShowEvent } from "@/lib/types";

const show = (over: Partial<ShowEvent>): ShowEvent => ({
  id: "e1", name: "Event", leadTitle: "", isbn: "", date: "2026-07-18", time: "19:30",
  venueId: null, venueName: "", location: null, hostId: null, hostName: "",
  types: [], ages: [], format: "", status: "Confirmed", fromPitchId: null,
  roles: [], schedule: [], legacyStaffing: [], bookTicket: null, ticketOnly: null,
  minOrder: null, lumaLink: "", banners: false, callSheet: [], callSheetSent: false,
  salesReportSent: false, mediaCount: 0, notes: "", createdAt: "",
  ...over,
});

describe("briefing time formatting", () => {
  it("formats minutes the design's compact way", () => {
    expect(fmtMin(480)).toBe("8am");
    expect(fmtMin(510)).toBe("8.30am");
    expect(fmtMin(720)).toBe("12pm");
    expect(fmtMin(0)).toBe("12am");
    expect(fmtMin(1380)).toBe("11pm");
  });

  it("splits event HH:MM into the card's big time + meridiem", () => {
    expect(splitEventTime("19:30")).toEqual({ time: "7.30", ampm: "pm" });
    expect(splitEventTime("10:00")).toEqual({ time: "10", ampm: "am" });
    expect(splitEventTime("")).toEqual({ time: "TBC", ampm: "" });
  });

  it("knows who is on shift now", () => {
    const s = { id: "x", name: "A", role: "", startMin: 540, endMin: 1020 };
    expect(onShiftNow(s, 539)).toBe(false);
    expect(onShiftNow(s, 540)).toBe(true);
    expect(onShiftNow(s, 1020)).toBe(false);
  });
});

describe("briefing dates", () => {
  it("does calendar arithmetic across month ends", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("labels offsets relative to today", () => {
    expect(relLabel(0)).toBe("Today");
    expect(relLabel(1)).toBe("Tomorrow");
    expect(relLabel(-1)).toBe("Yesterday");
    expect(relLabel(3)).toBe("In 3 days");
    expect(relLabel(-2)).toBe("2 days ago");
  });

  it("derives the hero's date parts", () => {
    expect(dateParts("2026-07-18")).toMatchObject({ weekday: "Saturday", dm: "18 July", dmShort: "Sat 18 Jul" });
  });
});

describe("integration name matching (no-ids rule)", () => {
  it("finds the Backstage base by exact case-insensitive name", async () => {
    const { pickBackstageBase } = await import("@/lib/data/briefing-airtable");
    expect(
      pickBackstageBase([
        { id: "app1", name: "Backstage Passes" },
        { id: "app2", name: " backstage " },
        { id: "app3", name: "Customer Orders" },
      ])
    ).toBe("app2");
    expect(pickBackstageBase([{ id: "app1", name: "Orders" }])).toBeNull();
  });

  it("maps Deputy locations to venues by name", async () => {
    const { venueForLocationName } = await import("@/lib/data/briefing-deputy");
    expect(venueForLocationName("Prologue Books")).toBe("prologue");
    expect(venueForLocationName("Weir Mill site")).toBe("prologue");
    expect(venueForLocationName("Simply Books")).toBe("simply");
    expect(venueForLocationName("Bramhall shop")).toBe("simply");
    expect(venueForLocationName("Head Office")).toBeNull();
  });
});

describe("events → briefing columns", () => {
  it("places events by Location, then venue name, else both", () => {
    expect(eventVenues(show({ location: "Prologue" }))).toEqual(["prologue"]);
    expect(eventVenues(show({ venueName: "Simply Books — Bramhall" }))).toEqual(["simply"]);
    expect(eventVenues(show({ venueName: "The Plaza" }))).toEqual(["prologue", "simply"]);
  });

  it("filters to the selected date and sorts by time", () => {
    const cols = briefingEvents(
      [
        show({ id: "late", time: "19:30", venueName: "Prologue" }),
        show({ id: "early", time: "09:00", venueName: "Prologue" }),
        show({ id: "other-day", date: "2026-07-19", venueName: "Prologue" }),
      ],
      "2026-07-18"
    );
    expect(cols.prologue.map((e) => e.id)).toEqual(["early", "late"]);
    expect(cols.simply).toEqual([]);
  });

  it("prefers structured roles for the staff line", () => {
    const e = show({
      roles: [
        { id: "r1", phase: "pre", name: "Set-up", staff: [{ id: "a", name: "Amara" }] },
        { id: "r2", phase: "during", name: "Bar", staff: [{ id: "a", name: "Amara" }, { id: "j", name: "Jack" }] },
      ],
      legacyStaffing: ["Ignored"],
    });
    expect(briefingEvents([e], "2026-07-18").prologue[0]?.staff ?? briefingEvents([e], "2026-07-18").simply[0].staff).toBe("Amara, Jack");
  });
});
