import { redirect } from "next/navigation";

// The Ordering group's landing point — staging is Flow A, where work enters.
export default function OrderingIndex() {
  redirect("/ordering/staging");
}
