import AVFoundation
import Capacitor
import CoreLocation
import UIKit
import XCTest
@testable import App

/// Uses only generated fixtures and a separate test simulator, never a saved journey.
final class JourneyNativeTests: XCTestCase {
    private func milliseconds(_ iso: String) -> Double {
        ISO8601DateFormatter().date(from: iso)!.timeIntervalSince1970 * 1_000
    }

    func testAutomaticDayUsesKoreaMidnightAndDoesNotCreateEmptyDays() throws {
        let before = milliseconds("2026-10-24T14:59:59Z")
        let after = milliseconds("2026-10-24T15:00:01Z")
        XCTAssertEqual(JourneyTimelineState.dayKey(before), "2026-10-24")
        XCTAssertEqual(JourneyTimelineState.dayKey(after), "2026-10-25")
        var state = JourneyTimelineState()
        state.enable(now: before)
        XCTAssertNil(state.current.journeyId, "Opt-in alone must not create an empty daily journey")
        state.ensureAutomaticJourney(now: before)
        let firstID = try XCTUnwrap(state.current.journeyId)
        state.current.points = [JourneyPoint(lat: 35.6, lng: 129.17, timestamp: before, accuracy: 5, segment: 0)]
        XCTAssertTrue(state.rollDay(now: after))
        XCTAssertNil(state.current.journeyId)
        XCTAssertEqual(state.archived.count, 1)
        XCTAssertEqual(state.archived[0].journeyId, firstID)
        XCTAssertEqual(state.archived[0].status, "idle")
        XCTAssertEqual(state.archived[0].endedAt, milliseconds("2026-10-24T15:00:00Z"))
        XCTAssertFalse(state.rollDay(now: after + 3 * 86_400_000))
        XCTAssertEqual(state.archived.count, 1, "Days without GPS or photos must not generate empty archives")
        state.ensureAutomaticJourney(now: after + 3 * 86_400_000)
        XCTAssertNotEqual(state.current.journeyId, firstID)
        XCTAssertEqual(state.current.dayKey, "2026-10-28")
    }

    func testAutomaticPhotoOnlyDaySurvivesRolloverAndAcknowledgementIsScoped() throws {
        let start = milliseconds("2026-10-24T01:00:00Z")
        var state = JourneyTimelineState()
        state.enable(now: start)
        state.ensureAutomaticJourney(now: start)
        let photoOnlyID = try XCTUnwrap(state.current.journeyId)
        state.rollDay(now: start + 86_400_000)
        XCTAssertEqual(state.archived.first?.journeyId, photoOnlyID)
        XCTAssertEqual(state.archived.first?.points.count, 0, "IDB owns the photos; native must retain even an empty GPS buffer")
        state.ensureAutomaticJourney(now: start + 86_400_000)
        let currentID = state.current.journeyId
        let encoded = try JSONEncoder().encode(state)
        var restored = try JSONDecoder().decode(JourneyTimelineState.self, from: encoded)
        restored.acknowledge(["unrelated", currentID!])
        XCTAssertEqual(restored.archived.count, 1)
        restored.acknowledge([photoOnlyID])
        XCTAssertTrue(restored.archived.isEmpty)
        XCTAssertEqual(restored.current.journeyId, currentID)
    }

    func testOptOutStopsResumePolicyAndSameDayOptInKeepsID() throws {
        let start = milliseconds("2026-10-24T01:00:00Z")
        var state = JourneyTimelineState()
        state.enable(now: start)
        state.ensureAutomaticJourney(now: start)
        let id = state.current.journeyId
        state.current.points = [JourneyPoint(lat: 35.6, lng: 129.17, timestamp: start, accuracy: 5, segment: 0)]
        state.disable()
        XCTAssertFalse(state.mayAutomaticallyResume(authorization: "always", foreground: true), "Late permission cannot override opt-out")
        XCTAssertFalse(state.mayAutomaticallyResume(authorization: "always", foreground: false))
        XCTAssertEqual(state.current.status, "paused")
        var restored = try JSONDecoder().decode(JourneyTimelineState.self, from: JSONEncoder().encode(state))
        restored.restore(consentGate: false, safetyHold: false)
        XCTAssertFalse(restored.automaticEnabled)
        restored.enable(now: start + 60_000)
        XCTAssertEqual(restored.current.journeyId, id)
        XCTAssertEqual(restored.current.points.count, 1)
        XCTAssertTrue(restored.archived.isEmpty)
    }

    func testAutomaticRecoveryRequiresConsentAndHonorsPersistentSafetyHold() throws {
        var state = JourneyTimelineState()
        state.enable(now: milliseconds("2026-10-24T01:00:00Z"))
        state.current.status = "recording"
        var restored = try JSONDecoder().decode(JourneyTimelineState.self, from: JSONEncoder().encode(state))
        restored.restore(consentGate: true, safetyHold: true)
        XCTAssertEqual(restored.current.status, "paused")
        XCTAssertFalse(restored.mayAutomaticallyResume(authorization: "always", foreground: true))
        restored.enable(now: milliseconds("2026-10-24T02:00:00Z"))
        XCTAssertTrue(restored.mayAutomaticallyResume(authorization: "always", foreground: false))
        XCTAssertFalse(restored.mayAutomaticallyResume(authorization: "whenInUse", foreground: false))
        XCTAssertTrue(restored.mayAutomaticallyResume(authorization: "whenInUse", foreground: true))
        XCTAssertFalse(restored.mayAutomaticallyResume(authorization: "denied", foreground: true))
        XCTAssertFalse(restored.mayAutomaticallyResume(authorization: "notDetermined", foreground: true))
        restored.restore(consentGate: false, safetyHold: false)
        XCTAssertFalse(restored.automaticEnabled, "Failed opt-out disk write must not resurrect an earlier consent envelope")
    }

    func testRolloverPreservesPermissionPauseAndSafetyErrorWithoutStartingGPS() {
        let start = milliseconds("2026-10-24T01:00:00Z")
        var state = JourneyTimelineState()
        state.enable(now: start)
        state.ensureAutomaticJourney(now: start)
        state.current.status = "paused"
        state.current.error = "위치 권한을 기다리는 중입니다."
        XCTAssertTrue(state.rollDay(now: start + 86_400_000))
        XCTAssertEqual(state.current.status, "paused")
        XCTAssertEqual(state.current.error, "위치 권한을 기다리는 중입니다.")
        state.ensureAutomaticJourney(now: start + 86_400_000)
        state.recoveryHold = true
        state.current.error = "저장 공간을 확인해 주세요."
        XCTAssertTrue(state.rollDay(now: start + 2 * 86_400_000))
        XCTAssertEqual(state.current.status, "paused")
        XCTAssertEqual(state.current.error, "저장 공간을 확인해 주세요.")
        XCTAssertFalse(state.mayAutomaticallyResume(authorization: "always", foreground: true))
    }

    func testManualMigrationDefaultsOffAndCompletedJourneyIsNeverAdopted() throws {
        let start = milliseconds("2026-10-24T01:00:00Z")
        let legacy = Data("{\"journeyId\":\"legacy-photo-only\",\"status\":\"idle\",\"points\":[],\"segment\":0}".utf8)
        var state = try JSONDecoder().decode(JourneyTimelineState.self, from: legacy)
        XCTAssertFalse(state.automaticEnabled)
        XCTAssertEqual(state.current.mode, "manual")
        state.enable(now: start)
        XCTAssertNil(state.current.journeyId)
        XCTAssertEqual(state.archived.first?.journeyId, "legacy-photo-only")
        state.ensureAutomaticJourney(now: start)
        XCTAssertNotEqual(state.current.journeyId, "legacy-photo-only")
    }

    func testOnlyUnfinishedTodayManualIsAdoptedWithoutChangingItsID() {
        let start = milliseconds("2026-10-24T01:00:00Z")
        var today = JourneyTimelineState()
        today.current = JourneyTrackingRecord(journeyId: "today", status: "paused", mode: "manual", startedAt: start)
        today.enable(now: start + 30_000)
        XCTAssertEqual(today.current.journeyId, "today")
        XCTAssertEqual(today.current.mode, "automatic")
        XCTAssertTrue(today.archived.isEmpty)
        var yesterday = JourneyTimelineState()
        yesterday.current = JourneyTrackingRecord(journeyId: "yesterday", status: "paused", mode: "manual", startedAt: start - 86_400_000)
        yesterday.enable(now: start)
        XCTAssertNil(yesterday.current.journeyId)
        XCTAssertEqual(yesterday.archived.first?.journeyId, "yesterday")
    }

    func testGPSFilterAcceptsRoadTravelButSeparatesLongGapAfterRestore() {
        let start = 1_700_000_000_000.0
        let previous = JourneyPoint(lat: 35.60, lng: 129.17, timestamp: start, accuracy: 5, segment: 0)
        var filter = JourneyLocationFilter()
        // Roughly 330m in 10s: legitimate road travel, rejected by the old walking-only limit.
        XCTAssertEqual(filter.segment(for: location(at: start + 10_000, lat: 35.603), previous: previous, currentSegment: 0, now: start + 10_000), 0)
        var restored = JourneyLocationFilter()
        XCTAssertEqual(restored.segment(for: location(at: start + 180_000, lat: 35.62), previous: previous, currentSegment: 0, now: start + 180_000), 1)
    }

    func testVideoCacheDeletionIsScopedToJourneyAndOwnedFiles() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let first = directory.appendingPathComponent(JourneyVideoRenderer.filePrefix("journey/../A") + "one.mp4")
        let second = directory.appendingPathComponent(JourneyVideoRenderer.filePrefix("journey-B") + "two.mp4")
        let unrelated = directory.appendingPathComponent("unrelated.mp4")
        let note = directory.appendingPathComponent("journey-note.txt")
        for url in [first, second, unrelated, note] { try Data([1, 2, 3]).write(to: url) }
        XCTAssertFalse(JourneyVideoRenderer.filePrefix("journey/../A").contains("/"))
        try JourneyVideoRenderer.deleteVideos(journeyId: "journey/../A", directory: directory)
        XCTAssertFalse(FileManager.default.fileExists(atPath: first.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: second.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: unrelated.path))
        try JourneyVideoRenderer.deleteVideos(journeyId: nil, directory: directory)
        XCTAssertFalse(FileManager.default.fileExists(atPath: second.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: unrelated.path))
        XCTAssertTrue(FileManager.default.fileExists(atPath: note.path))
    }

    func testGPSFilterRejectsNoiseStaleFixAndTeleport() {
        var filter = JourneyLocationFilter()
        let start = 1_700_000_000_000.0
        let previous = JourneyPoint(lat: 35.60, lng: 129.17, timestamp: start, accuracy: 5, segment: 0)
        XCTAssertEqual(filter.segment(for: location(at: start), previous: nil, currentSegment: 0, now: start), 0)
        XCTAssertNil(filter.segment(for: location(at: start + 1_000, accuracy: 51), previous: previous, currentSegment: 0, now: start + 1_000))
        XCTAssertNil(filter.segment(for: location(at: start + 1_000, accuracy: 0), previous: previous, currentSegment: 0, now: start + 1_000))
        XCTAssertNil(filter.segment(for: location(at: start - 31_000), previous: previous, currentSegment: 0, now: start))
        XCTAssertNil(filter.segment(for: location(at: start + 6_000), previous: previous, currentSegment: 0, now: start))
        XCTAssertNil(filter.segment(for: location(at: start), previous: previous, currentSegment: 0, now: start + 1_000))
        XCTAssertNil(filter.segment(for: location(at: start + 1_000, lat: 35.60001), previous: previous, currentSegment: 0, now: start + 1_000))
        XCTAssertNil(filter.segment(for: location(at: start + 2_000, lat: 35.62), previous: previous, currentSegment: 0, now: start + 2_000))
        XCTAssertEqual(filter.segment(for: location(at: start + 10_000, lat: 35.6002), previous: previous, currentSegment: 0, now: start + 10_000), 0)
    }

    func testGPSGapAndResumeStartNewSegments() {
        var filter = JourneyLocationFilter()
        let start = 1_700_000_000_000.0
        let previous = JourneyPoint(lat: 35.60, lng: 129.17, timestamp: start, accuracy: 5, segment: 2)
        XCTAssertEqual(filter.segment(for: location(at: start), previous: nil, currentSegment: 2, now: start), 2)
        XCTAssertEqual(filter.segment(for: location(at: start + 180_000, lat: 35.62), previous: previous, currentSegment: 2, now: start + 180_000), 3)
        var resumed = JourneyLocationFilter()
        XCTAssertEqual(resumed.segment(for: location(at: start + 1_000, lat: 35.62), previous: previous, currentSegment: 3, now: start + 1_000), 3)
    }

    private func location(at timestamp: Double, lat: Double = 35.60, accuracy: Double = 5) -> CLLocation {
        CLLocation(coordinate: CLLocationCoordinate2D(latitude: lat, longitude: 129.17), altitude: 0,
                   horizontalAccuracy: accuracy, verticalAccuracy: 10, timestamp: Date(timeIntervalSince1970: timestamp / 1_000))
    }

    func testRealMP4ContainsRouteAndActualPhoto() async throws {
        let renderer = try JourneyVideoRenderer(options: fixture(withMap: true))
        let url = try await render(renderer)
        defer { try? FileManager.default.removeItem(at: url) }
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration)
        XCTAssertEqual(duration.seconds, 20, accuracy: 1.0 / 24)
        let tracks = try await asset.loadTracks(withMediaType: .video)
        let track = try XCTUnwrap(tracks.first)
        let size = try await track.load(.naturalSize)
        XCTAssertEqual(size, CGSize(width: 720, height: 1280))
        let descriptions = try await track.load(.formatDescriptions)
        XCTAssertEqual(CMFormatDescriptionGetMediaSubType(try XCTUnwrap(descriptions.first)), kCMVideoCodecType_H264)
        let bytes = try Data(contentsOf: url)
        XCTAssertGreaterThan(bytes.count, 10_000)
        XCTAssertEqual(String(data: bytes[4..<8], encoding: .ascii), "ftyp")

        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        let mapFrame = try generator.copyCGImage(at: CMTime(seconds: 5, preferredTimescale: 24), actualTime: nil)
        XCTAssertEqual(mapFrame.width, 720)
        XCTAssertEqual(mapFrame.height, 1280)
        let photoFrame = try generator.copyCGImage(at: CMTime(seconds: 16, preferredTimescale: 24), actualTime: nil)
        let pixel = rgba(photoFrame, x: 360, y: 850)
        // The generated fixture is red. The exported video must contain the image,
        // not merely its title or timestamp, and decode into the expected frame.
        XCTAssertGreaterThan(pixel.0, 170)
        XCTAssertLessThan(pixel.1, 110)
        XCTAssertLessThan(pixel.2, 110)
    }

    func testRouteDiagramFallbackProducesPlayableMP4() async throws {
        var options = fixture(withMap: false)
        options["photos"] = [] as [JSObject]
        let url = try await render(JourneyVideoRenderer(options: options))
        defer { try? FileManager.default.removeItem(at: url) }
        let asset = AVURLAsset(url: url)
        let duration = try await asset.load(.duration)
        XCTAssertGreaterThanOrEqual(duration.seconds, 20)
        let generator = AVAssetImageGenerator(asset: asset)
        let image = try generator.copyCGImage(at: CMTime(seconds: 10, preferredTimescale: 24), actualTime: nil)
        XCTAssertEqual(image.width, 720)
        XCTAssertEqual(image.height, 1280)
    }

    func testGPSSilenceLeavesGapAndSnapshotBottomIsPreserved() async throws {
        var options = fixture(withMap: true)
        let start = 1_700_000_000_000.0
        options["photos"] = [] as [JSObject]
        options["points"] = [
            ["lat": 35.60, "lng": 129.17, "timestamp": start, "accuracy": 5, "segment": 0],
            ["lat": 35.604, "lng": 129.173, "timestamp": start + 180_000, "accuracy": 5, "segment": 0]
        ] as [JSObject]
        var snapshot = try XCTUnwrap(options["mapSnapshot"] as? JSObject)
        snapshot["points"] = [["x": 0.2, "y": 0.8, "segment": 0], ["x": 0.8, "y": 0.2, "segment": 0]] as [JSObject]
        snapshot["photos"] = [] as [JSObject]
        options["mapSnapshot"] = snapshot
        let url = try await render(JourneyVideoRenderer(options: options))
        defer { try? FileManager.default.removeItem(at: url) }
        let generator = AVAssetImageGenerator(asset: AVURLAsset(url: url))
        let image = try generator.copyCGImage(at: CMTime(seconds: 19, preferredTimescale: 24), actualTime: nil)
        let gap = rgba(image, x: 360, y: 692)
        XCTAssertGreaterThan(gap.0, 180, "A missing GPS interval must not become a route line")
        XCTAssertGreaterThan(gap.1, 180)
        let attributionArea = rgba(image, x: 360, y: 1080)
        XCTAssertLessThan(attributionArea.0, 100)
        XCTAssertLessThan(attributionArea.1, 100)
        XCTAssertGreaterThan(attributionArea.2, 170, "The snapshot's bottom attribution area must not be cropped")
    }

    func testRejectsTooManyPhotosAndInvalidCoordinates() throws {
        var options = fixture(withMap: false)
        let photo = try XCTUnwrap((options["photos"] as? [JSObject])?.first)
        options["photos"] = Array(repeating: photo, count: 61)
        XCTAssertThrowsError(try JourneyVideoRenderer(options: options)) { error in
            XCTAssertTrue(error.localizedDescription.contains("60"))
        }
        options = fixture(withMap: false)
        options["points"] = [["lat": 999, "lng": 129, "timestamp": 1000, "segment": 0] as JSObject]
        XCTAssertThrowsError(try JourneyVideoRenderer(options: options))
    }

    private func render(_ renderer: JourneyVideoRenderer) async throws -> URL {
        try await withCheckedThrowingContinuation { continuation in
            let queue = DispatchQueue(label: "journey.renderer.test")
            queue.async {
                renderer.render(on: queue) { continuation.resume(with: $0) }
            }
        }
    }

    private func fixture(withMap: Bool) -> JSObject {
        let start = 1_700_000_000_000.0
        let points: [JSObject] = [
            ["lat": 35.60, "lng": 129.17, "timestamp": start, "accuracy": 5, "segment": 0],
            ["lat": 35.601, "lng": 129.171, "timestamp": start + 60_000, "accuracy": 5, "segment": 0],
            ["lat": 35.603, "lng": 129.172, "timestamp": start + 180_000, "accuracy": 5, "segment": 1],
            ["lat": 35.604, "lng": 129.173, "timestamp": start + 240_000, "accuracy": 5, "segment": 1]
        ]
        let image = UIGraphicsImageRenderer(size: CGSize(width: 320, height: 240)).image { context in
            UIColor.red.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 320, height: 240))
        }
        var options: JSObject = [
            "journeyId": "synthetic-journey-test",
            "title": "검증용 탐험", "startedAt": start, "distanceMeters": 540, "durationSeconds": 240,
            "points": points,
            "photos": [["id": "fixture-photo", "timestamp": start + 60_000,
                        "lat": 35.601, "lng": 129.171,
                        "dataUrl": "data:image/png;base64," + image.pngData()!.base64EncodedString()] as JSObject]
        ]
        if withMap {
            let map = UIGraphicsImageRenderer(size: CGSize(width: 320, height: 640)).image { context in
                UIColor(white: 0.9, alpha: 1).setFill()
                context.fill(CGRect(x: 0, y: 0, width: 320, height: 640))
                UIColor.blue.setFill()
                context.fill(CGRect(x: 0, y: 600, width: 320, height: 40))
            }
            options["mapSnapshot"] = [
                "dataUrl": "data:image/png;base64," + map.pngData()!.base64EncodedString(),
                "points": [["x": 0.2, "y": 0.8, "segment": 0], ["x": 0.4, "y": 0.6, "segment": 0],
                           ["x": 0.6, "y": 0.4, "segment": 1], ["x": 0.8, "y": 0.2, "segment": 1]] as [JSObject],
                "photos": [["id": "fixture-photo", "x": 0.4, "y": 0.6] as JSObject]
            ] as JSObject
        }
        return options
    }

    private func rgba(_ image: CGImage, x: Int, y: Int) -> (Int, Int, Int, Int) {
        var bytes = [UInt8](repeating: 0, count: image.width * image.height * 4)
        let context = CGContext(data: &bytes, width: image.width, height: image.height, bitsPerComponent: 8,
                                bytesPerRow: image.width * 4, space: CGColorSpaceCreateDeviceRGB(),
                                bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
        context.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
        let index = (y * image.width + x) * 4
        return (Int(bytes[index]), Int(bytes[index + 1]), Int(bytes[index + 2]), Int(bytes[index + 3]))
    }
}
