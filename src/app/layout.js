import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import DeliveryModal from "@/app/components/DeliveryModal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "StockSnap — Kirana Inventory",
  description: "Snap a vendor's handwritten delivery note; AI updates your inventory.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="border-b border-zinc-200 bg-white">
          <div className="mx-auto flex w-full max-w-[1800px] items-center justify-between px-6 py-4 lg:px-10">
            <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
              <span className="text-2xl">📦</span> StockSnap
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link href="/" className="rounded-md px-3 py-2 hover:bg-zinc-100">Dashboard</Link>
              <DeliveryModal />
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1800px] flex-1 px-6 py-8 lg:px-10">{children}</main>
        <footer className="border-t border-zinc-200 bg-white py-4 text-center text-xs text-zinc-500">
          StockSnap · AI-assisted inventory for daily kirana vendors
        </footer>
      </body>
    </html>
  );
}
