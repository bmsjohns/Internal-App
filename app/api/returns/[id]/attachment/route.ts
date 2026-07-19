import { NextRequest, NextResponse } from "next/server";
import { can, getSessionUser } from "@/lib/auth";
import { getReturnsDataSource } from "@/lib/data/returns";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp", "image/heic"]);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const source = getReturnsDataSource();
  const request = await source.getReturn(id);
  if (!request) return NextResponse.json({ error: "Return not found" }, { status: 404 });
  if (!can(user, "returns.manage", request.location)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (5MB max)" }, { status: 400 });
  if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ error: "Use a PDF, JPG, PNG, WebP or HEIC file" }, { status: 400 });

  const updated = await source.uploadApproval(id, {
    filename: file.name,
    contentType: file.type,
    base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
  });
  return NextResponse.json({ request: updated });
}
