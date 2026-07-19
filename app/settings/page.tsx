import Link from "next/link";
import { can, getSessionUser, isAdmin } from "@/lib/auth";
import PageHeader from "@/components/PageHeader";
import SuppliersPanel from "@/components/SuppliersPanel";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getSessionUser();
  const canSuppliers = !!user && can(user, "settings.suppliers.manage");
  const admin = !!user && isAdmin(user);
  if (!canSuppliers && !admin) return <div className="ob-screen"><PageHeader eyebrow="App settings" title="Settings" /><div className="mx-auto max-w-[560px] px-6 pt-20 text-center"><div className="font-display text-2xl">No settings access.</div><p className="mt-2 text-sm text-charcoal">Ask an Admin if your responsibilities have changed.</p></div></div>;

  return (
    <div className="ob-screen min-h-screen">
      <PageHeader eyebrow="Backstage" title="Settings" />
      <div className="mx-auto max-w-[1080px] px-5 pb-14 pt-7 sm:px-8">
        {admin && <Link href="/settings/team" className="group mb-8 flex items-center gap-5 rounded-xl border border-cream-2 bg-white p-5 shadow-[0_1px_2px_rgba(26,23,20,.03)] transition hover:-translate-y-0.5 hover:border-rust/30 hover:shadow-md"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-shell text-rust"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.2 2.9-5.3 6.5-5.3s6.5 2.1 6.5 5.3M16 5.2a3.5 3.5 0 0 1 0 6.8M17.5 15c2.4.7 4 2.4 4 5"/></svg></span><span className="flex-1"><span className="eyebrow text-rust">Admin only</span><span className="mt-1 block font-display text-[22px] text-ink">Team &amp; Permissions</span><span className="mt-1 block text-sm text-stone">Invite people, assign roles and locations, or make individual overrides.</span></span><span className="text-2xl text-stone transition group-hover:translate-x-1 group-hover:text-rust">→</span></Link>}
        {canSuppliers && <div className="grid gap-7 md:grid-cols-[190px_1fr]"><aside><div className="eyebrow text-stone">Ordering</div><div className="mt-2 rounded-lg bg-shell px-3 py-2.5 text-sm font-semibold text-rust">Suppliers</div><p className="mt-3 text-xs leading-relaxed text-stone">Account details and ordering cadence are shared across the Ordering Hub.</p></aside><SuppliersPanel /></div>}
      </div>
    </div>
  );
}
