import { notFound } from "next/navigation";
import { getDataSource } from "@/lib/data";
import PageHeader from "@/components/PageHeader";
import { Avatar } from "@/components/chips";
import OrdersTable from "@/components/OrdersTable";

export const dynamic = "force-dynamic";

// V3 §7: customer profile — details + their order history, reusing the
// shared orders table rather than a bespoke list.
export default async function CustomerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ds = getDataSource();
  const customer = await ds.getCustomer(id);
  if (!customer) notFound();
  // Fetched by the customer's order links rather than filtering listOrders,
  // so the full history shows even past the recent-orders window.
  const orders = (await ds.getOrdersByIds(customer.orderIds))
    .sort((a, b) => (a.orderDate < b.orderDate ? 1 : -1))
    .map((o) => ({ ...o, customerName: customer.name, customerPhone: customer.phone }));

  return (
    <div className="ob-screen flex min-h-screen flex-col">
      <PageHeader compact backHref="/customers" eyebrow="Customer" title="" />
      <div className="mx-auto w-full max-w-[1080px] px-5 pt-7 sm:px-8">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={customer.name} size={54} />
          <div className="min-w-0 flex-1">
            <h1 className="m-0 text-[30px] leading-tight tracking-[-0.02em]">{customer.name}</h1>
            <div className="mt-1 text-sm text-charcoal">
              {[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact details"}
            </div>
            {customer.address && <div className="text-[13px] text-stone">{customer.address.replace(/\n/g, ", ")}</div>}
          </div>
        </div>
        {customer.notes && (
          <div className="mt-4 rounded-lg border border-cream-2 bg-white px-4 py-3 text-sm text-charcoal">
            {customer.notes}
          </div>
        )}
        <div className="eyebrow mb-2 mt-8 text-stone">
          Order history · {orders.length} order{orders.length === 1 ? "" : "s"}
        </div>
      </div>
      <div className="mx-auto w-full max-w-[1080px] flex-1 px-5 pb-12 sm:px-8">
        {orders.length === 0 ? (
          <p className="py-6 text-stone">No orders yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-cream-2">
            <OrdersTable orders={orders} showCustomer={false} />
          </div>
        )}
      </div>
    </div>
  );
}
