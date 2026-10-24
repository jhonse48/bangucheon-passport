import AVFoundation
import Capacitor
import CoreLocation
import CryptoKit
import ImageIO
import Photos
import UIKit

@objc(JourneyNativePlugin)
public final class JourneyNativePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "JourneyNativePlugin"
    public let jsName = "JourneyNative"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "startTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pauseTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "resumeTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stopTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getTrackingState", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAutomaticTracking", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestBackgroundAuthorization", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "ensureAutomaticJourney", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "acknowledgeArchived", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "renderVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "saveVideo", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "deleteJourneyVideos", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearVideos", returnType: CAPPluginReturnPromise)
    ]
    private let videoQueue = DispatchQueue(label: "kr.bangucheon.journey.video", qos: .userInitiated)
    private var renderInProgress = false
    private var videoFileOperationInProgress = false
    private var trackingObserver: UUID?

    public override func load() {
        DispatchQueue.main.async {
            self.trackingObserver = JourneyTrackingService.shared.observe { [weak self] snapshot in
                self?.notifyListeners("trackingUpdate", data: snapshot)
            }
        }
    }

    deinit {
        if let id = trackingObserver {
            DispatchQueue.main.async { JourneyTrackingService.shared.removeObserver(id) }
        }
    }

    private func complete(_ call: CAPPluginCall) -> JourneyTrackingService.Completion {
        { result in
            switch result {
            case .success(let snapshot): call.resolve(snapshot)
            case .failure(let error): call.reject(error.localizedDescription, "TRACKING_FAILED")
            }
        }
    }

    @objc public func getTrackingState(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(JourneyTrackingService.shared.getState()) }
    }

    @objc public func setAutomaticTracking(_ call: CAPPluginCall) {
        guard let enabled = call.getBool("enabled") else { call.reject("자동 기록 설정을 확인해 주세요."); return }
        DispatchQueue.main.async { JourneyTrackingService.shared.setAutomatic(enabled, completion: self.complete(call)) }
    }

    @objc public func requestBackgroundAuthorization(_ call: CAPPluginCall) {
        DispatchQueue.main.async { call.resolve(JourneyTrackingService.shared.requestBackgroundAuthorization()) }
    }

    @objc public func ensureAutomaticJourney(_ call: CAPPluginCall) {
        DispatchQueue.main.async { JourneyTrackingService.shared.ensureAutomaticJourney(completion: self.complete(call)) }
    }

    @objc public func acknowledgeArchived(_ call: CAPPluginCall) {
        guard let ids = call.getArray("journeyIds", String.self), ids.allSatisfy({ !$0.isEmpty && $0.count <= 200 }) else {
            call.reject("저장한 기록 식별자를 확인해 주세요."); return
        }
        DispatchQueue.main.async { JourneyTrackingService.shared.acknowledgeArchived(ids, completion: self.complete(call)) }
    }

    @objc public func startTracking(_ call: CAPPluginCall) {
        guard let id = call.getString("journeyId")?.trimmingCharacters(in: .whitespacesAndNewlines) else {
            call.reject("탐험 기록 식별자를 확인해 주세요."); return
        }
        DispatchQueue.main.async { JourneyTrackingService.shared.startManual(id, completion: self.complete(call)) }
    }

    @objc public func pauseTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async { JourneyTrackingService.shared.pause(completion: self.complete(call)) }
    }

    @objc public func resumeTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async { JourneyTrackingService.shared.resume(completion: self.complete(call)) }
    }

    @objc public func stopTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async { JourneyTrackingService.shared.stop(completion: self.complete(call)) }
    }

    @objc public func clearTracking(_ call: CAPPluginCall) {
        DispatchQueue.main.async { JourneyTrackingService.shared.clear(completion: self.complete(call)) }
    }

    @objc public func renderVideo(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard !self.renderInProgress && !self.videoFileOperationInProgress else {
                call.reject("영상을 만드는 중입니다. 완료 후 다시 시도해 주세요.", "RENDER_BUSY")
                return
            }
            self.renderInProgress = true
            self.videoQueue.async {
                do {
                    let renderer = try JourneyVideoRenderer(options: call.jsObjectRepresentation)
                    renderer.render(on: self.videoQueue) { result in
                        DispatchQueue.main.async {
                            self.renderInProgress = false
                            switch result {
                            case .success(let url): call.resolve(["uri": url.absoluteString, "fileName": url.lastPathComponent])
                            case .failure(let error): call.reject(error.localizedDescription, "VIDEO_RENDER_FAILED")
                            }
                        }
                    }
                } catch {
                    DispatchQueue.main.async {
                        self.renderInProgress = false
                        call.reject(error.localizedDescription, "INVALID_VIDEO_INPUT")
                    }
                }
            }
        }
    }

    @objc public func saveVideo(_ call: CAPPluginCall) {
        guard let uri = call.getString("uri"), let url = URL(string: uri), url.isFileURL,
              url.pathExtension.lowercased() == "mp4",
              url.standardizedFileURL.deletingLastPathComponent() == JourneyVideoRenderer.outputDirectory.standardizedFileURL,
              FileManager.default.fileExists(atPath: url.path) else {
            call.reject("저장할 영상 파일을 찾지 못했습니다. 영상을 다시 만들어 주세요.", "INVALID_VIDEO_FILE")
            return
        }
        DispatchQueue.main.async {
            guard !self.videoFileOperationInProgress else {
                call.reject("영상 파일을 처리하는 중입니다. 잠시 후 다시 시도해 주세요.", "VIDEO_BUSY")
                return
            }
            self.videoFileOperationInProgress = true
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                guard status == .authorized || status == .limited else {
                    DispatchQueue.main.async {
                        self.videoFileOperationInProgress = false
                        call.reject("사진 보관함 추가 권한이 없습니다. 설정에서 허용하거나 공유 메뉴에서 파일에 저장해 주세요.", "PHOTO_PERMISSION_DENIED")
                    }
                    return
                }
                PHPhotoLibrary.shared().performChanges {
                    PHAssetChangeRequest.creationRequestForAssetFromVideo(atFileURL: url)
                } completionHandler: { success, _ in
                    DispatchQueue.main.async {
                        self.videoFileOperationInProgress = false
                        if success { call.resolve(["saved": true]) }
                        else { call.reject("영상을 사진 보관함에 저장하지 못했습니다. 저장 공간을 확인하거나 파일에 저장해 주세요.", "PHOTO_SAVE_FAILED") }
                    }
                }
            }
        }
    }

    @objc public func deleteJourneyVideos(_ call: CAPPluginCall) {
        guard let id = call.getString("journeyId"), !id.isEmpty, id.count <= 200 else {
            call.reject("삭제할 탐험 기록을 확인해 주세요.", "INVALID_JOURNEY")
            return
        }
        removeVideoFiles(call, journeyId: id)
    }

    @objc public func clearVideos(_ call: CAPPluginCall) {
        removeVideoFiles(call, journeyId: nil)
    }

    private func removeVideoFiles(_ call: CAPPluginCall, journeyId: String?) {
        DispatchQueue.main.async {
            guard !self.renderInProgress && !self.videoFileOperationInProgress else {
                call.reject("영상 생성이나 저장이 끝난 뒤 기록을 삭제해 주세요.", "VIDEO_BUSY")
                return
            }
            self.videoFileOperationInProgress = true
            self.videoQueue.async {
                do {
                    try JourneyVideoRenderer.deleteVideos(journeyId: journeyId)
                    DispatchQueue.main.async {
                        self.videoFileOperationInProgress = false
                        call.resolve()
                    }
                } catch {
                    DispatchQueue.main.async {
                        self.videoFileOperationInProgress = false
                        call.reject("기기의 영상 캐시를 지우지 못했습니다. 잠시 후 다시 시도해 주세요.", "VIDEO_DELETE_FAILED")
                    }
                }
            }
        }
    }
}

private struct JourneyVideoError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
}

private struct VideoRoutePoint {
    let point: CGPoint
    let segment: Int
    let timestamp: Double
}

private struct VideoPhoto {
    let id: String
    let timestamp: Double
    let data: Data
    let location: CGPoint?
}

/// An offline 720x1280 H.264 renderer. No remote media, audio or hidden uploads.
final class JourneyVideoRenderer {
    static var outputDirectory: URL {
        FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("JourneyVideos", isDirectory: true)
    }
    private let width = 720
    private let height = 1280
    private let fps: Int32 = 24
    private let title: String
    private let journeyId: String
    private let dateLabel: String
    private let statsLabel: String
    private let route: [VideoRoutePoint]
    private let photos: [VideoPhoto]
    private let mapImage: UIImage?
    private let videoDuration: Double
    private var cachedPhotoIndex: Int?
    private var cachedPhoto: UIImage?

    init(options: JSObject) throws {
        if let id = options["journeyId"] as? String {
            guard !id.isEmpty, id.count <= 200 else { throw JourneyVideoError(message: "영상의 탐험 기록 식별자를 확인해 주세요.") }
            journeyId = id
        } else {
            // Older callers can still render; all such files belong to the legacy
            // cache group and are removed by the explicit clear-all operation.
            journeyId = "legacy"
        }
        title = String((options["title"] as? String ?? "반구천 탐험 기록").prefix(80))
        guard let startedAt = Self.number(options["startedAt"]), startedAt >= 0,
              let distance = Self.number(options["distanceMeters"]), distance >= 0,
              let duration = Self.number(options["durationSeconds"]), duration >= 0,
              let rawPoints = options["points"] as? [JSObject], rawPoints.count <= 60_000,
              let rawPhotos = options["photos"] as? [JSObject] else {
            throw JourneyVideoError(message: "영상에 넣을 탐험 기록을 확인해 주세요.")
        }
        guard rawPhotos.count <= 60 else {
            throw JourneyVideoError(message: "한 영상에는 사진을 최대 60장 넣을 수 있습니다. 사진을 나누어 영상을 만들어 주세요.")
        }
        guard !rawPoints.isEmpty || !rawPhotos.isEmpty else {
            throw JourneyVideoError(message: "이동 경로나 사진을 기록한 후 영상을 만들어 주세요.")
        }
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "ko_KR")
        formatter.dateFormat = "yyyy년 M월 d일"
        dateLabel = formatter.string(from: Date(timeIntervalSince1970: startedAt / 1_000))
        let minutes = Int(min(duration / 60, 99_999))
        statsLabel = String(format: "%.2f km  ·  %d시간 %d분  ·  사진 %d장", min(distance / 1_000, 99_999), minutes / 60, minutes % 60, rawPhotos.count)
        let coordinates = try rawPoints.map { item -> (lat: Double, lng: Double, timestamp: Double, segment: Int) in
            guard let lat = Self.number(item["lat"]), let lng = Self.number(item["lng"]),
                  (-90...90).contains(lat), (-180...180).contains(lng),
                  let timestamp = Self.number(item["timestamp"]),
                  let segment = Self.integer(item["segment"]) else {
                throw JourneyVideoError(message: "이동 경로 좌표를 읽지 못했습니다. 기록을 다시 열어 주세요.")
            }
            return (lat, lng, timestamp, segment)
        }
        let snapshot = options["mapSnapshot"] as? JSObject
        var normalizedPoints: [CGPoint] = []
        var snapshotSegments: [Int] = []
        var photoPositions: [String: CGPoint] = [:]
        if let snapshot {
            let imageData = try Self.imageData(snapshot["dataUrl"], maximumBytes: 16_000_000)
            guard let image = Self.thumbnail(imageData, maxPixel: 1600),
                  let points = snapshot["points"] as? [JSObject], points.count == coordinates.count else {
                throw JourneyVideoError(message: "지도 이미지를 경로와 맞추지 못했습니다. 영상을 다시 만들어 주세요.")
            }
            mapImage = image
            normalizedPoints = try points.map {
                guard let x = Self.number($0["x"]), let y = Self.number($0["y"]),
                      let segment = Self.integer($0["segment"]), abs(x) < 100_000, abs(y) < 100_000 else {
                    throw JourneyVideoError(message: "지도 위 경로 위치를 읽지 못했습니다. 다시 시도해 주세요.")
                }
                snapshotSegments.append(segment)
                return CGPoint(x: x, y: y)
            }
            for item in snapshot["photos"] as? [JSObject] ?? [] {
                if let id = item["id"] as? String, let x = Self.number(item["x"]), let y = Self.number(item["y"]),
                   abs(x) < 100_000, abs(y) < 100_000 { photoPositions[id] = CGPoint(x: x, y: y) }
            }
        } else {
            mapImage = nil
            // A local coordinate diagram, explicitly labeled separately from a map.
            let allLat = coordinates.map { $0.lat } + rawPhotos.compactMap { Self.number($0["lat"]) }
            let allLng = coordinates.map { $0.lng } + rawPhotos.compactMap { Self.number($0["lng"]) }
            let minLat = allLat.min() ?? 0, maxLat = allLat.max() ?? 0
            let minLng = allLng.min() ?? 0, maxLng = allLng.max() ?? 0
            let cosine = max(0.01, cos((minLat + maxLat) * .pi / 360))
            let span = max(0.0002, max(maxLat - minLat, (maxLng - minLng) * cosine))
            func normalize(_ lat: Double, _ lng: Double) -> CGPoint {
                CGPoint(x: 0.5 + (lng - (minLng + maxLng) / 2) * cosine / span * 0.80,
                        y: 0.5 - (lat - (minLat + maxLat) / 2) / span * 0.80)
            }
            normalizedPoints = coordinates.map { normalize($0.lat, $0.lng) }
            for item in rawPhotos {
                if let id = item["id"] as? String, let lat = Self.number(item["lat"]), let lng = Self.number(item["lng"]),
                   (-90...90).contains(lat), (-180...180).contains(lng) { photoPositions[id] = normalize(lat, lng) }
            }
        }
        var renderedSegment = 0
        route = coordinates.indices.map { index in
            let current = coordinates[index]
            if index > 0 {
                let previous = coordinates[index - 1]
                if current.segment != previous.segment || current.timestamp <= previous.timestamp ||
                    current.timestamp - previous.timestamp > 120_000 ||
                    (!snapshotSegments.isEmpty && snapshotSegments[index] != snapshotSegments[index - 1]) {
                    renderedSegment += 1
                }
            }
            return VideoRoutePoint(point: normalizedPoints[index], segment: renderedSegment, timestamp: current.timestamp)
        }
        var imageBytes = 0
        photos = try rawPhotos.map { item in
            guard let id = item["id"] as? String, let timestamp = Self.number(item["timestamp"]) else {
                throw JourneyVideoError(message: "사진 기록을 읽지 못했습니다. 사진을 다시 첨부해 주세요.")
            }
            let data = try Self.imageData(item["dataUrl"], maximumBytes: 12_000_000)
            imageBytes += data.count
            guard imageBytes <= 96_000_000 else {
                throw JourneyVideoError(message: "사진 용량이 커서 영상을 만들 수 없습니다. 사진 수나 해상도를 줄여 주세요.")
            }
            guard Self.thumbnail(data, maxPixel: 32) != nil else {
                throw JourneyVideoError(message: "읽을 수 없는 사진이 있습니다. 해당 사진을 다시 첨부해 주세요.")
            }
            return VideoPhoto(id: id, timestamp: timestamp, data: data, location: photoPositions[id])
        }.sorted { $0.timestamp < $1.timestamp }
        videoDuration = min(45, max(20, 14 + Double(photos.count) * 1.4))
    }

    func render(on queue: DispatchQueue, completion: @escaping (Result<URL, Error>) -> Void) {
        var outputURL: URL?
        do {
            try FileManager.default.createDirectory(at: Self.outputDirectory, withIntermediateDirectories: true)
            let url = Self.outputDirectory.appendingPathComponent(Self.filePrefix(journeyId) + UUID().uuidString + ".mp4")
            outputURL = url
            let writer = try AVAssetWriter(outputURL: url, fileType: .mp4)
            writer.shouldOptimizeForNetworkUse = true
            let input = AVAssetWriterInput(mediaType: .video, outputSettings: [
                AVVideoCodecKey: AVVideoCodecType.h264, AVVideoWidthKey: width, AVVideoHeightKey: height,
                AVVideoCompressionPropertiesKey: [AVVideoAverageBitRateKey: 4_000_000,
                                                  AVVideoProfileLevelKey: AVVideoProfileLevelH264HighAutoLevel]
            ])
            input.expectsMediaDataInRealTime = false
            guard writer.canAdd(input) else { throw JourneyVideoError(message: "이 기기에서 영상 인코더를 준비하지 못했습니다.") }
            writer.add(input)
            let adaptor = AVAssetWriterInputPixelBufferAdaptor(assetWriterInput: input, sourcePixelBufferAttributes: [
                kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA,
                kCVPixelBufferWidthKey as String: width, kCVPixelBufferHeightKey as String: height,
                kCVPixelBufferCGImageCompatibilityKey as String: true,
                kCVPixelBufferCGBitmapContextCompatibilityKey as String: true
            ])
            guard writer.startWriting() else { throw JourneyVideoError(message: "영상 파일을 만들지 못했습니다. 저장 공간을 확인해 주세요.") }
            writer.startSession(atSourceTime: .zero)
            let totalFrames = Int(videoDuration * Double(fps))
            var frame = 0
            var finished = false
            let started = Date()
            let timeout = DispatchSource.makeTimerSource(queue: queue)
            timeout.schedule(deadline: .now() + 240)
            timeout.setEventHandler {
                guard !finished else { return }
                finished = true
                writer.cancelWriting()
                try? FileManager.default.removeItem(at: url)
                timeout.setEventHandler {}
                timeout.cancel()
                completion(.failure(JourneyVideoError(message: "영상 생성이 멈춰 중단했습니다. 사진 수를 줄이고 다시 시도해 주세요.")))
            }
            timeout.resume()
            input.requestMediaDataWhenReady(on: queue) { [self] in
                guard !finished else { return }
                while input.isReadyForMoreMediaData && frame < totalFrames {
                    do {
                        guard Date().timeIntervalSince(started) < 240 else {
                            throw JourneyVideoError(message: "영상 생성 시간이 길어 중단했습니다. 사진 수를 줄이고 다시 시도해 주세요.")
                        }
                        try autoreleasepool {
                            let buffer = try pixelBuffer(pool: adaptor.pixelBufferPool, time: Double(frame) / Double(fps))
                            guard adaptor.append(buffer, withPresentationTime: CMTime(value: Int64(frame), timescale: fps)) else {
                                throw JourneyVideoError(message: "영상 프레임을 저장하지 못했습니다. 저장 공간을 확인하고 다시 시도해 주세요.")
                            }
                        }
                        frame += 1
                    } catch {
                        finished = true
                        timeout.setEventHandler {}
                        timeout.cancel()
                        input.markAsFinished()
                        writer.cancelWriting()
                        try? FileManager.default.removeItem(at: url)
                        completion(.failure(error))
                        return
                    }
                }
                if frame == totalFrames {
                    finished = true
                    timeout.setEventHandler {}
                    timeout.cancel()
                    input.markAsFinished()
                    writer.endSession(atSourceTime: CMTime(value: Int64(totalFrames), timescale: fps))
                    writer.finishWriting {
                        guard writer.status == .completed else {
                            try? FileManager.default.removeItem(at: url)
                            completion(.failure(JourneyVideoError(message: "영상 파일을 완성하지 못했습니다. 다시 시도해 주세요.")))
                            return
                        }
                        let asset = AVURLAsset(url: url)
                        Task {
                            do {
                                let duration = try await asset.load(.duration)
                                let tracks = try await asset.loadTracks(withMediaType: .video)
                                guard duration.seconds > 0, !tracks.isEmpty else {
                                    throw JourneyVideoError(message: "생성한 영상의 재생 정보를 확인하지 못했습니다. 다시 시도해 주세요.")
                                }
                                completion(.success(url))
                            } catch {
                                try? FileManager.default.removeItem(at: url)
                                completion(.failure(error))
                            }
                        }
                    }
                } else if writer.status == .failed || writer.status == .cancelled {
                    finished = true
                    timeout.setEventHandler {}
                    timeout.cancel()
                    try? FileManager.default.removeItem(at: url)
                    completion(.failure(JourneyVideoError(message: "영상 생성이 중단되었습니다. 다시 시도해 주세요.")))
                }
            }
        } catch {
            if let outputURL { try? FileManager.default.removeItem(at: outputURL) }
            completion(.failure(error))
        }
    }

    private func pixelBuffer(pool: CVPixelBufferPool?, time: Double) throws -> CVPixelBuffer {
        guard let pool else { throw JourneyVideoError(message: "영상 메모리를 준비하지 못했습니다. 앱을 다시 열어 주세요.") }
        var optionalBuffer: CVPixelBuffer?
        guard CVPixelBufferPoolCreatePixelBuffer(nil, pool, &optionalBuffer) == kCVReturnSuccess,
              let buffer = optionalBuffer else { throw JourneyVideoError(message: "영상 메모리가 부족합니다. 사진 수를 줄여 주세요.") }
        CVPixelBufferLockBaseAddress(buffer, [])
        defer { CVPixelBufferUnlockBaseAddress(buffer, []) }
        guard let context = CGContext(data: CVPixelBufferGetBaseAddress(buffer), width: width, height: height,
                                      bitsPerComponent: 8, bytesPerRow: CVPixelBufferGetBytesPerRow(buffer),
                                      space: CGColorSpaceCreateDeviceRGB(),
                                      bitmapInfo: CGBitmapInfo.byteOrder32Little.rawValue | CGImageAlphaInfo.premultipliedFirst.rawValue) else {
            throw JourneyVideoError(message: "영상 화면을 준비하지 못했습니다.")
        }
        context.translateBy(x: 0, y: CGFloat(height))
        context.scaleBy(x: 1, y: -1)
        UIGraphicsPushContext(context)
        defer { UIGraphicsPopContext() }
        drawFrame(time: time, context: context)
        return buffer
    }

    private func drawFrame(time: Double, context: CGContext) {
        UIColor(red: 0.97, green: 0.97, blue: 0.93, alpha: 1).setFill()
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
        text(title, rect: CGRect(x: 40, y: 62, width: 640, height: 96), size: 36, weight: .bold)
        text(dateLabel, rect: CGRect(x: 40, y: 168, width: 640, height: 36), size: 22)
        text(statsLabel, rect: CGRect(x: 40, y: 213, width: 640, height: 35), size: 21)
        let routeDuration = photos.isEmpty ? videoDuration - 3 : 12.0
        let slideDuration = videoDuration - routeDuration - 2
        let inPhotos = !photos.isEmpty && time >= routeDuration && time < videoDuration - 2
        let photoIndex = inPhotos ? min(photos.count - 1, Int((time - routeDuration) / slideDuration * Double(photos.count))) : nil
        let mapBox = CGRect(x: 36, y: 278, width: 648, height: inPhotos ? 306 : 828)
        let progress = min(1, time / routeDuration)
        drawMap(in: mapBox, progress: progress, highlightedPhoto: photoIndex, context: context)
        if let photoIndex {
            let photo = photos[photoIndex]
            if cachedPhotoIndex != photoIndex {
                cachedPhotoIndex = photoIndex
                cachedPhoto = Self.thumbnail(photo.data, maxPixel: 1280)
            }
            let photoBox = CGRect(x: 36, y: 606, width: 648, height: 488)
            UIColor.white.setFill()
            UIBezierPath(roundedRect: photoBox, cornerRadius: 18).fill()
            if let image = cachedPhoto { image.draw(in: Self.aspectFit(image.size, in: photoBox.insetBy(dx: 8, dy: 8))) }
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "ko_KR")
            formatter.dateFormat = "HH:mm"
            let clock = formatter.string(from: Date(timeIntervalSince1970: photo.timestamp / 1000))
            text("사진 \(photoIndex + 1) / \(photos.count)  ·  \(clock)\(photo.location == nil ? "  ·  위치 미기록" : "")",
                 rect: CGRect(x: 40, y: 1120, width: 640, height: 42), size: 23, weight: .semibold)
        } else {
            text(time >= videoDuration - 2 ? "다시 만나는 나의 반구천" : "이동 경로",
                 rect: CGRect(x: 40, y: 1130, width: 640, height: 44), size: 25, weight: .semibold)
        }
        text("반구천 탐험지도", rect: CGRect(x: 40, y: 1208, width: 640, height: 30), size: 18)
    }

    private func drawMap(in box: CGRect, progress: Double, highlightedPhoto: Int?, context: CGContext) {
        UIColor.white.setFill()
        UIBezierPath(roundedRect: box, cornerRadius: 18).fill()
        let drawingRect: CGRect
        if let mapImage {
            drawingRect = Self.aspectFit(mapImage.size, in: box.insetBy(dx: 8, dy: 8))
            // Fit the whole snapshot; never crop the SDK logo or attribution.
            mapImage.draw(in: drawingRect)
        } else {
            drawingRect = box.insetBy(dx: 26, dy: 44)
            UIColor(red: 0.91, green: 0.94, blue: 0.88, alpha: 1).setFill()
            context.fill(drawingRect)
            context.setStrokeColor(UIColor.white.withAlphaComponent(0.65).cgColor)
            context.setLineWidth(1)
            for value in stride(from: CGFloat(0), through: drawingRect.width, by: 40) {
                context.move(to: CGPoint(x: drawingRect.minX + value, y: drawingRect.minY))
                context.addLine(to: CGPoint(x: drawingRect.minX + value, y: drawingRect.maxY))
            }
            for value in stride(from: CGFloat(0), through: drawingRect.height, by: 40) {
                context.move(to: CGPoint(x: drawingRect.minX, y: drawingRect.minY + value))
                context.addLine(to: CGPoint(x: drawingRect.maxX, y: drawingRect.minY + value))
            }
            context.strokePath()
            text("이동 경로 · 기록 좌표를 연결한 그림", rect: CGRect(x: box.minX + 18, y: box.minY + 10, width: box.width - 36, height: 30), size: 17)
        }
        func point(_ normalized: CGPoint) -> CGPoint {
            CGPoint(x: drawingRect.minX + normalized.x * drawingRect.width,
                    y: drawingRect.minY + normalized.y * drawingRect.height)
        }
        context.saveGState()
        context.clip(to: drawingRect)
        let count = min(route.count, max(1, Int(ceil(progress * Double(route.count)))))
        let path = UIBezierPath()
        for index in 0..<count {
            let position = point(route[index].point)
            if index == 0 || route[index].segment != route[index - 1].segment { path.move(to: position) }
            else { path.addLine(to: position) }
        }
        UIColor.white.withAlphaComponent(0.95).setStroke()
        path.lineWidth = 10
        path.lineCapStyle = .round
        path.lineJoinStyle = .round
        path.stroke()
        UIColor(red: 0.10, green: 0.43, blue: 0.33, alpha: 1).setStroke()
        path.lineWidth = 5
        path.stroke()
        if count > 0, !route.isEmpty {
            let location = point(route[count - 1].point)
            UIColor(red: 0.95, green: 0.64, blue: 0.22, alpha: 1).setFill()
            UIBezierPath(ovalIn: CGRect(x: location.x - 9, y: location.y - 9, width: 18, height: 18)).fill()
        }
        let currentTimestamp = count > 0 && !route.isEmpty ? route[count - 1].timestamp : Double.greatestFiniteMagnitude
        for (index, photo) in photos.enumerated() {
            guard let location = photo.location, photo.timestamp <= currentTimestamp || progress >= 1 else { continue }
            let position = point(location)
            let selected = highlightedPhoto == index
            (selected ? UIColor.systemOrange : UIColor.white).setFill()
            UIBezierPath(ovalIn: CGRect(x: position.x - 13, y: position.y - 13, width: 26, height: 26)).fill()
            text(String(index + 1), rect: CGRect(x: position.x - 12, y: position.y - 10, width: 24, height: 24), size: 14, weight: .bold, centered: true)
        }
        context.restoreGState()
        // The unmodified snapshot already contains the SDK's attribution. Do not
        // place a second footer over that image or cover its original logo.
    }

    private func text(_ value: String, rect: CGRect, size: CGFloat, weight: UIFont.Weight = .regular, centered: Bool = false) {
        let paragraph = NSMutableParagraphStyle()
        paragraph.lineBreakMode = .byTruncatingTail
        paragraph.alignment = centered ? .center : .left
        (value as NSString).draw(in: rect, withAttributes: [
            .font: UIFont.systemFont(ofSize: size, weight: weight),
            .foregroundColor: UIColor(red: 0.12, green: 0.24, blue: 0.19, alpha: 1), .paragraphStyle: paragraph
        ])
    }

    private static func aspectFit(_ size: CGSize, in box: CGRect) -> CGRect {
        let scale = min(box.width / max(1, size.width), box.height / max(1, size.height))
        let width = size.width * scale, height = size.height * scale
        return CGRect(x: box.midX - width / 2, y: box.midY - height / 2, width: width, height: height)
    }

    static func filePrefix(_ journeyId: String) -> String {
        let digest = SHA256.hash(data: Data(journeyId.utf8)).map { String(format: "%02x", $0) }.joined()
        return "journey-\(digest)-"
    }

    static func deleteVideos(journeyId: String?, directory: URL = outputDirectory) throws {
        let manager = FileManager.default
        guard manager.fileExists(atPath: directory.path) else { return }
        let prefix = journeyId.map(filePrefix)
        for url in try manager.contentsOfDirectory(at: directory, includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey]) {
            let name = url.lastPathComponent
            guard url.pathExtension == "mp4",
                  prefix.map({ name.hasPrefix($0) }) ?? (name.hasPrefix("journey-") || name.hasPrefix("bangucheon-")) else { continue }
            let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey])
            guard values.isRegularFile == true, values.isSymbolicLink != true else { continue }
            try manager.removeItem(at: url)
        }
    }

    private static func imageData(_ raw: JSValue?, maximumBytes: Int) throws -> Data {
        guard let dataURL = raw as? String, dataURL.hasPrefix("data:image/"),
              dataURL.utf8.count <= maximumBytes * 4 / 3 + 200,
              let comma = dataURL.firstIndex(of: ","), dataURL[..<comma].hasSuffix(";base64"),
              let data = Data(base64Encoded: String(dataURL[dataURL.index(after: comma)...])),
              !data.isEmpty, data.count <= maximumBytes else {
            throw JourneyVideoError(message: "사진 또는 지도 이미지 형식을 읽지 못했거나 용량이 큽니다. 사진을 다시 첨부하거나 해상도를 줄여 주세요.")
        }
        return data
    }

    private static func thumbnail(_ data: Data, maxPixel: Int) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil),
              let image = CGImageSourceCreateThumbnailAtIndex(source, 0, [
                kCGImageSourceCreateThumbnailFromImageAlways: true,
                kCGImageSourceCreateThumbnailWithTransform: true,
                kCGImageSourceThumbnailMaxPixelSize: maxPixel,
                kCGImageSourceShouldCacheImmediately: true
              ] as CFDictionary) else { return nil }
        return UIImage(cgImage: image)
    }

    private static func number(_ value: JSValue?) -> Double? {
        guard let value = value as? NSNumber, value.doubleValue.isFinite else { return nil }
        return value.doubleValue
    }

    private static func integer(_ value: JSValue?) -> Int? {
        guard let number = number(value), number >= 0, number <= 100_000, number.rounded() == number else { return nil }
        return Int(number)
    }
}
