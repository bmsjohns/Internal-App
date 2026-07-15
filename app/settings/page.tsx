import { can, getSessionUser } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SuppliersPanel from "@/components/SuppliersPanel";

export const dynamic = "force-dynamic";

// V3 §3 + §10a: Settings is a generic app-wide shell; each module contributes
// its own panel(s). Only Orders → Suppliers exists today — a future Events
// module adds an entry to SECTIONS and its own panel component, not a new
// settings system.
const SECTIONS = [{ module: "Orders", label: "Suppliers", panel: <SuppliersPanel /> }];

export default async function SettingsPage() {
  const user = await getSessionUser();
  if (!user || !can(user, "settings:manage")) {
    return (
      <div className="ob-screen">
        <PageHeader eyebrow="App settings" title="Settings" />
        <div className="mx-auto max-w-[560px] px-5 pt-16 text-center sm:px-8">
          <div className="font-display text-2xl">Managers only.</div>
          <p className="mt-2 text-charcoal">
            Settings can only be changed by someone with the <code className="rounded bg-cream-2 px-1">settings:manage</code>{" "}
            permission — ask a manager.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader eyebrow="App settings · manager only" title="Settings" />
      <div className="mx-auto grid w-full max-w-[1080px] flex-1 grid-cols-1 gap-8 px-5 pb-12 pt-7 sm:px-8 md:grid-cols-[200px_1fr]">
        <nav className="flex flex-col gap-1">
          {SECTIONS.map((s) => (
            <span key={s.label} className="rounded-md bg-shell px-3 py-2 text-sm font-semibold text-rust">
              <span className="eyebrow mr-1.5 text-stone">{s.module}</span>
              {s.label}
            </span>
          ))}
          <p className="mt-3 px-1 text-[12px] leading-relaxed text-stone">
            Future modules (Events, Schools…) add their own sections here.
          </p>
        </nav>
        <div>{SECTIONS[0].panel}</div>
      </div>
    </div>
  );
}
