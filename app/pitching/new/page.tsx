"use client";

import PageHeader from "@/components/PageHeader";
import PitchForm from "@/components/pitching/PitchForm";

export default function NewPitch() {
  return (
    <div className="ob-screen">
      <PageHeader eyebrow="Events · Pitching" title="New pitch" backHref="/pitching" compact />
      <PitchForm />
    </div>
  );
}
