import type { Metadata, Viewport } from "next";
import { Fraunces, Figtree } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled, getSessionUser } from "@/lib/auth";
import Nav from "@/components/Nav";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  axes: ["SOFT", "opsz"],
});
const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree" });

export const metadata: Metadata = {
  title: "Order Book",
  description: "Customer orders for Simply Books & Prologue",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Order Book", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#ad3b28",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  const body = (
    <html lang="en" className={`${fraunces.variable} ${figtree.variable}`}>
      <body className="min-h-screen">
        <Nav user={user} />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-6">{children}</main>
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{body}</ClerkProvider> : body;
}
