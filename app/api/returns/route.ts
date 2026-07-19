import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getHubDataSource } from "@/lib/data/hub";
import { getReturnsDataSource } from "@/lib/data/returns";
import { LOCATIONS } from "@/lib/types";
import type { ReturnRequestInput, ReturnStatus } from "@/lib/types";
import { RETURN_STATUSES } from "@/lib/returns";

// Returns has its own module permissions (Ben, 19 Jul 2026): returns.view
// to see the queue, returns.manage for every lifecycle action — managed
// through the in-app roles system like the rest. Publishers ride along in
// the payload because every screen needs account numbers and rep names.

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "returns.view")) {
    return NextResponse.json({ error: "Returns access hasn't been granted to your account" }, { status: 403 });
  }
  const [returns, publishers] = await Promise.all([
    getReturnsDataSource().listReturns(),
    getHubDataSource().listPublishers(),
  ]);
  return NextResponse.json({
    returns: returns.filter((request) => can(user, "returns.view", request.location)),
    publishers,
    userName: user.name,
  });
}

const VALID_STATUS = new Set(RETURN_STATUSES.map((s) => s.key));

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!can(user, "returns.manage")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json();
  const src = getReturnsDataSource();
  try {
    if (body?.action !== "create" && body?.action !== "submitMany" && typeof body?.id === "string") {
      const target = await src.getReturn(body.id);
      if (!target) return NextResponse.json({ error: "Return not found" }, { status: 404 });
      if (!can(user, "returns.manage", target.location)) {
        return NextResponse.json({ error: `No returns access for ${target.location}` }, { status: 403 });
      }
    }
    switch (body?.action) {
      case "create": {
        const inputs = (Array.isArray(body.requests) ? body.requests : []) as ReturnRequestInput[];
        if (inputs.length === 0) return NextResponse.json({ error: "Nothing to create" }, { status: 400 });
        for (const input of inputs) {
          if (!LOCATIONS.includes(input.location)) {
            return NextResponse.json({ error: "A valid location is required" }, { status: 400 });
          }
          if (!can(user, "returns.manage", input.location)) {
            return NextResponse.json({ error: `No returns access for ${input.location}` }, { status: 403 });
          }
          if (!Array.isArray(input.lines) || input.lines.length === 0) {
            return NextResponse.json({ error: "Requests are always itemised — add at least one line" }, { status: 400 });
          }
          input.origin = input.origin === "event" ? "event" : "general";
          input.lines = input.lines.map((l) => ({
            title: String(l.title ?? "").trim() || "Unknown title",
            isbn: String(l.isbn ?? "").replace(/[^0-9Xx]/g, ""),
            quantity: Math.max(1, Math.floor(Number(l.quantity) || 1)),
            reason: String(l.reason ?? ""),
            condition: String(l.condition ?? ""),
            rrp: l.rrp == null ? null : Number(l.rrp),
          }));
        }
        return NextResponse.json({ returns: await src.createRequests(inputs, user.name) });
      }
      case "setRoute": {
        if (!body.id || !["direct", "gardners"].includes(body.route)) {
          return NextResponse.json({ error: "id and a valid route are required" }, { status: 400 });
        }
        const request = await src.getReturn(body.id);
        if (!request) return NextResponse.json({ error: "Return not found" }, { status: 404 });
        if (!can(user, "returns.manage", request.location)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        return NextResponse.json({ request: await src.setRoute(body.id, body.route, user.name) });
      }
      case "discard": {
        if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
        await src.discard(body.id, user.name);
        return NextResponse.json({ ok: true });
      }
      case "submit": {
        if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
        return NextResponse.json({ request: await src.submit(body.id, user.name) });
      }
      case "submitMany": {
        const ids: string[] = Array.isArray(body.ids)
          ? [...new Set<string>(body.ids.filter((id: unknown): id is string => typeof id === "string"))]
          : [];
        if (ids.length === 0) return NextResponse.json({ error: "No returns selected" }, { status: 400 });
        const targets = await Promise.all(ids.map((id) => src.getReturn(id)));
        if (targets.some((target) => !target)) return NextResponse.json({ error: "One or more returns no longer exist" }, { status: 409 });
        for (const target of targets) {
          if (!target || !can(user, "returns.manage", target.location)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
          if (target.status !== "requested" || !target.route) {
            return NextResponse.json({ error: `${target.code} is no longer ready to submit` }, { status: 409 });
          }
        }
        const submitted = [];
        for (const target of targets) {
          try {
            submitted.push(await src.submit(target!.id, user.name));
          } catch (error) {
            return NextResponse.json({
              error: `Submitted ${submitted.length} of ${targets.length}; ${target!.code} failed: ${error instanceof Error ? error.message : "unknown error"}`,
              submittedIds: submitted.map((request) => request.id),
            }, { status: 409 });
          }
        }
        return NextResponse.json({ returns: submitted });
      }
      case "approve": {
        if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
        return NextResponse.json({
          request: await src.approve(body.id, String(body.raNumber ?? ""), String(body.raFilename ?? ""), user.name),
        });
      }
      case "pick": {
        if (!body.id || !body.lineId) return NextResponse.json({ error: "id and lineId are required" }, { status: 400 });
        const count = Math.max(1, Math.floor(Number(body.count) || 1));
        return NextResponse.json({ request: await src.pick(body.id, body.lineId, count, user.name) });
      }
      case "ship": {
        if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
        return NextResponse.json({ request: await src.confirmShipped(body.id, user.name) });
      }
      case "credit": {
        if (!body.id) return NextResponse.json({ error: "id is required" }, { status: 400 });
        const amount = body.amount == null || body.amount === "" ? null : Number(body.amount);
        if (amount != null && (!isFinite(amount) || amount < 0)) {
          return NextResponse.json({ error: "Credit amount must be a positive number" }, { status: 400 });
        }
        return NextResponse.json({ request: await src.confirmCredit(body.id, amount, user.name) });
      }
      case "revert": {
        if (!body.id || !VALID_STATUS.has(body.to)) {
          return NextResponse.json({ error: "id and a valid target status are required" }, { status: 400 });
        }
        return NextResponse.json({ request: await src.revert(body.id, body.to as ReturnStatus, user.name) });
      }
      default:
        return NextResponse.json({ error: `Unknown action "${body?.action}"` }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Action failed" }, { status: 400 });
  }
}
