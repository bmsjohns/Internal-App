import type { ShowEvent } from "@/lib/types";

export type EventOperationalStage = "Planning" | "Preparing" | "Ready" | "Live" | "Reconciliation" | "Complete";
export type EventTaskStatus = "todo" | "doing" | "done";

export interface EventTaskPreview {
  id: string;
  title: string;
  category: "Event" | "Marketing" | "Stock" | "People" | "Venue" | "Follow-up";
  owner: string;
  dueDate: string;
  status: EventTaskStatus;
  priority: "normal" | "high";
}

export interface LumaTicketTypePreview {
  id: string;
  name: string;
  price: number;
  issued: number;
  checkedIn: number;
  color: string;
}

export interface LumaPreview {
  connected: boolean;
  eventId: string;
  eventUrl: string;
  status: "on_sale" | "sold_out" | "draft" | "ended";
  capacity: number;
  approved: number;
  pending: number;
  waitlist: number;
  declined: number;
  complimentary: number;
  checkedIn: number;
  lastSyncedAt: string;
  ticketTypes: LumaTicketTypePreview[];
}

export interface EventStockPreview {
  id: string;
  title: string;
  isbn: string;
  supplier: string;
  minimum: number;
  ordered: number;
  received: number;
  reserved: number;
  sold: number;
  returned: number;
  expectedDate: string;
  status: "Not linked" | "Order placed" | "Part received" | "Ready" | "Reconciled";
}

export interface EventResultPreview {
  attendance: number;
  noShows: number;
  walkIns: number;
  booksSold: number;
  ticketRevenue: number;
  bookRevenue: number;
  directCosts: number;
  retrospective: string;
}

export interface EventOperationsPreview {
  mode: "preview";
  stage: EventOperationalStage;
  tasks: EventTaskPreview[];
  luma: LumaPreview;
  stock: EventStockPreview[];
  results: EventResultPreview;
}

const DAY = 86_400_000;

function dayOffset(iso: string, offset: number): string {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function hash(input: string): number {
  let n = 7;
  for (const char of input) n = (n * 31 + char.charCodeAt(0)) >>> 0;
  return n;
}

function daysUntil(iso: string): number {
  if (!iso) return 90;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(`${iso}T00:00:00`).getTime() - today.getTime()) / DAY);
}

function taskStatus(index: number, days: number, confirmed: boolean): EventTaskStatus {
  if (days < 0) return index === 8 ? "doing" : "done";
  if (!confirmed) return index < 2 ? "doing" : "todo";
  if (days <= 7) return index < 6 ? "done" : index < 8 ? "doing" : "todo";
  if (days <= 28) return index < 4 ? "done" : index < 6 ? "doing" : "todo";
  return index < 2 ? "done" : index === 2 ? "doing" : "todo";
}

function buildTasks(event: ShowEvent): EventTaskPreview[] {
  const days = daysUntil(event.date);
  const confirmed = event.status.toLowerCase() === "confirmed";
  const rows: Omit<EventTaskPreview, "id" | "status">[] = [
    { title: "Confirm venue, capacity & access", category: "Venue", owner: "Ben Johns", dueDate: dayOffset(event.date, -42), priority: "high" },
    { title: "Publish Luma event page", category: "Event", owner: "Charlotte Moore", dueDate: dayOffset(event.date, -35), priority: "high" },
    { title: "Approve artwork & campaign copy", category: "Marketing", owner: "Charlotte Moore", dueDate: dayOffset(event.date, -28), priority: "normal" },
    { title: "Place lead-title stock order", category: "Stock", owner: "Lynsey Thomas", dueDate: dayOffset(event.date, -21), priority: "high" },
    { title: "Confirm host and event team", category: "People", owner: "Ben Johns", dueDate: dayOffset(event.date, -14), priority: "normal" },
    { title: "Check ticket pace and marketing push", category: "Marketing", owner: "Charlotte Moore", dueDate: dayOffset(event.date, -10), priority: "normal" },
    { title: "Confirm stock delivery & signing set-up", category: "Stock", owner: "Lynsey Thomas", dueDate: dayOffset(event.date, -5), priority: "high" },
    { title: "Send final call sheet", category: "People", owner: "Ben Johns", dueDate: dayOffset(event.date, -2), priority: "high" },
    { title: "Reconcile attendance, stock and sales", category: "Follow-up", owner: "Ben Johns", dueDate: dayOffset(event.date, 1), priority: "high" },
    { title: "Send publisher sales report", category: "Follow-up", owner: "Lynsey Thomas", dueDate: dayOffset(event.date, 3), priority: "normal" },
  ];
  return rows.map((row, index) => ({ ...row, id: `preview-task-${index + 1}`, status: taskStatus(index, days, confirmed) }));
}

function buildLuma(event: ShowEvent): LumaPreview {
  const linked = Boolean(event.lumaLink);
  const seed = hash(event.id || event.name);
  const days = daysUntil(event.date);
  const capacity = event.bookTicket || event.ticketOnly || (event.venueName.includes("café") ? 45 : event.venueName.includes("Simply") ? 60 : 150);
  if (!linked) {
    return {
      connected: false,
      eventId: "",
      eventUrl: "",
      status: "draft",
      capacity,
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

  const pace = days < 0 ? 0.92 : days <= 7 ? 0.88 : days <= 21 ? 0.68 : 0.42;
  const approved = Math.min(capacity, Math.max(8, Math.round(capacity * pace) + (seed % 7) - 3));
  const bookIssued = Math.min(approved, Math.round(approved * (event.bookTicket ? 0.72 : 0.2)));
  const comp = Math.max(2, Math.round(capacity * 0.04));
  const ticketOnlyIssued = Math.max(0, approved - bookIssued - comp);
  const checkedIn = days < 0 ? Math.round(approved * 0.87) : days === 0 ? Math.round(approved * 0.61) : 0;
  const checkRatio = approved ? checkedIn / approved : 0;
  const waitlist = approved >= capacity ? 12 + (seed % 9) : days <= 7 ? seed % 5 : 0;

  return {
    connected: true,
    eventId: `evt-${(event.id || String(seed)).replace(/^ev-/, "")}`,
    eventUrl: event.lumaLink,
    status: days < 0 ? "ended" : approved >= capacity ? "sold_out" : "on_sale",
    capacity,
    approved,
    pending: seed % 4,
    waitlist,
    declined: 3 + (seed % 6),
    complimentary: comp,
    checkedIn,
    lastSyncedAt: new Date(Date.now() - 2 * 60_000).toISOString(),
    ticketTypes: [
      { id: "book-ticket", name: "Book + ticket", price: 27.5, issued: bookIssued, checkedIn: Math.round(bookIssued * checkRatio), color: "#AD3B28" },
      { id: "ticket-only", name: "Ticket only", price: 8, issued: ticketOnlyIssued, checkedIn: Math.round(ticketOnlyIssued * checkRatio), color: "#B0812F" },
      { id: "guest", name: "Guest / complimentary", price: 0, issued: comp, checkedIn: Math.round(comp * checkRatio), color: "#5F7355" },
    ].filter((ticket) => ticket.issued > 0),
  };
}

function operationalStage(event: ShowEvent, tasks: EventTaskPreview[]): EventOperationalStage {
  const days = daysUntil(event.date);
  if (days < -3) return "Complete";
  if (days < 0) return "Reconciliation";
  if (days === 0) return "Live";
  if (tasks.every((task) => task.status === "done" || task.category === "Follow-up")) return "Ready";
  if (event.status.toLowerCase() === "confirmed") return "Preparing";
  return "Planning";
}

/**
 * Deterministic, read-only preview data. This is the future integration seam:
 * replace this function with the Luma API + stored operational records without
 * changing the event UI contracts.
 */
export function getEventOperationsPreview(event: ShowEvent): EventOperationsPreview {
  const luma = buildLuma(event);
  const tasks = buildTasks(event);
  const days = daysUntil(event.date);
  const ordered = Math.max(event.minOrder ?? 0, luma.ticketTypes.find((ticket) => ticket.id === "book-ticket")?.issued ?? 0) + 12;
  const received = days <= 5 ? ordered : Math.max(0, ordered - 20);
  const sold = days < 0 ? Math.min(received, Math.round(luma.checkedIn * 0.62)) : 0;
  const stock: EventStockPreview[] = event.leadTitle
    ? [{
        id: "preview-stock-lead",
        title: event.leadTitle,
        isbn: event.isbn,
        supplier: "Gardners",
        minimum: event.minOrder ?? 0,
        ordered,
        received,
        reserved: luma.ticketTypes.find((ticket) => ticket.id === "book-ticket")?.issued ?? 0,
        sold,
        returned: days < -3 ? Math.max(0, received - sold - 8) : 0,
        expectedDate: dayOffset(event.date, -6),
        status: days < -3 ? "Reconciled" : received >= ordered ? "Ready" : received > 0 ? "Part received" : "Order placed",
      }]
    : [];

  const ticketRevenue = luma.ticketTypes.reduce((sum, ticket) => sum + ticket.price * ticket.issued, 0);
  return {
    mode: "preview",
    stage: operationalStage(event, tasks),
    tasks,
    luma,
    stock,
    results: {
      attendance: days < 0 ? luma.checkedIn : 0,
      noShows: days < 0 ? Math.max(0, luma.approved - luma.checkedIn) : 0,
      walkIns: days < 0 ? 7 : 0,
      booksSold: sold,
      ticketRevenue,
      bookRevenue: sold * 20,
      directCosts: days < 0 ? 620 : 0,
      retrospective: days < 0 ? "Strong audience questions and a busy signing. Add a second card reader next time and open doors ten minutes earlier." : "",
    },
  };
}

export function readinessSummary(tasks: EventTaskPreview[], today = new Date()): { done: number; total: number; overdue: number; percent: number } {
  const iso = today.toISOString().slice(0, 10);
  const done = tasks.filter((task) => task.status === "done").length;
  const overdue = tasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < iso).length;
  return { done, total: tasks.length, overdue, percent: tasks.length ? Math.round((done / tasks.length) * 100) : 0 };
}
