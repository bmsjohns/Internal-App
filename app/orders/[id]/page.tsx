import { notFound } from "next/navigation";
import { getDataSource } from "@/lib/data";
import { canDeleteAt, getSessionUser } from "@/lib/auth";
import { StatusBadge, VenueBadge } from "@/components/badges";
import OrderForm from "@/components/OrderForm";

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const ds = getDataSource();
  const order = await ds.getOrder(id);
  if (!order) notFound();
  const customer = order.customerIds[0] ? await ds.getCustomer(order.customerIds[0]) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold">{order.bookTitle}</h1>
        <StatusBadge status={order.status} />
        <VenueBadge location={order.location} />
      </div>
      <p className="mt-1 text-sm text-ink/60">
        Ordered {new Date(order.orderDate).toLocaleDateString("en-GB")}
        {order.teamMember && ` by ${order.teamMember}`} · last updated{" "}
        {new Date(order.lastModified).toLocaleDateString("en-GB")}
      </p>
      <div className="mt-5">
        <OrderForm
          order={order}
          customer={customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null}
          canDelete={user ? canDeleteAt(user, order.location) : false}
        />
      </div>
    </div>
  );
}
