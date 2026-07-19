import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";

// Stockport forecast strip (spec §5) via Open-Meteo — free, no key. One
// forecast covers both venues (they're four miles apart). Nice-to-have:
// failures return ok:false and the page just hides the pill.
const LAT = 53.41;
const LON = -2.16;

const CACHE_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; body: unknown }>();

// WMO weather codes → short label + which icon the pill shows.
function describe(code: number): { desc: string; icon: "sun" | "cloud" | "rain" | "snow" | "storm" | "fog" } {
  if (code === 0) return { desc: "Clear", icon: "sun" };
  if (code <= 2) return { desc: "Partly cloudy", icon: "sun" };
  if (code === 3) return { desc: "Overcast", icon: "cloud" };
  if (code <= 48) return { desc: "Fog", icon: "fog" };
  if (code <= 57) return { desc: "Drizzle", icon: "rain" };
  if (code <= 67) return { desc: "Light showers", icon: "rain" };
  if (code <= 77) return { desc: "Snow", icon: "snow" };
  if (code <= 82) return { desc: "Showers", icon: "rain" };
  if (code <= 86) return { desc: "Snow showers", icon: "snow" };
  return { desc: "Thunderstorms", icon: "storm" };
}

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "briefing.view")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const date = req.nextUrl.searchParams.get("date") ?? "";

  const hit = cache.get(date);
  if (hit && Date.now() - hit.at < CACHE_MS) return NextResponse.json(hit.body);

  try {
    const params = new URLSearchParams({
      latitude: String(LAT),
      longitude: String(LON),
      daily: "temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode",
      timezone: "Europe/London",
      start_date: date,
      end_date: date,
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const d = await res.json();
    const i = 0;
    const { desc, icon } = describe(d.daily?.weathercode?.[i] ?? 3);
    const body = {
      ok: true,
      hi: `${Math.round(d.daily.temperature_2m_max[i])}°`,
      lo: `${Math.round(d.daily.temperature_2m_min[i])}°`,
      rain: `${d.daily.precipitation_probability_max?.[i] ?? 0}%`,
      desc,
      icon,
    };
    cache.set(date, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch {
    // Forecast range exceeded or network trouble — page hides the strip.
    return NextResponse.json({ ok: false });
  }
}
