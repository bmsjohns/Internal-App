"use client";

import { useState } from "react";
import type { DiscountRates, HubOrderType, HubPublisher, Location } from "@/lib/types";
import { LOCATIONS } from "@/lib/types";
import { ORDER_TYPES, isOverridden, rateFor } from "@/lib/hub";
import { post, useHubData } from "@/components/clubs/data";
import { ModuleHeader, Toast, useAccent } from "@/components/clubs/ui";

// Publishers reference data (spec C6): discount % per Publisher × Order Type
// (restock is the base; blank falls back to it), the RARE per-account
// override visually flagged, imprints (identification only — they always
// inherit the parent rate, no imprint override exists), rep contact and the
// two account numbers every publisher holds. Staff-maintained, never
// hardcoded; edits gated by settings:manage.

interface EditState {
  repName: string;
  repEmail: string;
  accountNumbers: Record<Location, string>;
  rates: Record<HubOrderType, string>;
  overrides: Record<Location, Record<HubOrderType, string>>;
}

function toEdit(p: HubPublisher): EditState {
  const rates = {} as Record<HubOrderType, string>;
  const overrides = { "Simply Books": {}, "Prologue": {} } as EditState["overrides"];
  for (const { key } of ORDER_TYPES) {
    rates[key] = p.rates[key] != null ? String(p.rates[key]) : "";
    for (const loc of LOCATIONS) {
      overrides[loc][key] = p.accountOverrides[loc]?.[key] != null ? String(p.accountOverrides[loc]![key]) : "";
    }
  }
  return { repName: p.repName, repEmail: p.repEmail, accountNumbers: { ...p.accountNumbers }, rates, overrides };
}

export default function PublishersPage() {
  const { accent, accentSoft } = useAccent();
  const { data, error, refresh } = useHubData();
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2600);
  };

  const save = async (p: HubPublisher) => {
    if (!edit) return;
    setBusy(true);
    try {
      const rates = {} as DiscountRates;
      const accountOverrides: HubPublisher["accountOverrides"] = {};
      for (const { key } of ORDER_TYPES) {
        rates[key] = edit.rates[key].trim() === "" ? null : Number(edit.rates[key]);
      }
      for (const loc of LOCATIONS) {
        const o: Partial<DiscountRates> = {};
        let any = false;
        for (const { key } of ORDER_TYPES) {
          if (edit.overrides[loc][key].trim() !== "") {
            o[key] = Number(edit.overrides[loc][key]);
            any = true;
          }
        }
        if (any) accountOverrides[loc] = o;
      }
      await post("/api/hub/publishers", {
        id: p.id,
        repName: edit.repName,
        repEmail: edit.repEmail,
        accountNumbers: edit.accountNumbers,
        rates,
        accountOverrides,
        imprints: p.imprints,
      });
      setEditing(null);
      setEdit(null);
      refresh();
      showToast("Publisher updated (reference data)");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const cellInput = "w-[64px] rounded border border-cream-2 bg-white px-1.5 py-1 text-right text-[13px] tabular-nums";

  return (
    <div className="min-h-screen">
      <ModuleHeader
        eyebrow="Ordering hub · reference data"
        title="Publishers"
        subtitle="Rep contacts, imprints, discount rates (publisher × order type), and the two account numbers every publisher holds — one for Simply Books, one for Prologue. Staff-maintained here, never hardcoded."
      />
      {error && <p className="px-8 py-10 text-sm font-semibold text-rust">{error}</p>}
      {!error && !data && <p className="px-8 py-10 text-sm text-stone">Loading…</p>}

      <div className="flex flex-col gap-3.5 px-4 py-5 sm:px-8">
        {(data?.publishers ?? []).map((p) => {
          const isOpen = open[p.id] ?? false;
          const isEditing = editing === p.id && edit;
          const missing = LOCATIONS.filter((l) => !p.accountNumbers[l]);
          return (
            <div key={p.id} className="overflow-hidden rounded-xl border border-cream-2 bg-white">
              <button
                onClick={() => setOpen((o) => ({ ...o, [p.id]: !isOpen }))}
                className="flex w-full cursor-pointer items-center gap-3.5 border-none bg-transparent px-4 py-4 text-left hover:bg-ink/[0.03] sm:px-5"
              >
                <svg
                  width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"
                  className={`shrink-0 text-stone transition-transform ${isOpen ? "rotate-90" : ""}`}
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[21px] leading-tight">{p.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-stone">
                    {p.repName || "No rep on file"}
                    {p.imprints.length > 0 && ` · ${p.imprints.length} imprint${p.imprints.length === 1 ? "" : "s"}`}
                  </div>
                </div>
                {missing.length > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E9C5BE] bg-[#FBEAE7] px-2.5 py-1 text-[11.5px] font-semibold text-rust-deep">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
                    </svg>
                    Missing {missing.join(" + ")} account no.
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="grid gap-6 border-t border-cream-2 px-4 py-5 sm:px-5 lg:grid-cols-2">
                  <div>
                    <div className="eyebrow mb-2.5 text-stone">Discount · publisher × order type</div>
                    <table className="w-full border-collapse text-[13px]">
                      <thead>
                        <tr className="text-left text-[11px] text-stone">
                          <th className="px-2 py-1.5 font-semibold">Order type</th>
                          <th className="px-2 py-1.5 text-right font-semibold">Simply Books</th>
                          <th className="px-2 py-1.5 text-right font-semibold">Prologue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ORDER_TYPES.map(({ key, label }) => {
                          const effective = (loc: Location) => rateFor(p, key, loc);
                          return (
                            <tr key={key} className="border-t border-cream-2">
                              <td className="px-2 py-2 text-charcoal">
                                {label}
                                {key === "restock" && <span className="ml-1.5 text-[10px] text-stone">base</span>}
                              </td>
                              {LOCATIONS.map((loc) => (
                                <td key={loc} className="px-2 py-2 text-right tabular-nums">
                                  {isEditing ? (
                                    loc === "Simply Books" ? (
                                      <span className="inline-flex items-center gap-1">
                                        <input
                                          value={edit!.rates[key]}
                                          onChange={(e) => setEdit({ ...edit!, rates: { ...edit!.rates, [key]: e.target.value.replace(/[^0-9.]/g, "") } })}
                                          className={cellInput}
                                          placeholder="—"
                                        />
                                        %
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1" title="Per-account override (rare) — blank uses the base rate">
                                        <input
                                          value={edit!.overrides[loc][key]}
                                          onChange={(e) =>
                                            setEdit({
                                              ...edit!,
                                              overrides: { ...edit!.overrides, [loc]: { ...edit!.overrides[loc], [key]: e.target.value.replace(/[^0-9.]/g, "") } },
                                            })
                                          }
                                          className={cellInput}
                                          placeholder="base"
                                        />
                                        %
                                      </span>
                                    )
                                  ) : isOverridden(p, key, loc) ? (
                                    <span className="rounded px-1.5 py-0.5 font-bold" style={{ color: accent, background: accentSoft }}>
                                      {effective(loc)}%
                                    </span>
                                  ) : effective(loc) != null ? (
                                    <span className={loc === "Simply Books" ? "font-semibold" : ""}>{effective(loc)}%</span>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-2 text-[11.5px] text-stone">
                      Rate = publisher × order type, applied to both accounts; blank types fall back to the Restock base.
                      A highlighted rate is a rare per-account override. Imprints always inherit the parent rate.
                    </p>
                  </div>

                  <div>
                    <div className="eyebrow mb-2.5 text-stone">Rep &amp; accounts</div>
                    {isEditing ? (
                      <div className="flex flex-col gap-2">
                        <input
                          value={edit!.repName}
                          onChange={(e) => setEdit({ ...edit!, repName: e.target.value })}
                          placeholder="Rep name"
                          className="rounded-md border border-cream-2 bg-white px-3 py-2 text-sm"
                        />
                        <input
                          value={edit!.repEmail}
                          onChange={(e) => setEdit({ ...edit!, repEmail: e.target.value })}
                          placeholder="Rep email"
                          className="rounded-md border border-cream-2 bg-white px-3 py-2 text-sm"
                        />
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          {LOCATIONS.map((loc) => (
                            <div key={loc}>
                              <div className="mb-1 text-[11px] text-stone">{loc} acct</div>
                              <input
                                value={edit!.accountNumbers[loc]}
                                onChange={(e) => setEdit({ ...edit!, accountNumbers: { ...edit!.accountNumbers, [loc]: e.target.value } })}
                                placeholder="Required to send"
                                className="w-full rounded-md border border-cream-2 bg-white px-3 py-2 text-sm tabular-nums"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[13.5px] leading-relaxed text-charcoal">
                        <div>
                          <strong>{p.repName || "No rep on file"}</strong>
                          {p.repEmail && <span> · {p.repEmail}</span>}
                        </div>
                        <div className="mt-2.5 flex gap-6">
                          {LOCATIONS.map((loc) => (
                            <div key={loc}>
                              <div className="text-[11px] text-stone">{loc} acct</div>
                              <div className={`font-semibold tabular-nums ${!p.accountNumbers[loc] ? "text-rust-deep" : ""}`}>
                                {p.accountNumbers[loc] || "Not set"}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {p.imprints.length > 0 && (
                      <>
                        <div className="eyebrow mb-2 mt-4 text-stone">Imprints — inherit the parent rate</div>
                        <div className="flex flex-wrap gap-1.5">
                          {p.imprints.map((im) => (
                            <span key={im} className="rounded-full border border-cream-2 bg-cream px-2.5 py-1 text-xs text-charcoal">
                              {im}
                            </span>
                          ))}
                        </div>
                      </>
                    )}

                    {data?.canEditPublishers && (
                      <div className="mt-4 flex gap-2">
                        {isEditing ? (
                          <>
                            <button
                              onClick={() => {
                                setEditing(null);
                                setEdit(null);
                              }}
                              className="cursor-pointer rounded-md border-[1.5px] border-cream-2 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-charcoal hover:border-ink"
                            >
                              Discard
                            </button>
                            <button
                              onClick={() => save(p)}
                              disabled={busy}
                              className="cursor-pointer rounded-md border-[1.5px] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
                              style={{ background: accent, borderColor: accent }}
                            >
                              {busy ? "Saving…" : "Save changes"}
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setEditing(p.id);
                              setEdit(toEdit(p));
                            }}
                            className="cursor-pointer rounded-md border-[1.5px] border-cream-2 bg-white px-3.5 py-2 text-[12.5px] font-semibold text-charcoal hover:border-ink"
                          >
                            Edit rates &amp; accounts
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {toast && <Toast text={toast} />}
    </div>
  );
}
