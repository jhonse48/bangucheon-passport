import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "반구천 탐험여권 — 발견하는 즐거움, 기록하는 여행",
  description:
    "반구천의 역사와 자연을 만나고, 나만의 탐방 여권을 완성하세요. 코스, 관찰 미션, 스탬프와 여행 기록을 한곳에서.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#173f35",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
