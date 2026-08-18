import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Newsreader } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { BackgroundBlobs } from "@/components/press-release/background-blobs";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-newsreader",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Kemenag Depok Auto Press Release Generator",
  description: "Generator draf press release resmi Kemenag Kota Depok",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="id"
      className={cn(plusJakarta.variable, newsreader.variable)}
    >
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <BackgroundBlobs />
        {children}
      </body>
    </html>
  );
}
