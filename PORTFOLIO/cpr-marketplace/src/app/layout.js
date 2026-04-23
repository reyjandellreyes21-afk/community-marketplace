import { Geist, Geist_Mono } from "next/font/google";
import GlobalCheckoutModal from "@/components/GlobalCheckoutModal";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "cpr/p — Marketplace",
    template: "%s | cpr/p",
  },
  description:
    "Connect neighbors, discover local sellers, and shop products and services in one community marketplace.",
  openGraph: {
    type: "website",
    locale: "en_PH",
    siteName: "cpr/p",
    title: "cpr/p — Marketplace",
    description:
      "Discover local sellers and everyday products in your neighborhood marketplace.",
    images: [
      {
        url: "/cpr-p.logo.png",
        alt: "cpr/p logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "cpr/p — Marketplace",
    description:
      "Discover local sellers and everyday products in your neighborhood marketplace.",
    images: ["/cpr-p.logo.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <GlobalCheckoutModal />
        {children}
      </body>
    </html>
  );
}
