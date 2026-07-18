import type { VenueKey } from "@/lib/config";
import type { BriefingDay, UrgentAlert, WrapUp } from "@/lib/briefing";

// Daily Briefing data seam, same rules as lib/data/source.ts: the page and
// API routes only ever talk to this interface. The default implementation is
// the in-memory mock; Deputy (roster + tasks) and Slack (on-shift chatter)
// overlay it per-section once their env vars are configured — see
// lib/data/briefing.ts. Events are NOT here: the briefing reads them through
// the existing EventsDataSource.
export interface BriefingDataSource {
  /** Roster, tasks, chatter, stats, opening hours, milestones, alerts and
   *  the previous day's wrap-ups, for one date. */
  getDay(date: string): Promise<BriefingDay>;

  /** Tick/untick a task (writes back to Deputy when that's the source). */
  setTaskDone(date: string, taskId: string, done: boolean): Promise<void>;

  /** Save the wrap-up covering `date` for one venue (spec §7 v1). `draft`
   *  keeps it off the next day's briefing until published. */
  saveWrap(date: string, venue: VenueKey, wrap: WrapUp, draft: boolean): Promise<void>;

  postAlert(date: string, text: string, loc: UrgentAlert["loc"]): Promise<UrgentAlert>;
  dismissAlert(date: string, alertId: string): Promise<void>;
}
