import { mkdir } from "node:fs/promises";
import QRCode from "qrcode";
import { quizMissions } from "../src/data/game-missions.ts";
await mkdir(new URL("../public/qr/", import.meta.url), { recursive: true });
for (const mission of quizMissions) {
  await QRCode.toFile(
    new URL("../public/qr/" + mission.id + ".svg", import.meta.url).pathname,
    mission.qrPayload,
    {
      type: "svg",
      margin: 3,
      errorCorrectionLevel: "M",
      width: 256,
      color: { dark: "#173f35", light: "#ffffff" },
    },
  );
}
console.log(
  "Generated " +
    quizMissions.length +
    " clearly documented app demonstration QR codes.",
);
