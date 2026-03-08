import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.toeic-sigma.shun",
  appName: "All-in ENGLISH",
  webDir: "out",
  server: {
    // 静的エクスポートは同一オリジンにAPIがないため、本番APIを利用（NEXT_PUBLIC_API_ORIGINでクライアント側で指定済み）
  },
  plugins: {
    // 実機の WebView で認証 cookie を保持する（Supabase セッション保持・API 認証に必須）
    CapacitorCookies: {
      enabled: true,
    },
  },
};

export default config;
