import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled, getSessionUser } from "@/lib/auth";
import Sidebar from "@/components/Sidebar";
import { VenueProvider } from "@/components/VenueContext";
import "./globals.css";

const newSpirit = localFont({
  src: "./fonts/NewSpirit-Regular.otf",
  variable: "--font-new-spirit",
});
const karla = localFont({
  src: [
    { path: "./fonts/Karla-Regular.ttf", weight: "400" },
    { path: "./fonts/Karla-SemiBold.ttf", weight: "600" },
  ],
  variable: "--font-karla",
});

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
    <html lang="en" className={`${newSpirit.variable} ${karla.variable}`}>
      <body className="min-h-screen">
        <VenueProvider>
          <div className="flex min-h-screen">
            <Sidebar user={user} />
            <main className="min-w-0 flex-1 bg-cream">{children}</main>
          </div>
        </VenueProvider>
      </body>
    </html>
  );
  return clerkEnabled ? <ClerkProvider>{body}</ClerkProvider> : body;
}
