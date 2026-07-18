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

// Message "subtypes" that are channel plumbing (joins, topic changes, pins),
// not chatter. Everything else — including plain messages (no subtype), bot
// posts, file shares and thread broadcasts — is real content the shift team
// posted, so we keep it rather than dropping everything with a subtype.
const NOISE_SUBTYPES = new Set([
  "channel_join", "channel_leave", "channel_topic", "channel_purpose",
  "channel_name", "channel_archive", "channel_unarchive", "group_join",
  "group_leave", "pinned_item", "unpinned_item", "bot_add", "bot_remove",
  "reminder_add", "reminder_delete",
]);

const isChatter = (m: any) =>
  m.type === "message" && !NOISE_SUBTYPES.has(m.subtype) && (m.text || m.files?.length);

async function toMessage(m: any): Promise<SlackMessage> {
  const ts = Number(m.ts);
  const author = m.user
    ? await displayName(m.user)
    : m.username || m.bot_profile?.name || "Bot";
  const text = m.text || (m.files?.length ? "(shared a file)" : "");
  return { id: m.ts, author, time: fmtTime(ts), text, isNew: Date.now() / 1000 - ts < 3600 };
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

  const channel = channelFor(venue);
  const { oldest, latest } = londonDayRange(date);
  const d = await slack("conversations.history", {
    channel,
    oldest: String(oldest),
    latest: String(latest),
    limit: "200",
    inclusive: "true",
  });
  const top = (d.messages ?? []).filter(isChatter);

  // conversations.history returns only thread PARENTS, never the replies
  // inside them — so a handover discussed in a thread would show just its
  // first line. Pull replies for any parent that has them; a reply can fall
  // on a different day than its parent, so re-filter to the day window.
  const collected: any[] = [...top];
  const parents = top.filter((m: any) => (m.reply_count ?? 0) > 0);
  for (const p of parents) {
    try {
      const r = await slack("conversations.replies", { channel, ts: p.ts, limit: "200" });
      for (const reply of r.messages ?? []) {
        if (reply.ts === p.ts) continue; // parent is echoed first — skip
        const ts = Number(reply.ts);
        if (ts >= oldest && ts < latest && isChatter(reply)) collected.push(reply);
      }
    } catch {
      // A single unreadable thread must not sink the whole feed.
    }
  }

  // De-dupe by ts, then oldest → newest (Slack's own convention, spec §8).
  const seen = new Set<string>();
  const ordered = collected
    .filter((m) => !seen.has(m.ts) && seen.add(m.ts))
    .sort((a, b) => Number(a.ts) - Number(b.ts));
  const messages = await Promise.all(ordered.map(toMessage));

  cache.set(key, { at: Date.now(), messages });
  return messages;
}
