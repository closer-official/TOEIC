import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Playfair_Display, Cinzel } from "next/font/google";
import { HeaderStatsProvider } from "@/lib/header-stats-context";
import { BgmProvider } from "@/lib/bgm-context";
import { OfflineProvider } from "@/lib/offline-context";
import { OfflineDownloadScreen } from "@/components/OfflineDownloadScreen";
import { AppAuthCallbackListenerWrapper } from "@/components/AppAuthCallbackListenerWrapper";
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

const cinzel = Cinzel({
  variable: "--font-cinzel",
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
        className={`${geistSans.variable} ${geistMono.variable} ${playfair.variable} ${cinzel.variable} antialiased min-h-[100dvh] overscroll-none bg-zinc-950 text-white`}
      >
        {apiOrigin ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){var e=document.documentElement,o=e.getAttribute('data-api-origin')||'';if(!o)return;var f=window.fetch;function token(){try{var explicit=localStorage.getItem('app_api_bearer_token')||'';if(explicit)return explicit;for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||'';if(!/^sb-.*-auth-token$/.test(k))continue;var raw=localStorage.getItem(k);if(!raw)continue;var p=JSON.parse(raw);if(p&&typeof p==='object'){if(typeof p.access_token==='string'&&p.access_token)return p.access_token;if(Array.isArray(p)&&p[0]&&typeof p[0].access_token==='string')return p[0].access_token;if(p.currentSession&&typeof p.currentSession.access_token==='string')return p.currentSession.access_token;}}}catch(_e){}return '';}window.fetch=function(u,opts){var isRel=typeof u==='string'&&u.charAt(0)==='/';var url=isRel?o+u:u;var target=typeof url==='string'?url:(url&&url.url?url.url:'');var isApi=typeof target==='string'&&target.indexOf('/api/')>=0;var finalOpts=opts?Object.assign({},opts):{};if(isApi){if(finalOpts.credentials==null)finalOpts.credentials='include';var t=token();if(t){var h=new Headers(finalOpts.headers||undefined);if(!h.get('Authorization'))h.set('Authorization','Bearer '+t);finalOpts.headers=h;}}return f.call(this,url,finalOpts);};})();`,
            }}
          />
        ) : null}
        <HeaderStatsProvider>
          <OfflineProvider>
            <BgmProvider>
              <AppAuthCallbackListenerWrapper />
              {children}
              <OfflineDownloadScreen />
            </BgmProvider>
          </OfflineProvider>
        </HeaderStatsProvider>
      </body>
    </html>
  );
}
