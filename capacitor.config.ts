import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.toeic-sigma.shun",
  appName: "All-in ENGLISH",
  webDir: "out",
  server: {
    // 静的エクスポートは同一オリジンにAPIがないため、本番APIを利用（NEXT_PUBLIC_API_ORIGINでクライアント側で指定済み）
  },
};

export default config;
