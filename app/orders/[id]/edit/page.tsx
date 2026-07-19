import { notFound } from "next/navigation";
import { getDataSource } from "@/lib/data";
import { can, getSessionUser } from "@/lib/auth";
import { VENUES, venueKeyOf } from "@/lib/config";
import PageHeader from "@/components/PageHeader";
import OrderForm from "@/components/OrderForm";

export const dynamic = "force-dynamic";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  const ds = getDataSource();
  const order = await ds.getOrder(id);
  if (!order || !user || !can(user, "orders.manage", order.location)) notFound();
  const customer = order.customerIds[0] ? await ds.getCustomer(order.customerIds[0]) : null;

  return (
    <div className="ob-screen">
      <PageHeader
        compact
        backHref="/orders"
        eyebrow={`${VENUES[venueKeyOf(order.location)].label} · Order #${order.id.slice(-5).toUpperCase()}`}
        title={`Edit — ${order.bookTitle}`}
      />
      <OrderForm
        order={order}
        customer={customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null}
      />
    </div>
  );
}
