import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { HeaderSearch } from "@/components/header-search";
import { UpdateNotice } from "@/components/update-notice";
import { CATEGORIES } from "@/lib/sources";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Medley",
  description: "Track movies, shows, anime and games",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* Browser extensions often add classes/attributes to <body> before React
          loads; this ignores those attribute differences on <body> only. */}
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <header className="border-b border-white/10">
          {/* items-baseline lines the bigger logo text up with the links' text */}
          <nav className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-6 gap-y-3 px-4 py-4">
            <Link href="/list" className="text-lg font-semibold">
              Medley
            </Link>
            <Link href="/list" className="text-sm text-muted hover:text-foreground">
              My list
            </Link>
            <Link href="/search" className="text-sm text-muted hover:text-foreground">
              Search
            </Link>
            <Link href="/settings" className="text-sm text-muted hover:text-foreground">
              Settings
            </Link>
            {/* Right side: update notice (when there is one) and search. On
                phones the search gets its own row below the links. */}
            <div className="flex w-full items-center gap-3 self-center sm:ml-auto sm:w-auto">
              <UpdateNotice />
              <HeaderSearch
                categories={Object.entries(CATEGORIES).map(([key, c]) => ({ key, label: c.label }))}
              />
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
