import { redirect } from "next/navigation";

// Daily Briefing is the default landing page (briefing spec §1).
export default function Home() {
  redirect("/briefing");
}
