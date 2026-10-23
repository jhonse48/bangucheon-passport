import { Capacitor } from "@capacitor/core";

export type NativeDeviceErrorCode =
  "cancelled" | "permission" | "unavailable" | "failed";

export class NativeDeviceError extends Error {
  constructor(
    public readonly code: NativeDeviceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NativeDeviceError";
  }
}

export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

/** Android hardware/system back: close one layer, then exit only from the map. */
export async function registerBackButtonHandler(
  onBack: () => boolean,
): Promise<() => void> {
  if (!isNativeApp() || Capacitor.getPlatform() !== "android") {
    return () => undefined;
  }
  const { App } = await import("@capacitor/app");
  const listener = await App.addListener("backButton", () => {
    if (!onBack()) void App.exitApp();
  });
  return () => {
    void listener.remove();
  };
}

function deviceError(error: unknown, action: string): NativeDeviceError {
  if (error instanceof NativeDeviceError) return error;
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message)
      : String(error);
  if (/cancel|canceled|cancelled|dismiss|취소/i.test(message)) {
    return new NativeDeviceError(
      "cancelled",
      `${action}을 취소했습니다. 다시 시도할 수 있어요.`,
    );
  }
  if (/permission|denied|not authorized|restricted|권한/i.test(message)) {
    return new NativeDeviceError(
      "permission",
      "카메라 권한이 필요해요. 휴대폰 설정에서 반구천 탐험지도의 카메라 권한을 허용해 주세요.",
    );
  }
  if (
    /unavailable|not available|not implemented|not supported|no camera/i.test(
      message,
    )
  ) {
    return new NativeDeviceError(
      "unavailable",
      "이 기기에서 카메라를 사용할 수 없어요. 실제 휴대폰에서 다시 시도해 주세요.",
    );
  }
  return new NativeDeviceError(
    "failed",
    `${action}을 완료하지 못했어요. 카메라를 확인하고 다시 시도해 주세요.`,
  );
}

/** Call only after the visitor presses the QR scan button. Never opens URLs. */
export async function scanMissionQr(): Promise<string> {
  if (!isNativeApp()) {
    throw new NativeDeviceError(
      "unavailable",
      "QR 카메라 스캔은 휴대폰 앱에서 사용할 수 있어요. 미리보기에서는 미션 코드를 입력해 주세요.",
    );
  }
  try {
    const {
      CapacitorBarcodeScanner,
      CapacitorBarcodeScannerTypeHint,
      CapacitorBarcodeScannerCameraDirection,
      CapacitorBarcodeScannerScanOrientation,
    } = await import("@capacitor/barcode-scanner");
    const result = await CapacitorBarcodeScanner.scanBarcode({
      hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
      cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
      scanOrientation: CapacitorBarcodeScannerScanOrientation.ADAPTIVE,
      scanInstructions: "미션 QR 코드를 화면 안에 맞춰 주세요",
      scanButton: false,
      cancelButtonAccessibilityLabel: "QR 스캔 취소",
      torchButtonOnAccessibilityLabel: "손전등 켜기",
      torchButtonOffAccessibilityLabel: "손전등 끄기",
    });
    const value = result.ScanResult?.trim();
    if (!value)
      throw new NativeDeviceError(
        "cancelled",
        "QR 스캔을 취소했습니다. 다시 시도할 수 있어요.",
      );
    return value;
  } catch (error) {
    throw deviceError(error, "QR 스캔");
  }
}

/** A real camera capture; not a gallery picker or an image recognition claim. */
export async function takeMissionPhoto(): Promise<Blob> {
  if (!isNativeApp()) {
    throw new NativeDeviceError(
      "unavailable",
      "휴대폰 앱에서 카메라로 촬영할 수 있어요. 미리보기에서는 사진 파일을 선택해 주세요.",
    );
  }
  try {
    const { Camera, CameraResultType, CameraSource } =
      await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      source: CameraSource.Camera,
      resultType: CameraResultType.Uri,
      quality: 85,
      width: 1600,
      height: 1600,
      correctOrientation: true,
      allowEditing: false,
      saveToGallery: false,
    });
    if (!photo.webPath) throw new Error("Photo path unavailable");
    const response = await fetch(photo.webPath);
    if (!response.ok) throw new Error("Could not read captured photo");
    const blob = await response.blob();
    if (!blob.size || !blob.type.startsWith("image/"))
      throw new Error("Invalid captured photo");
    return blob;
  } catch (error) {
    throw deviceError(error, "사진 촬영");
  }
}

/** One foreground reading, requested only by the current-location button. */
export async function getCurrentPosition(): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
}> {
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 30000,
    });
    const { latitude, longitude, accuracy } = position.coords;
    return { latitude, longitude, accuracy };
  } catch (error) {
    const detail =
      error && typeof error === "object"
        ? (error as { code?: string | number; message?: string })
        : { message: String(error) };
    if (
      detail.code === 1 ||
      detail.code === "OS-PLUG-GLOC-0003" ||
      /denied|permission/i.test(detail.message ?? "")
    ) {
      throw new NativeDeviceError(
        "permission",
        "위치 권한이 꺼져 있어요. 권한을 허용하거나 지도에서 장소를 직접 골라 주세요.",
      );
    }
    if (detail.code === 3 || /timeout|timed out/i.test(detail.message ?? "")) {
      throw new NativeDeviceError(
        "failed",
        "현재 위치를 찾는 데 시간이 걸려요. 야외에서 다시 시도하거나 장소를 직접 골라 주세요.",
      );
    }
    throw new NativeDeviceError(
      "unavailable",
      "현재 위치를 가져올 수 없어요. 휴대폰의 위치 서비스를 확인하거나 장소를 직접 골라 주세요.",
    );
  }
}

/** Opens the OS share sheet only after an explicit export request. */
export async function shareExplorationData(data: unknown): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  if (json === undefined) throw new Error("내보낼 기록을 찾지 못했어요.");
  const filename = "bangucheon-exploration.json";
  if (!isNativeApp()) {
    const url = URL.createObjectURL(
      new Blob([json], { type: "application/json;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  try {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const file = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    try {
      await Share.share({
        title: "반구천 탐험 기록",
        dialogTitle: "탐험 기록 파일 저장 또는 공유",
        files: [file.uri],
      });
    } finally {
      await Filesystem.deleteFile({
        path: filename,
        directory: Directory.Cache,
      }).catch(() => undefined);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/cancel|dismiss/i.test(message)) {
      throw new NativeDeviceError(
        "cancelled",
        "기록 내보내기를 취소했습니다. 기록은 앱에 그대로 있어요.",
      );
    }
    throw new NativeDeviceError(
      "failed",
      "기록 파일을 내보내지 못했어요. 저장 공간을 확인하고 다시 시도해 주세요.",
    );
  }
}
