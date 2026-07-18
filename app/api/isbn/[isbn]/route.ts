import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Book metadata lookup for barcode-first entry (spec §2a "speed of entry").
// Google Books first (cleaner titles/authors), OpenLibrary as fallback.
// Both free, no API key.

type Params = { params: Promise<{ isbn: string }> };

async function fromOpenLibrary(isbn: string) {
  const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, {
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return null;
  const book = await res.json();
  let author = "";
  const authorKey = book.authors?.[0]?.key;
  if (authorKey) {
    const a = await fetch(`https://openlibrary.org${authorKey}.json`, {
      signal: AbortSignal.timeout(4000),
    });
    if (a.ok) author = (await a.json()).name ?? "";
  }
  // OpenLibrary author records sometimes carry catalogue suffixes.
  author = author.replace(/\s*-\s*undifferentiated$/i, "").trim();
  return book.title ? { title: book.title as string, author } : null;
}

async function fromGoogleBooks(isbn: string) {
  // country=GB biases Google Books towards the UK edition's title (V3 §8).
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}&country=GB`,
    { signal: AbortSignal.timeout(4000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const info = data.items?.[0]?.volumeInfo;
  return info?.title
    ? {
        title: info.title as string,
        author: (info.authors ?? []).join(", "),
        // Ordering Hub staging (spec C2): publisher auto-populates from the
        // lookup where available, always manually correctable.
        publisher: (info.publisher as string | undefined) ?? "",
        rrp: (data.items?.[0]?.saleInfo?.listPrice?.amount as number | undefined) ?? null,
      }
    : null;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { isbn: raw } = await params;
  const isbn = raw.replace(/[^0-9Xx]/g, "");
  if (isbn.length !== 10 && isbn.length !== 13) {
    return NextResponse.json({ error: "Invalid ISBN" }, { status: 400 });
  }

  let book = null;
  try {
    book = await fromGoogleBooks(isbn);
  } catch {}
  if (!book) {
    try {
      book = await fromOpenLibrary(isbn);
    } catch {}
  }
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ book });
}
