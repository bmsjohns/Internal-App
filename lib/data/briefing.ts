import type { BriefingDay } from "@/lib/briefing";
import { addDays } from "@/lib/briefing";
import type { BriefingDataSource } from "./briefing-source";
import { mockBriefingSource } from "./briefing-mock";
import { deputyConfigured, getDeputyDay, getDeputyMilestones, setDeputyTaskDone } from "./briefing-deputy";
import { getSlackDay, slackConfigured } from "./briefing-slack";
import {
  briefingAirtableReady,
  dismissAirtableAlert,
  getAirtableAlerts,
  getAirtableWraps,
  getAirtableWrapsForDay,
  postAirtableAlert,
  saveAirtableWrap,
} from "./briefing-airtable";
import { getOpeningHours } from "./briefing-hours";

// Composition, not a hard switch: unlike DATA_SOURCE (one base, one flag),
// the briefing pulls from several systems that come online independently —
// Deputy overlays roster+tasks once its token exists, Slack overlays the
// chatter feeds once the bot is invited, and the "Backstage" Airtable base
// takes over wrap-ups + urgent alerts once it exists. What's left (stats,
// opening hours, milestones — and everything above until configured) comes
// from the mock store.
const composedBriefingSource: BriefingDataSource = {
  async getDay(date: string): Promise<BriefingDay> {
    const day = await mockBriefingSource.getDay(date);
    // Each overlay degrades independently: an integration hiccup falls that
    // section back to mock data rather than 500ing the landing page.
    if (deputyConfigured()) {
      try {
        const dep = await getDeputyDay(date);
        day.rosterAsOf = dep.asOf;
        for (const venue of ["prologue", "simply"] as const) {
          day.venues[venue].roster = dep.roster[venue];
          day.venues[venue].tasks = dep.tasks[venue];
        }
      } catch (e) {
        console.error("Briefing: Deputy overlay failed", e);
      }
      // Celebrations are real once Deputy is on: an empty result correctly
      // hides the band rather than showing the mock's sample names.
      try {
        day.milestones = await getDeputyMilestones(date);
      } catch (e) {
        console.error("Briefing: Deputy milestones failed", e);
        day.milestones = [];
      }
    }
    if (slackConfigured()) {
      for (const venue of ["prologue", "simply"] as const) {
        try {
          day.venues[venue].slack = await getSlackDay(date, venue);
        } catch (e) {
          console.error(`Briefing: Slack overlay failed (${venue})`, e);
        }
      }
    }
    if (await briefingAirtableReady()) {
      try {
        // The page shows the wrap COVERING the previous day. Opening hours
        // resolve regular pattern + date overrides from the same base.
        const [wraps, wrapsToday, alerts, hours] = await Promise.all([
          getAirtableWraps(addDays(date, -1)),
          getAirtableWrapsForDay(date),
          getAirtableAlerts(date),
          getOpeningHours(date),
        ]);
        for (const venue of ["prologue", "simply"] as const) {
          day.venues[venue].wrap = wraps[venue] ?? null;
          day.venues[venue].wrapToday = wrapsToday[venue] ?? null;
          if (hours?.[venue]) day.venues[venue].opening = hours[venue]!;
        }
        day.alerts = alerts;
      } catch (e) {
        console.error("Briefing: Airtable overlay failed", e);
      }
    }
    return day;
  },

  async setTaskDone(date, taskId, done) {
    if (deputyConfigured()) return setDeputyTaskDone(date, taskId, done);
    return mockBriefingSource.setTaskDone(date, taskId, done);
  },

  // Writes do NOT silently fall back once Airtable is the store — a wrap
  // that only landed in ephemeral memory would look saved and then vanish.
  async saveWrap(date, venue, wrap, draft) {
    if (await briefingAirtableReady()) return saveAirtableWrap(date, venue, wrap, draft);
    return mockBriefingSource.saveWrap(date, venue, wrap, draft);
  },
  async postAlert(date, text, loc) {
    if (await briefingAirtableReady()) return postAirtableAlert(date, text, loc);
    return mockBriefingSource.postAlert(date, text, loc);
  },
  async dismissAlert(date, id) {
    if (await briefingAirtableReady()) return dismissAirtableAlert(id);
    return mockBriefingSource.dismissAlert(date, id);
  },
};

export function getBriefingSource(): BriefingDataSource {
  return composedBriefingSource;
}

export type { BriefingDataSource } from "./briefing-source";
