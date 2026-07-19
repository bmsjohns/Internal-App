// Shared access to the Airtable bases behind Book Clubs + Ordering Hub.
// Same by-NAME discovery rule as briefing-airtable.ts (no per-base env
// var — Ben's rule): the token needs each base in its access list + the
// schema.bases:read scope. *_AIRTABLE_BASE_ID env vars stay as override
// escape hatches. Two bases are involved:
//   · "Backstage"   — Hub Lines + Restock (app-owned tables)
//   · "Book Clubs"  — the LIVE clubs base (Book Clubs / Members / Book
//     Orders / Publishers), in daily use and Stripe-synced. Treat with care.

const baseCache = new Map<string, { id: string | null; at: number }>();
const BASE_CACHE_MS = 10 * 60 * 1000;

const authHeaders = () => ({
  Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
  "Content-Type": "application/json",
});

async function resolveNamedBaseId(name: string, envOverride: string | undefined): Promise<string | null> {
  if (envOverride) return envOverride;
  const cached = baseCache.get(name);
  if (cached && Date.now() - cached.at < BASE_CACHE_MS) return cached.id;
  let id: string | null = null;
  try {
    const bases: { id: string; name: string }[] = [];
    let offset: string | undefined;
    do {
      const res = await fetch(
        `https://api.airtable.com/v0/meta/bases${offset ? `?offset=${offset}` : ""}`,
        { headers: authHeaders(), cache: "no-store" }
      );
      if (!res.ok) throw new Error(`meta/bases ${res.status}`);
      const data = await res.json();
      bases.push(...(data.bases ?? []));
      offset = data.offset;
    } while (offset);
    id = bases.find((b) => b.name.trim().toLowerCase() === name)?.id ?? null;
  } catch (e) {
    console.error(`"${name}" base lookup failed (token may lack schema.bases:read)`, e);
  }
  baseCache.set(name, { id, at: Date.now() });
  return id;
}

export async function resolveBackstageBaseId(): Promise<string | null> {
  return resolveNamedBaseId("backstage", process.env.BACKSTAGE_AIRTABLE_BASE_ID);
}

export async function resolveBookClubsBaseId(): Promise<string | null> {
  return resolveNamedBaseId("book clubs", process.env.BOOKCLUBS_AIRTABLE_BASE_ID);
}

export async function requireBookClubsBase(feature: string): Promise<string> {
  const id = await resolveBookClubsBaseId();
  if (!id) {
    throw new Error(
      `${feature}: the "Book Clubs" Airtable base is not reachable — add it to the token's access list (see README)`
    );
  }
  return id;
}

/** Airtable request against an explicit base, with 429 retry. */
export async function atBase(baseId: string, path: string, init?: RequestInit): Promise<any> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`https://api.airtable.com/v0/${baseId}/${path}`, {
      ...init,
      headers: { ...authHeaders(), ...init?.headers },
      cache: "no-store",
    });
    if (res.status === 429 && attempt < 4) {
      const retryAfter = Number(res.headers.get("Retry-After")) * 1000;
      await new Promise((r) => setTimeout(r, Math.min(retryAfter > 0 ? retryAfter : 400 * 2 ** attempt, 4000)));
      continue;
    }
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    return res.json();
  }
}

export async function atBaseList(baseId: string, table: string, extra?: Record<string, string>): Promise<any[]> {
  const records: any[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams(extra);
    if (offset) params.set("offset", offset);
    const data = await atBase(baseId, `${encodeURIComponent(table)}?${params}`);
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

export async function requireBackstageBase(feature: string): Promise<string> {
  const id = await resolveBackstageBaseId();
  if (!id) {
    throw new Error(
      `${feature}: the "Backstage" Airtable base is not reachable — check the token's access list and schema.bases:read scope (see README)`
    );
  }
  return id;
}

// Audit-log serialisation, same one-line-per-entry format as Orders' Status
// Log: `ISO timestamp|name|action`.
import type { AuditEntry } from "@/lib/types";

export function parseLog(text: unknown): AuditEntry[] {
  if (typeof text !== "string" || !text.trim()) return [];
  return text
    .split("\n")
    .map((line) => {
      const [at, by, ...rest] = line.split("|");
      return at && by && rest.length ? { at, by, action: rest.join("|") } : null;
    })
    .filter((e): e is AuditEntry => !!e);
}

export function serialiseLog(log: AuditEntry[]): string {
  return log.map((e) => `${e.at}|${e.by}|${e.action}`).join("\n");
}
