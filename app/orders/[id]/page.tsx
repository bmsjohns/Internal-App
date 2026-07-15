import { notFound } from "next/navigation";
import Link from "next/link";
import { getDataSource } from "@/lib/data";
import { canDeleteAt, getSessionUser } from "@/lib/auth";
import { VENUES, venueKeyOf } from "@/lib/config";
import PageHeader, { btnGhost } from "@/components/PageHeader";
import { Avatar, StatusChip } from "@/components/chips";
import BookCover from "@/components/BookCover";
import StatusTimeline from "@/components/StatusTimeline";
import DeleteOrderButton from "@/components/DeleteOrderButton";

export const dynamic = "force-dynamic";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const ds = getDataSource();
  const order = await ds.getOrder(id);
  if (!order) notFound();
  const customer = order.customerIds[0] ? await ds.getCustomer(order.customerIds[0]) : null;

  const venue = VENUES[venueKeyOf(order.location)];

  const facts: [string, string][] = [
    ["Paid", order.paid || "—"],
    ["Quantity", String(order.quantity)],
    ["Price", order.price != null ? `£${order.price.toFixed(2)}` : "—"],
    ["Supplier", order.publisher || "—"],
    ["Delivery", order.deliveryMethod || "—"],
    ["Location", venue.label],
    ["Team member", order.teamMember || "—"],
    ["Order date", fmt(order.orderDate)],
    ["Pub. date", order.preorderPublicationDate ? new Date(order.preorderPublicationDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"],
    ["Airtable status", order.status || "—"],
  ];

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader
        compact
        backHref="/orders"
        eyebrow={`${venue.label} · Order #${order.id.slice(-5).toUpperCase()}`}
        title=""
        actions={
          <>
            <Link href={`/orders/${order.id}/edit`} className={btnGhost}>
              Edit
            </Link>
            {user && canDeleteAt(user, order.location) && (
              <DeleteOrderButton orderId={order.id} bookTitle={order.bookTitle} />
            )}
          </>
        }
      />

      <div className="mx-auto grid w-full max-w-[1080px] grid-cols-1 gap-8 px-5 pb-12 pt-7 sm:px-8 lg:grid-cols-[1.5fr_1fr]">
        <div>
          <div className="flex gap-5">
            <BookCover isbn={order.isbn} title={order.bookTitle} />
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                {order.isPreorder && (
                  <span className="rounded-full border border-coral px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-coral">
                    Pre-order
                  </span>
                )}
                {order.specialOrder && (
                  <span className="rounded-full border border-cream-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-charcoal">
                    Special order
                  </span>
                )}
                {order.quantity > 1 && (
                  <span className="rounded-full border border-cream-2 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-charcoal">
                    ×{order.quantity}
                  </span>
                )}
              </div>
              <h1 className="m-0 text-[34px] leading-[1.05] tracking-[-0.02em]">{order.bookTitle}</h1>
              {order.author && <div className="mt-1.5 text-[17px] text-charcoal">{order.author}</div>}
              {order.isbn && <div className="mt-1.5 font-mono text-[13px] text-stone">ISBN {order.isbn}</div>}
            </div>
          </div>
          {order.notes && (
            <div className="mt-5 rounded-lg border border-cream-2 bg-white px-4 py-3 text-sm text-charcoal">
              {order.notes}
            </div>
          )}

          <div className="mt-8">
            <div className="eyebrow mb-3.5 text-stone">Progress — click a stage to update</div>
            <StatusTimeline
              orderId={order.id}
              rawStatus={order.status}
              lastModified={order.lastModified}
              log={order.statusLog}
            />
          </div>
        </div>

        {/* side facts */}
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-cream-2 bg-white px-5 py-[18px]">
            <div className="mb-3.5 flex items-center justify-between">
              <span className="eyebrow text-stone">Status</span>
              <StatusChip raw={order.status} />
            </div>
            <div className="flex flex-col">
              {facts.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3 border-t border-cream-2 py-[11px] text-sm">
                  <span className="text-stone">{k}</span>
                  <span className="text-right font-semibold text-ink">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-cream-2 bg-white px-5 py-[18px]">
            <div className="eyebrow mb-3 text-stone">Customer</div>
            {customer ? (
              <>
                <Link href={`/customers/${customer.id}`} className="flex items-center gap-3 no-underline hover:opacity-80">
                  <Avatar name={customer.name} size={42} />
                  <div className="leading-snug">
                    <div className="text-[15px] font-semibold text-ink">{customer.name}</div>
                    {customer.phone && <div className="text-[13px] text-stone">{customer.phone}</div>}
                  </div>
                </Link>
                {(customer.email || customer.address) && (
                  <div className="mt-3 border-t border-cream-2 pt-3 text-[13px] leading-relaxed text-charcoal">
                    {customer.email}
                    {customer.email && customer.address && <br />}
                    {customer.address}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-stone">No customer linked.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
