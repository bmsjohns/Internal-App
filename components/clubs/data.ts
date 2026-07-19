"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  BookSelection,
  Club,
  ClubMembership,
  HubLine,
  HubLineState,
  HubPublisher,
  Member,
  RestockItem,
  Supplier,
} from "@/lib/types";

// Client data hooks for the Book Clubs + Ordering Hub screens. Each module
// is one payload (the datasets are small — see the API routes); a short
// module-level cache stops list→detail navigation refetching every time,
// and mutations call refresh() to invalidate.

export type SelectionWithState = BookSelection & { orderState: HubLineState | null };

export interface PublisherOption {
  id: string;
  name: string;
  imprints: string[];
}

export interface ClubsPayload {
  clubs: Club[];
  members: Member[];
  memberships: ClubMembership[];
  selections: SelectionWithState[];
  publisherOptions: PublisherOption[];
  canManage: boolean;
}

export interface HubPayload {
  lines: HubLine[];
  publishers: HubPublisher[];
  restock: RestockItem[];
  suppliers: Supplier[];
  canSend: boolean;
  canEditPublishers: boolean;
  userName: string;
}

const CACHE_MS = 15_000;

function makeHook<T>(url: string) {
  let cache: { at: number; data: T } | null = null;
  return function useData() {
    const [data, setData] = useState<T | null>(cache ? cache.data : null);
    const [error, setError] = useState("");

    const load = useCallback((force: boolean) => {
      if (!force && cache && Date.now() - cache.at < CACHE_MS) {
        setData(cache.data);
        return;
      }
      fetch(url)
        .then(async (r) => {
          if (!r.ok) throw new Error((await r.json().catch(() => null))?.error ?? `HTTP ${r.status}`);
          return r.json();
        })
        .then((d: T) => {
          cache = { at: Date.now(), data: d };
          setData(d);
          setError("");
        })
        .catch((e) => setError(e.message));
    }, []);

    useEffect(() => load(false), [load]);
    const refresh = useCallback(() => load(true), [load]);
    return { data, error, refresh };
  };
}

export const useClubsData = makeHook<ClubsPayload>("/api/clubs");
export const useHubData = makeHook<HubPayload>("/api/hub");

/** POST helper: JSON in/out, throws the API's error message. */
export async function post(url: string, body: unknown): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}
