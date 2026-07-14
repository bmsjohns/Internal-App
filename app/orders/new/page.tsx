"use client";

import PageHeader from "@/components/PageHeader";
import OrderForm from "@/components/OrderForm";
import { useVenue } from "@/components/VenueContext";
import { VENUES } from "@/lib/config";

export default function NewOrderPage() {
  const { venue } = useVenue();
  const venueLabel = venue === "all" ? "Both venues" : VENUES[venue].label;
  return (
    <div className="ob-screen">
      <PageHeader compact backHref="/orders" eyebrow={`${venueLabel} · Special / pre-order`} title="New order" />
      <OrderForm />
    </div>
  );
}
