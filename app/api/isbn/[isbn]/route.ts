import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Book metadata lookup for barcode-first entry (spec §2a "speed of entry").
// OpenLibrary first, Google Books as fallback. Both free, no API key.

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
  return book.title ? { title: book.title as string, author } : null;
}

async function fromGoogleBooks(isbn: string) {
  const res = await fetch(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
    { signal: AbortSignal.timeout(4000) }
  );
  if (!res.ok) return null;
  const data = await res.json();
  const info = data.items?.[0]?.volumeInfo;
  return info?.title
    ? { title: info.title as string, author: (info.authors ?? []).join(", ") }
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
    book = await fromOpenLibrary(isbn);
  } catch {}
  if (!book) {
    try {
      book = await fromGoogleBooks(isbn);
    } catch {}
  }
  if (!book) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ book });
}
