import { MapPin, QrCode } from "lucide-react";
import { getExplorationPoint } from "@/data/exploration";

export function QrSiteInfo({ placeId }: { placeId: string }) {
  const point = getExplorationPoint(placeId);
  if (!point || point.qr.status === "not-listed") return null;
  return (
    <div className="qr-site-info">
      <div><QrCode size={18} /><strong>현장 QR 해설 찾기</strong><span className={point.qr.status === "photo-confirmed" ? "confirmed" : "pending"}>{point.qr.label}</span></div>
      <p><MapPin size={15} />{point.qr.where}</p>
      <small>{point.qr.find}</small>
    </div>
  );
}
