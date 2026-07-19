import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getDataSource } from "@/lib/data";
import { can, getSessionUser } from "@/lib/auth";
import { canonicalStatus } from "@/lib/config";
import { exportFilename, exportLocation, uniqueWorksheetName } from "@/lib/export-workbook";

// V3 §4: outstanding orders as XLSX, one sheet per supplier/publisher, with
// the shop's account number for that supplier (from Settings). "Outstanding"
// here = not yet ordered — the file you send to / key into the supplier
// system before marking rows as ordered. (Whether ordered-but-not-arrived
// should also be included is an open question for Ben — see README.)
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ds = getDataSource();
  const [orders, suppliers] = await Promise.all([ds.listOrders(), ds.listSuppliers()]);
  const location = exportLocation(req.nextUrl.searchParams.get("location"));
  if (location && !can(user, "ordering.send", location)) return NextResponse.json({ error: "Order sending is not granted for this location" }, { status: 403 });
  if (!location && !can(user, "ordering.send")) return NextResponse.json({ error: "Order sending access required" }, { status: 403 });
  const outstanding = orders.filter(
    (o) => canonicalStatus(o.status).key === "needs-ordering" && (!location || o.location === location) && can(user, "ordering.send", o.location)
  );

  const bySupplier = new Map<string, typeof outstanding>();
  for (const o of outstanding) {
    const key = o.publisher || "Unassigned";
    bySupplier.set(key, [...(bySupplier.get(key) ?? []), o]);
  }

  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const names = [...bySupplier.keys()].sort((a, b) =>
    a === "Unassigned" ? 1 : b === "Unassigned" ? -1 : a.localeCompare(b)
  );

  const usedSheetNames = new Set<string>();
  for (const name of names) {
    const ws = wb.addWorksheet(uniqueWorksheetName(name, usedSheetNames));
    const account = suppliers.find((s) => s.name === name)?.accountNumber ?? "";
    ws.columns = [
      { header: "Title", key: "title", width: 42 },
      { header: "ISBN", key: "isbn", width: 16 },
      { header: "Quantity", key: "qty", width: 10 },
      { header: "Location", key: "location", width: 16 },
      { header: "Account number", key: "account", width: 18 },
    ];
    ws.getRow(1).font = { bold: true };
    for (const o of bySupplier.get(name)!) {
      ws.addRow({ title: o.bookTitle, isbn: o.isbn, qty: o.quantity, location: o.location, account });
    }
  }
  if (names.length === 0) {
    const ws = wb.addWorksheet("Nothing outstanding");
    ws.addRow(["No orders are waiting to be placed."]);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${exportFilename(location, date)}"`,
    },
  });
}
