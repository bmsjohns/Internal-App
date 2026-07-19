import { createHmac, timingSafeEqual } from "crypto";
import type { ShowEvent } from "@/lib/types";
import type { LumaCalendarPreview, LumaPreview, LumaTicketTypePreview } from "@/lib/event-operations";

const LUMA_BASE_URL = "https://public-api.luma.com";
const DEFAULT_TIMEZONE = "Europe/London";

type CalendarLocation = LumaCalendarPreview["location"];

interface LumaCalendarConfig extends LumaCalendarPreview {
  apiKey: string;
}

interface LumaEventRecord {
  id: string;
  calendar_id: string;
  name: string;
  url: string;
  start_at: string;
  end_at: string;
  registration_open: boolean;
  spots_remaining: number | null;
  guest_counts: {
    approved: number;
    pending_approval: number;
    waitlist: number;
    invited: number;
    declined: number;
    checked_in: number;
  };
}

interface LumaTicketTypeRecord {
  id: string;
  name: string;
  type: "free" | "paid";
  cents?: number | null;
  currency?: string | null;
  max_capacity?: number | null;
}

interface LumaGuestRecord {
  approval_status?: string;
  event_tickets?: Array<{
    event_ticket_type_id: string;
    checked_in_at?: string | null;
    amount?: number;
  }>;
}

export class LumaApiError extends Error {
  constructor(message: string, readonly status = 500) {
    super(message);
    this.name = "LumaApiError";
  }
}

function configuredCalendars(): LumaCalendarConfig[] {
  const defaults: Array<Omit<LumaCalendarConfig, "apiKey" | "active"> & { apiKeyEnv: string }> = [
    { id: "shared", name: "Backstage Events", slug: "backstage-events", location: "All venues", apiKeyEnv: "LUMA_SHARED_API_KEY" },
    { id: "simply", name: "Simply Books Events", slug: "simply-books", location: "Simply Books", apiKeyEnv: "LUMA_SIMPLY_API_KEY" },
    { id: "prologue", name: "Prologue Events", slug: "prologue", location: "Prologue", apiKeyEnv: "LUMA_PROLOGUE_API_KEY" },
  ];

  let rows = defaults;
  if (process.env.LUMA_CALENDARS_JSON) {
    try {
      const parsed = JSON.parse(process.env.LUMA_CALENDARS_JSON) as typeof defaults;
      if (Array.isArray(parsed) && parsed.length) rows = parsed;
    } catch {
      throw new LumaApiError("LUMA_CALENDARS_JSON is not valid JSON.");
    }
  }

  return rows.map((row) => {
    const apiKey = process.env[row.apiKeyEnv]?.trim() ?? "";
    return { id: row.id, name: row.name, slug: row.slug, location: row.location as CalendarLocation, apiKey, active: Boolean(apiKey) };
  });
}

export function isLumaLive(): boolean {
  return process.env.LUMA_MODE === "live" && configuredCalendars().some((calendar) => calendar.active);
}

export function publicLumaCalendars(): LumaCalendarPreview[] {
  return configuredCalendars().map((calendar) => ({
    id: calendar.id,
    name: calendar.name,
    slug: calendar.slug,
    location: calendar.location,
    active: calendar.active,
  }));
}

function calendarForEvent(event: ShowEvent, id?: string): LumaCalendarConfig {
  const calendars = configuredCalendars();
  const selected = id ? calendars.find((calendar) => calendar.id === id) : undefined;
  if (selected?.active) return selected;
  const preferred = event.location ?? (event.venueName.includes("Simply") ? "Simply Books" : event.venueName.includes("Prologue") ? "Prologue" : "All venues");
  const matching = calendars.find((calendar) => calendar.active && calendar.location === preferred);
  const shared = calendars.find((calendar) => calendar.active && calendar.location === "All venues");
  const calendar = matching ?? shared ?? calendars.find((candidate) => candidate.active);
  if (!calendar) throw new LumaApiError("No active Luma calendar key is configured.", 503);
  return calendar;
}

async function lumaRequest<T>(calendar: LumaCalendarConfig, path: string, init: RequestInit = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await fetch(`${LUMA_BASE_URL}${path}`, {
        ...init,
        cache: "no-store",
        signal: controller.signal,
        headers: {
          accept: "application/json",
          "x-luma-api-key": calendar.apiKey,
          ...(init.body ? { "content-type": "application/json" } : {}),
          ...init.headers,
        },
      });
      if (response.status === 429 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        continue;
      }
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new LumaApiError(`Luma returned ${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}`, response.status);
      }
      return await response.json() as T;
    }
    throw new LumaApiError("Luma rate limit exceeded.", 429);
  } catch (error) {
    if (error instanceof LumaApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") throw new LumaApiError("Luma timed out.", 504);
    throw new LumaApiError(error instanceof Error ? error.message : "Luma request failed.", 502);
  } finally {
    clearTimeout(timeout);
  }
}

function normalizedLumaUrl(value: string): string {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    if (!["lu.ma", "luma.com", "www.luma.com"].includes(url.hostname.toLowerCase())) return "";
    return url.pathname.replace(/\/$/, "").toLowerCase();
  } catch {
    return "";
  }
}

async function findEventByUrl(calendar: LumaCalendarConfig, lumaLink: string): Promise<LumaEventRecord | null> {
  const wanted = normalizedLumaUrl(lumaLink);
  if (!wanted) throw new LumaApiError("Enter a valid lu.ma or luma.com event URL.", 400);
  let cursor = "";
  for (let page = 0; page < 5; page += 1) {
    const query = new URLSearchParams({ pagination_limit: "100", access: "manage" });
    if (cursor) query.set("pagination_cursor", cursor);
    const result = await lumaRequest<{ entries: LumaEventRecord[]; has_more: boolean; next_cursor?: string }>(calendar, `/v1/calendars/events/list?${query}`);
    const match = result.entries.find((entry) => normalizedLumaUrl(entry.url) === wanted);
    if (match) return match;
    if (!result.has_more || !result.next_cursor) return null;
    cursor = result.next_cursor;
  }
  return null;
}

async function resolveEvent(event: ShowEvent): Promise<{ calendar: LumaCalendarConfig; event: LumaEventRecord }> {
  for (const calendar of configuredCalendars().filter((candidate) => candidate.active)) {
    const match = await findEventByUrl(calendar, event.lumaLink);
    if (match) {
      const full = await lumaRequest<LumaEventRecord>(calendar, `/v1/events/get?event_id=${encodeURIComponent(match.id)}`);
      return { calendar, event: full };
    }
  }
  throw new LumaApiError("That Luma event was not found in any configured calendar.", 404);
}

async function listAllGuests(calendar: LumaCalendarConfig, eventId: string): Promise<LumaGuestRecord[]> {
  const guests: LumaGuestRecord[] = [];
  let cursor = "";
  for (let page = 0; page < 20; page += 1) {
    const query = new URLSearchParams({ event_id: eventId, pagination_limit: "100" });
    if (cursor) query.set("pagination_cursor", cursor);
    const result = await lumaRequest<{ entries: LumaGuestRecord[]; has_more: boolean; next_cursor?: string }>(calendar, `/v1/events/guests/list?${query}`);
    guests.push(...result.entries);
    if (!result.has_more || !result.next_cursor) break;
    cursor = result.next_cursor;
  }
  return guests;
}

const TICKET_COLORS = ["#AD3B28", "#B0812F", "#5F7355", "#3D6670", "#6C5A82"];

export async function getLiveLumaPreview(event: ShowEvent): Promise<LumaPreview> {
  const calendars = publicLumaCalendars();
  if (!event.lumaLink) {
    const selected = calendarForEvent(event);
    return {
      connected: false,
      integration: "live",
      canCreate: true,
      eventId: "",
      eventUrl: "",
      calendar: calendars.find((calendar) => calendar.id === selected.id)!,
      availableCalendars: calendars,
      status: "draft",
      capacity: Math.max(0, (event.bookTicket ?? 0) + (event.ticketOnly ?? 0)),
      approved: 0,
      pending: 0,
      waitlist: 0,
      declined: 0,
      complimentary: 0,
      checkedIn: 0,
      lastSyncedAt: "",
      ticketTypes: [],
    };
  }

  const resolved = await resolveEvent(event);
  const [ticketResult, guests] = await Promise.all([
    lumaRequest<{ entries: LumaTicketTypeRecord[] }>(resolved.calendar, `/v1/events/ticket-types/list?event_id=${encodeURIComponent(resolved.event.id)}&include_hidden=true`),
    listAllGuests(resolved.calendar, resolved.event.id),
  ]);
  const ticketCounts = new Map<string, { issued: number; checkedIn: number }>();
  let complimentary = 0;
  for (const guest of guests) {
    for (const ticket of guest.event_tickets ?? []) {
      const counts = ticketCounts.get(ticket.event_ticket_type_id) ?? { issued: 0, checkedIn: 0 };
      counts.issued += 1;
      if (ticket.checked_in_at) counts.checkedIn += 1;
      ticketCounts.set(ticket.event_ticket_type_id, counts);
      if ((ticket.amount ?? 0) === 0) complimentary += 1;
    }
  }
  const ticketTypes: LumaTicketTypePreview[] = ticketResult.entries.map((ticket, index) => ({
    id: ticket.id,
    name: ticket.name,
    price: ticket.type === "paid" ? (ticket.cents ?? 0) / 100 : 0,
    issued: ticketCounts.get(ticket.id)?.issued ?? 0,
    checkedIn: ticketCounts.get(ticket.id)?.checkedIn ?? 0,
    color: TICKET_COLORS[index % TICKET_COLORS.length],
  }));
  const counts = resolved.event.guest_counts;
  const remaining = Math.max(0, resolved.event.spots_remaining ?? 0);
  const capacity = Math.max(counts.approved, counts.approved + remaining, ...ticketResult.entries.map((ticket) => ticket.max_capacity ?? 0));
  const ended = new Date(resolved.event.end_at).getTime() < Date.now();
  const calendar = calendars.find((candidate) => candidate.id === resolved.calendar.id)!;
  return {
    connected: true,
    integration: "live",
    canCreate: true,
    eventId: resolved.event.id,
    eventUrl: resolved.event.url,
    calendar,
    availableCalendars: calendars,
    status: ended ? "ended" : !resolved.event.registration_open ? "draft" : remaining === 0 && capacity > 0 ? "sold_out" : "on_sale",
    capacity,
    approved: counts.approved,
    pending: counts.pending_approval,
    waitlist: counts.waitlist,
    declined: counts.declined,
    complimentary,
    checkedIn: counts.checked_in,
    lastSyncedAt: new Date().toISOString(),
    ticketTypes,
  };
}

function zonedDateTimeToUtc(date: string, time: string, timeZone = DEFAULT_TIMEZONE): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const displayed = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    guess += Date.UTC(year, month - 1, day, hour, minute) - displayed;
  }
  return new Date(guess).toISOString();
}

export async function createLumaEvent(event: ShowEvent, calendarId?: string): Promise<{ id: string; url: string }> {
  if (!event.date || !event.time) throw new LumaApiError("Add an event date and time before pushing to Luma.", 400);
  const calendar = calendarForEvent(event, calendarId);
  const capacity = Math.max(0, (event.bookTicket ?? 0) + (event.ticketOnly ?? 0));
  const name = event.leadTitle ? `${event.name} — ${event.leadTitle}` : event.name;
  const description = [event.format, event.notes].filter(Boolean).join("\n\n");
  const body = {
    name,
    start_at: zonedDateTimeToUtc(event.date, event.time),
    timezone: DEFAULT_TIMEZONE,
    registration_open: false,
    visibility: "private",
    waitlist_status: "enabled",
    show_guest_list: false,
    ...(capacity ? { max_capacity: capacity } : {}),
    ...(description ? { description_md: description } : {}),
    ...(event.venueName ? { geo_address_json: { type: "manual", address: event.venueName } } : {}),
  };
  const created = await lumaRequest<{ id: string }>(calendar, "/v1/events/create", { method: "POST", body: JSON.stringify(body) });
  const full = await lumaRequest<LumaEventRecord>(calendar, `/v1/events/get?event_id=${encodeURIComponent(created.id)}`);
  return { id: created.id, url: full.url };
}

export async function validateLumaEventUrl(event: ShowEvent, url: string): Promise<string> {
  const candidate = { ...event, lumaLink: url };
  const resolved = await resolveEvent(candidate);
  return resolved.event.url;
}

export function verifyLumaWebhook(rawBody: string, signatureHeader: string, secret = process.env.LUMA_WEBHOOK_SECRET ?? ""): boolean {
  if (!secret || !signatureHeader) return false;
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const index = part.indexOf("=");
    return [part.slice(0, index), part.slice(index + 1)];
  }));
  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300 || !parts.v1) return false;
  const expected = createHmac("sha256", secret).update(`${parts.t}.${rawBody}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parts.v1);
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export const lumaInternals = { normalizedLumaUrl, zonedDateTimeToUtc };
