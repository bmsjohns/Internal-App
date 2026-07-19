"use client";

import VenueEditor from "@/components/events/VenueEditor";
import EventEditGate from "@/components/events/EventEditGate";

export default function NewVenuePage() {
  return <EventEditGate title="New venue" backHref="/venues"><VenueEditor /></EventEditGate>;
}
