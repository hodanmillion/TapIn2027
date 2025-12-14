import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { VisualEditsMessenger } from "orchids-visual-edits";
import { Toaster } from "@/components/ui/sonner"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tapin.app"),
  title: "TapIn - Location-Based Social Connection",
  description: "Walk in. You're in. Leave. You're out. Connect with people at your location instantly.",
  icons: {
    icon: "/Tapin.svg",
    apple: "/Tapin.svg",
  },
  openGraph: {
    title: "TapIn - Location-Based Social Connection",
    description: "Walk in. You're in. Leave. You're out. Connect with people at your location instantly.",
    siteName: "TapIn",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "TapIn - Location-Based Social Connection",
    description: "Walk in. You're in. Leave. You're out. Connect with people at your location instantly.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <Toaster richColors position="top-center" closeButton />
        <VisualEditsMessenger />
      </body>
    </html>
  );
}