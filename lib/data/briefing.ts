import type { BriefingDay } from "@/lib/briefing";
import { addDays } from "@/lib/briefing";
import type { BriefingDataSource } from "./briefing-source";
import { mockBriefingSource } from "./briefing-mock";
import { deputyConfigured, getDeputyDay, setDeputyTaskDone } from "./briefing-deputy";
import { getSlackDay, slackConfigured } from "./briefing-slack";
import {
  briefingAirtableConfigured,
  dismissAirtableAlert,
  getAirtableAlerts,
  getAirtableWraps,
  postAirtableAlert,
  saveAirtableWrap,
} from "./briefing-airtable";

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
    if (deputyConfigured()) {
      const dep = await getDeputyDay(date);
      day.rosterAsOf = dep.asOf;
      for (const venue of ["prologue", "simply"] as const) {
        day.venues[venue].roster = dep.roster[venue];
        day.venues[venue].tasks = dep.tasks[venue];
      }
    }
    if (slackConfigured()) {
      for (const venue of ["prologue", "simply"] as const) {
        day.venues[venue].slack = await getSlackDay(date, venue);
      }
    }
    if (briefingAirtableConfigured()) {
      // The page shows the wrap COVERING the previous day.
      const [wraps, alerts] = await Promise.all([getAirtableWraps(addDays(date, -1)), getAirtableAlerts(date)]);
      for (const venue of ["prologue", "simply"] as const) {
        day.venues[venue].wrap = wraps[venue] ?? null;
      }
      day.alerts = alerts;
    }
    return day;
  },

  async setTaskDone(date, taskId, done) {
    if (deputyConfigured()) return setDeputyTaskDone(date, taskId, done);
    return mockBriefingSource.setTaskDone(date, taskId, done);
  },

  async saveWrap(date, venue, wrap) {
    if (briefingAirtableConfigured()) return saveAirtableWrap(date, venue, wrap);
    return mockBriefingSource.saveWrap(date, venue, wrap);
  },
  async postAlert(date, text, loc) {
    if (briefingAirtableConfigured()) return postAirtableAlert(date, text, loc);
    return mockBriefingSource.postAlert(date, text, loc);
  },
  async dismissAlert(date, id) {
    if (briefingAirtableConfigured()) return dismissAirtableAlert(id);
    return mockBriefingSource.dismissAlert(date, id);
  },
};

export function getBriefingSource(): BriefingDataSource {
  return composedBriefingSource;
}

export type { BriefingDataSource } from "./briefing-source";
