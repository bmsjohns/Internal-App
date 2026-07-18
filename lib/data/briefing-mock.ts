import type { VenueKey } from "@/lib/config";
import type {
  BriefingDay,
  BriefTask,
  ShiftEntry,
  SlackMessage,
  UrgentAlert,
  VenueBriefing,
  WrapUp,
} from "@/lib/briefing";
import { addDays, dateParts, todayLondon } from "@/lib/briefing";
import type { BriefingDataSource } from "./briefing-source";

// In-memory mock briefing source (DATA_SOURCE=mock / no Deputy token yet).
// Seed data mirrors the Claude Design file so the page renders exactly the
// composition that was signed off. Mutations (task ticks, wrap-ups, alerts)
// live in module-level maps — they survive navigation but reset with the
// dev server, which is fine for mock mode.

const ROSTER: Record<VenueKey, Omit<ShiftEntry, "id">[]> = {
  prologue: [
    { name: "Priya Shah", role: "Duty manager", startMin: 510, endMin: 1020 },
    { name: "Amara Osei", role: "Floor & coffee", startMin: 480, endMin: 960 },
    { name: "Tom Beckett", role: "Events & bar set-up", startMin: 720, endMin: 1200 },
    { name: "Jack Reilly", role: "Bar", startMin: 900, endMin: 1380 },
  ],
  simply: [
    { name: "Grace Lund", role: "Duty manager", startMin: 570, endMin: 1080 },
    { name: "Ellie Turner", role: "Bookseller", startMin: 540, endMin: 1050 },
    { name: "Sam Doyle", role: "Bookseller · kids", startMin: 540, endMin: 900 },
  ],
};

const TASK_SEED: Record<VenueKey, { id: string; title: string; meta: string; done?: boolean }[]> = {
  prologue: [
    { id: "p1", title: "Restock coffee beans before the 10am rush", meta: "Assigned to Amara · due 10.00" },
    { id: "p2", title: "Set out 40 chairs in the bar for tonight", meta: "Assigned to Tom · due 6.00pm" },
    { id: "p3", title: "Bar stock check + cellar temperature", meta: "Assigned to Jack", done: true },
  ],
  simply: [
    { id: "s1", title: "Refresh the front window — summer reads", meta: "Assigned to Sam · due 11.00" },
    { id: "s2", title: "Chase Gardners delivery (2 totes short)", meta: "Assigned to Grace" },
  ],
};

const SLACK: Record<VenueKey, Omit<SlackMessage, "id">[]> = {
  prologue: [
    { author: "Amara O.", time: "8.12am", text: "Coffee machine descaled and dialled in. Milk delivery landed early." },
    { author: "Priya S.", time: "8.40am", text: "Ali Smith AV check at 4pm — Tom can you be free for 20 mins?", isNew: true },
  ],
  simply: [
    { author: "Grace L.", time: "9.05am", text: "Till float sorted. Book club room set for 10.30." },
    { author: "Sam D.", time: "9.20am", text: "Two boxes of the new kids picture books just in — putting them on the table.", isNew: true },
  ],
};

const WRAP_SEED: Record<VenueKey, WrapUp> = {
  prologue: {
    headline: "Steady Friday — bar hit target, one card-reader gremlin.",
    body: "Good crowd for the late poetry night — 47 covers and the espresso machine held up. Bar hit target. One note: card reader 2 dropped out twice around 3pm, logged with the supplier — use reader 1 until it's swapped.",
    byline: "Priya",
    postedAt: "22.40",
  },
  simply: {
    headline: "Quiet but tidy — Booker table cleared.",
    body: "Calm one on the floor. Cleared the last of the Booker longlist table and rebuilt it as summer paperbacks. Two school-order enquiries in for September, passed to Grace. Reading-room heating still slow to come up in the mornings — chasing the landlord.",
    byline: "Grace",
    postedAt: "21.15",
  },
};

const STATS: Record<VenueKey, { value: string; label: string }[]> = {
  prologue: [
    { value: "47", label: "Covers booked tonight" },
    { value: "2", label: "Deliveries due" },
    { value: "£1.2k", label: "Fri takings" },
  ],
  simply: [
    { value: "1", label: "Delivery running late" },
    { value: "2", label: "New school orders" },
    { value: "£680", label: "Fri takings" },
  ],
};

const OPENING: Record<VenueKey, { hours: string; note: string }> = {
  prologue: { hours: "8am – 11pm", note: "Café from 8 · bar until 11" },
  simply: { hours: "9am – 5.30pm", note: "Click & collect until 5pm" },
};

// ---------------------------------------------------------------------------
// Mutable state, keyed by date so navigating between days behaves sensibly.
// Hung off globalThis because Next compiles each API route as its own entry —
// plain module-level maps would give every route a private copy and writes
// from one route would be invisible to the others.
// ---------------------------------------------------------------------------
interface MockStore {
  taskDone: Map<string, boolean>; // `${date}:${taskId}`
  wraps: Map<string, WrapUp>; // `${date}:${venue}` — date the wrap COVERS
  alerts: Map<string, UrgentAlert[]>; // date shown
  dismissed: Set<string>; // `${date}:${alertId}`
  alertSeq: number;
}
const g = globalThis as typeof globalThis & { __briefingMock?: MockStore };
const store: MockStore = (g.__briefingMock ??= {
  taskDone: new Map(),
  wraps: new Map(),
  alerts: new Map(),
  dismissed: new Set(),
  alertSeq: 1,
});
const { taskDone, wraps, alerts, dismissed } = store;

function seedAlerts(date: string): UrgentAlert[] {
  // The design's sample alert appears on today's briefing only.
  if (date !== todayLondon()) return [];
  return [
    {
      id: "seed-a1",
      text: "Card reader 2 is down — take card payments on reader 1 only until the replacement arrives.",
      loc: "prologue",
    },
  ];
}

function tasksFor(date: string, venue: VenueKey): BriefTask[] {
  return TASK_SEED[venue].map((t) => ({
    id: t.id,
    title: t.title,
    meta: t.meta,
    done: taskDone.get(`${date}:${t.id}`) ?? !!t.done,
  }));
}

function venueDay(date: string, venue: VenueKey): VenueBriefing {
  const today = todayLondon();
  const isToday = date === today;
  const isPast = date < today;
  const yesterday = addDays(date, -1);
  const savedWrap = wraps.get(`${yesterday}:${venue}`);
  return {
    roster: ROSTER[venue].map((s, i) => ({ ...s, id: `${venue}-${i}` })),
    tasks: tasksFor(date, venue),
    // Chatter is date-scoped (spec §8): full feed today, a quieter trace for
    // past days, nothing for the future.
    slack: isToday
      ? SLACK[venue].map((m, i) => ({ ...m, id: `${venue}-m${i}` }))
      : isPast
        ? SLACK[venue].slice(0, 1).map((m, i) => ({ ...m, isNew: false, id: `${venue}-m${i}` }))
        : [],
    wrap: savedWrap ?? { ...WRAP_SEED[venue] },
    stats: STATS[venue],
    opening: OPENING[venue],
  };
}

export const mockBriefingSource: BriefingDataSource = {
  async getDay(date: string): Promise<BriefingDay> {
    if (!alerts.has(date)) alerts.set(date, seedAlerts(date));
    return {
      date,
      rosterAsOf: null,
      venues: {
        prologue: venueDay(date, "prologue"),
        simply: venueDay(date, "simply"),
      },
      alerts: (alerts.get(date) ?? []).filter((a) => !dismissed.has(`${date}:${a.id}`)),
      milestones: [
        { venue: "prologue", who: "Priya", what: "birthday today" },
        { venue: "simply", who: "Ellie", what: "3 years today" },
      ],
    };
  },

  async setTaskDone(date, taskId, done) {
    taskDone.set(`${date}:${taskId}`, done);
  },

  async saveWrap(date, venue, wrap) {
    wraps.set(`${date}:${venue}`, wrap);
  },

  async postAlert(date, text, loc) {
    const alert: UrgentAlert = { id: `a${Date.now()}-${store.alertSeq++}`, text, loc };
    alerts.set(date, [...(alerts.get(date) ?? seedAlerts(date)), alert]);
    return alert;
  },

  async dismissAlert(date, alertId) {
    dismissed.add(`${date}:${alertId}`);
  },
};

// Test hook: the "Fri 17 Jul"-style label the wrap band shows for yesterday.
export const wrapDateLabel = (date: string) => dateParts(addDays(date, -1)).dmShort;
