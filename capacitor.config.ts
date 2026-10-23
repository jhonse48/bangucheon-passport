import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "kr.bangucheon.passport",
  appName: "반구천 탐험지도",
  webDir: "out",
  backgroundColor: "#f4f6ef",
  loggingBehavior: "debug",
  server: {
    hostname: "localhost",
    androidScheme: "https",
  },
  ios: {
    contentInset: "never",
  },
};

export default config;
