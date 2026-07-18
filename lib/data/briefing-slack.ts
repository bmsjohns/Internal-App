import type { VenueKey } from "@/lib/config";
import type { SlackMessage } from "@/lib/briefing";

// Read-only Slack feed for the briefing's On-shift chatter section
// (spec §8): #pro-on-shift and #sb-on-shift, scoped to the selected day.
// Needs a bot token that's been invited to both channels — setup step for
// Ben; until then slackConfigured() is false and the mock supplies data.
//
//   SLACK_BOT_TOKEN            xoxb-… with channels:history + users:read
//   SLACK_CHANNEL_PRO_ON_SHIFT channel id (C…) for #pro-on-shift
//   SLACK_CHANNEL_SB_ON_SHIFT  channel id (C…) for #sb-on-shift

export const slackConfigured = () =>
  !!(
    process.env.SLACK_BOT_TOKEN &&
    process.env.SLACK_CHANNEL_PRO_ON_SHIFT &&
    process.env.SLACK_CHANNEL_SB_ON_SHIFT
  );

const channelFor = (venue: VenueKey) =>
  venue === "prologue" ? process.env.SLACK_CHANNEL_PRO_ON_SHIFT! : process.env.SLACK_CHANNEL_SB_ON_SHIFT!;

async function slack(method: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`https://slack.com/api/${method}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    cache: "no-store",
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack ${method}: ${data.error}`);
  return data;
}

// Short cache — chatter should feel close to live, but a page refresh
// behind the till shouldn't burn rate limit.
const CACHE_MS = 2 * 60 * 1000;
const cache = new Map<string, { at: number; messages: SlackMessage[] }>();
const userNames = new Map<string, string>();

async function displayName(userId: string): Promise<string> {
  if (!userNames.has(userId)) {
    try {
      const d = await slack("users.info", { user: userId });
      userNames.set(userId, d.user?.profile?.display_name || d.user?.real_name || "Someone");
    } catch {
      userNames.set(userId, "Someone");
    }
  }
  return userNames.get(userId)!;
}

/** Unix range for a YYYY-MM-DD day in Europe/London (DST-safe ±1h probe). */
function londonDayRange(date: string): { oldest: number; latest: number } {
  const utcMidnight = Date.parse(`${date}T00:00:00Z`);
  for (const offsetH of [1, 0]) {
    const t = utcMidnight - offsetH * 3600_000;
    const seen = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", dateStyle: "short" }).format(new Date(t));
    if (seen === date) return { oldest: t / 1000, latest: t / 1000 + 86400 };
  }
  return { oldest: utcMidnight / 1000, latest: utcMidnight / 1000 + 86400 };
}

const fmtTime = (ts: number) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "numeric", minute: "2-digit", hour12: true })
    .format(new Date(ts * 1000))
    .replace(":", ".")
    .replace(" ", "");

export async function getSlackDay(date: string, venue: VenueKey): Promise<SlackMessage[]> {
  const key = `${date}:${venue}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.messages;

  const { oldest, latest } = londonDayRange(date);
  const d = await slack("conversations.history", {
    channel: channelFor(venue),
    oldest: String(oldest),
    latest: String(latest),
    limit: "50",
    inclusive: "true",
  });
  const raw = (d.messages ?? []).filter((m: any) => m.type === "message" && !m.subtype && m.text);
  const messages: SlackMessage[] = [];
  for (const m of raw.reverse()) {
    // oldest → newest, matching Slack's own convention (spec §8)
    const ts = Number(m.ts);
    messages.push({
      id: m.ts,
      author: await displayName(m.user),
      time: fmtTime(ts),
      text: m.text,
      isNew: Date.now() / 1000 - ts < 3600,
    });
  }
  cache.set(key, { at: Date.now(), messages });
  return messages;
}
