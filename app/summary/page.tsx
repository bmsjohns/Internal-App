import { redirect } from "next/navigation";

// The V1/V2 end-of-day summary became the To Order page in V3.
export default function SummaryRedirect() {
  redirect("/to-order");
}
