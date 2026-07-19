import type {
  BookSelection,
  BookSelectionInput,
  Club,
  ClubMembership,
  Member,
  MemberInput,
  PaymentRecord,
} from "@/lib/types";

/**
 * Book Clubs seam — same rules as lib/data/source.ts: every page and API
 * route goes through this interface. The mock keeps development off live
 * systems entirely (no Airtable, no Stripe); the airtable implementation
 * performs the Stripe writes via lib/stripe.ts before mutating records.
 *
 * Members are a STANDALONE table (spec B1) — nothing here touches the
 * Customers table, deliberately.
 */
export interface ClubsDataSource {
  listMembers(): Promise<Member[]>;
  getMember(id: string): Promise<Member | null>;
  createMember(input: MemberInput): Promise<Member>;
  updateMember(id: string, input: Partial<MemberInput>): Promise<Member>;

  listClubs(): Promise<Club[]>;
  getClub(id: string): Promise<Club | null>;

  listMemberships(): Promise<ClubMembership[]>;

  /** All stored selections (current + history). */
  listSelections(): Promise<BookSelection[]>;
  /** Create or replace the selection for input.clubId × input.month. */
  saveSelection(input: BookSelectionInput, byName: string): Promise<BookSelection>;
  /** Record which hub line a selection generated (status is REFLECTED from
   *  that line — never stored here; spec B4). */
  setSelectionHubLine(id: string, hubLineId: string | null): Promise<void>;
  /** Mirror the hub's canonical state into the source record's own status
   *  column where one exists (live Book Orders: sent → "Publisher
   *  Contacted", arrived → "Received"). No-op in mock — it reflects. */
  updateSelectionOrderStatus(id: string, state: "sent" | "arrived"): Promise<void>;

  /** Stripe invoice history for a member — read-only (refunds link out). */
  getPaymentHistory(memberId: string): Promise<PaymentRecord[]>;

  // --- Stripe write actions (B2) — all logged who/when on the membership ---
  cancelMembership(id: string, when: "now" | "period_end", byName: string): Promise<ClubMembership>;
  pauseMembership(id: string, byName: string): Promise<ClubMembership>;
  resumeMembership(id: string, byName: string): Promise<ClubMembership>;
  /** Single guided flow (B2): cancel the Club A sub + create a Club B one
   *  against the same member. */
  moveMembership(id: string, targetClubId: string, byName: string): Promise<ClubMembership>;

  /** Webhook sync (B2): apply a Stripe event so app state never drifts. */
  applyStripeEvent(evt: {
    type: string;
    subscriptionId: string;
    payStatus?: "ok" | "failed" | "past_due";
    status?: "active" | "paused" | "cancelled";
    periodEnd?: string;
  }): Promise<void>;
}
