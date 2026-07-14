import { getDataSource } from "@/lib/data";

// Always fetch fresh — this page must never be baked at build time.
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const customers = await getDataSource().listCustomers();
  const sorted = [...customers].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div>
      <h1 className="text-3xl font-semibold">Customers</h1>
      <p className="mt-1 text-sm text-ink/60">
        {sorted.length} customers. New customers are added from the order form.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-ink/15 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-ink/15 text-left text-xs uppercase tracking-wide text-ink/50">
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Orders</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <tr key={c.id} className="border-b border-ink/10 last:border-0">
                <td className="px-3 py-2 font-medium">{c.name}</td>
                <td className="px-3 py-2 text-ink/80">{c.phone || "—"}</td>
                <td className="px-3 py-2 text-ink/80">{c.email || "—"}</td>
                <td className="px-3 py-2 text-ink/60">{c.orderIds.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
