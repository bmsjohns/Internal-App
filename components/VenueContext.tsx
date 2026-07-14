"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { VenueKey } from "@/lib/config";

export type VenueSelection = "all" | VenueKey;

// App-level venue switcher (sidebar "Viewing"): one selection shared by the
// queue, summary and new-order default, persisted per device.
const Ctx = createContext<{ venue: VenueSelection; setVenue: (v: VenueSelection) => void }>({
  venue: "all",
  setVenue: () => {},
});

export function VenueProvider({ children }: { children: React.ReactNode }) {
  const [venue, setVenue] = useState<VenueSelection>("all");

  useEffect(() => {
    const saved = localStorage.getItem("ob-venue");
    if (saved === "simply" || saved === "prologue" || saved === "all") setVenue(saved);
  }, []);

  const update = (v: VenueSelection) => {
    setVenue(v);
    localStorage.setItem("ob-venue", v);
  };

  return <Ctx.Provider value={{ venue, setVenue: update }}>{children}</Ctx.Provider>;
}

export const useVenue = () => useContext(Ctx);
