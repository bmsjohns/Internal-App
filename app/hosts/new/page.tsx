"use client";

import HostEditor from "@/components/events/HostEditor";
import EventEditGate from "@/components/events/EventEditGate";

export default function NewHostPage() {
  return <EventEditGate title="New host" backHref="/hosts"><HostEditor /></EventEditGate>;
}
