import OrderForm from "@/components/OrderForm";

export default function NewOrderPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold">New orders</h1>
      <p className="mt-1 text-sm text-ink/60">
        Scan an ISBN (or type it and press Enter) to fill in the book. Each “Add order” saves
        immediately — keep going for a stack of books.
      </p>
      <div className="mt-4">
        <OrderForm />
      </div>
    </div>
  );
}
