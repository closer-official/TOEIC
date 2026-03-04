import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { HeaderStatsProvider } from "@/lib/header-stats-context";
import { BgmProvider } from "@/lib/bgm-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
});

const siteTitle = "All-in ENGLISH - 暗記をeスポーツ化する";
const siteDescription = "All-in ENGLISH: 記憶のステージを可視化し、ゲームで暗記する";
const baseUrl =
  typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL
    ? process.env.NEXT_PUBLIC_APP_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://shun.closer-official.com";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "All-in ENGLISH" },
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/icon-192.png",
  },
  openGraph: {
    type: "website",
    title: siteTitle,
    description: siteDescription,
    siteName: "All-in ENGLISH",
    url: baseUrl,
    images: [{ url: `${baseUrl}/icon-512.png`, width: 512, height: 512, alt: "All-in ENGLISH" }],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [`${baseUrl}/icon-512.png`],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

const apiOrigin = process.env.NEXT_PUBLIC_API_ORIGIN ?? "";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" data-api-origin={apiOrigin}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} antialiased min-h-[100dvh] overscroll-none bg-zinc-950 text-white`}
      >
        {apiOrigin ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var e=document.documentElement,o=e.getAttribute('data-api-origin')||'';if(o){var f=window.fetch;window.fetch=function(u,opts){if(typeof u==='string'&&u.startsWith('/'))u=o+u;return f.call(this,u,opts);};}})();`,
            }}
          />
        ) : null}
        <HeaderStatsProvider>
          <BgmProvider>
            {children}
          </BgmProvider>
        </HeaderStatsProvider>
      </body>
    </html>
  );
}
