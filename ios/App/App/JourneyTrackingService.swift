import CoreLocation
import UIKit

struct JourneyPoint: Codable {
    let lat: Double
    let lng: Double
    let timestamp: Double
    let accuracy: Double
    let segment: Int

    var json: [String: Any] {
        ["lat": lat, "lng": lng, "timestamp": timestamp, "accuracy": accuracy, "segment": segment]
    }
}

/// Matches the durable TypeScript filter, including road/rail travel and GPS gaps.
struct JourneyLocationFilter {
    private var latestReliableTimestamp: Double?
    private var lastObservedTimestamp: Double?

    mutating func segment(for location: CLLocation, previous: JourneyPoint?, currentSegment: Int, now: Double) -> Int? {
        let timestamp = location.timestamp.timeIntervalSince1970 * 1_000
        guard CLLocationCoordinate2DIsValid(location.coordinate),
              location.horizontalAccuracy.isFinite, location.horizontalAccuracy > 0,
              location.horizontalAccuracy <= 50,
              timestamp <= now + 5_000, timestamp >= now - 30_000,
              timestamp > (lastObservedTimestamp ?? previous?.timestamp ?? 0) else { return nil }
        lastObservedTimestamp = timestamp
        let lastReliable = latestReliableTimestamp ?? previous?.timestamp
        let longGap = lastReliable.map { timestamp - $0 > 120_000 } ?? false
        if let previous, previous.segment == currentSegment, !longGap {
            let radians = Double.pi / 180
            let dLat = (location.coordinate.latitude - previous.lat) * radians
            let dLng = (location.coordinate.longitude - previous.lng) * radians
            let term = pow(sin(dLat / 2), 2) + cos(previous.lat * radians) *
                cos(location.coordinate.latitude * radians) * pow(sin(dLng / 2), 2)
            let distance = 6_371_008.8 * 2 * atan2(sqrt(min(1, term)), sqrt(max(0, 1 - term)))
            let seconds = (timestamp - previous.timestamp) / 1_000
            guard distance <= max(75, seconds * 100 + location.horizontalAccuracy + previous.accuracy) else { return nil }
            latestReliableTimestamp = timestamp
            if distance < max(8, min(18, location.horizontalAccuracy * 0.35)) { return nil }
        }
        latestReliableTimestamp = timestamp
        return longGap ? currentSegment + 1 : currentSegment
    }
}

struct JourneyTrackingRecord: Codable {
    var journeyId: String?
    var status = "idle"
    var points: [JourneyPoint] = []
    var error: String?
    var segment = 0
    var mode: String?
    var dayKey: String?
    var startedAt: Double?
    var endedAt: Double?

    var json: [String: Any] {
        var result: [String: Any] = ["journeyId": journeyId as Any? ?? NSNull(),
                                    "status": status, "points": points.map { $0.json }]
        if let error { result["error"] = error }
        if let mode { result["mode"] = mode }
        if let dayKey { result["dayKey"] = dayKey }
        if let startedAt { result["startedAt"] = startedAt }
        result["endedAt"] = endedAt as Any? ?? NSNull()
        return result
    }
}

/// Pure persisted policy. No CLLocationManager, prompts, timers or WebView needed.
struct JourneyTimelineState: Codable {
    var version = 2
    var current = JourneyTrackingRecord()
    var archived: [JourneyTrackingRecord] = []
    var automaticEnabled = false
    // A storage failure or explicit safety pause must survive app restarts.
    var recoveryHold = false

    init() {}

    private enum CodingKeys: String, CodingKey { case version, current, archived, automaticEnabled, recoveryHold }
    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if container.contains(.current) {
            current = try container.decode(JourneyTrackingRecord.self, forKey: .current)
            archived = try container.decodeIfPresent([JourneyTrackingRecord].self, forKey: .archived) ?? []
            automaticEnabled = try container.decodeIfPresent(Bool.self, forKey: .automaticEnabled) ?? false
            recoveryHold = try container.decodeIfPresent(Bool.self, forKey: .recoveryHold) ?? false
        } else {
            // Version 1 was the manual recorder's flat tracking.json.
            current = try JourneyTrackingRecord(from: decoder)
            current.mode = "manual"
        }
    }

    static func calendar() -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Seoul")!
        return calendar
    }

    static func dayKey(_ timestamp: Double) -> String {
        let parts = calendar().dateComponents([.year, .month, .day], from: Date(timeIntervalSince1970: timestamp / 1_000))
        return String(format: "%04d-%02d-%02d", parts.year!, parts.month!, parts.day!)
    }

    mutating func restore(consentGate: Bool, safetyHold: Bool) {
        automaticEnabled = automaticEnabled && consentGate
        recoveryHold = recoveryHold || safetyHold
        if current.status == "recording" { current.status = "paused" }
        if !automaticEnabled && current.mode == "automatic" { current.status = "paused" }
    }

    func mayAutomaticallyResume(authorization: String, foreground: Bool) -> Bool {
        automaticEnabled && !recoveryHold &&
            (authorization == "always" || (authorization == "whenInUse" && foreground))
    }

    mutating func enable(now: Double) {
        automaticEnabled = true
        recoveryHold = false
        current.error = nil
        if current.journeyId != nil {
            let existingDay = current.dayKey ?? current.startedAt.map(Self.dayKey) ?? current.points.first.map { Self.dayKey($0.timestamp) }
            if current.status == "idle" || (existingDay != nil && existingDay != Self.dayKey(now)) {
                archiveCurrent(now: now)
            } else {
                current.mode = "automatic"
                current.dayKey = Self.dayKey(now)
                current.startedAt = current.startedAt ?? current.points.first?.timestamp ?? now
            }
        }
        current.mode = "automatic"
        current.status = "paused"
        current.endedAt = nil
    }

    mutating func disable() {
        automaticEnabled = false
        current.status = current.journeyId == nil ? "idle" : "paused"
        current.error = nil
    }

    /// Date closure is persisted together with the new current buffer. It does not
    /// create an empty day; a valid fix or explicit photo action does that later.
    @discardableResult mutating func rollDay(now: Double) -> Bool {
        guard automaticEnabled, current.journeyId != nil,
              let key = current.dayKey, key != Self.dayKey(now) else { return false }
        let status = current.status
        let error = current.error
        archiveCurrent(now: now)
        current.mode = "automatic"
        current.status = recoveryHold ? "paused" : status
        current.error = error
        return true
    }

    mutating func ensureAutomaticJourney(now: Double) {
        guard automaticEnabled else { return }
        rollDay(now: now)
        guard current.journeyId == nil else { return }
        current.journeyId = "automatic-\(Self.dayKey(now))-\(UUID().uuidString)"
        current.mode = "automatic"
        current.dayKey = Self.dayKey(now)
        current.startedAt = now
        current.endedAt = nil
    }

    mutating func archiveCurrent(now: Double) {
        guard current.journeyId != nil else { return }
        var closed = current
        closed.status = "idle"
        closed.error = nil
        closed.mode = current.mode ?? "manual"
        closed.startedAt = current.startedAt ?? current.points.first?.timestamp ?? now
        var end = current.endedAt ?? now
        if let key = current.dayKey, key != Self.dayKey(now), let start = closed.startedAt {
            let nextDay = Self.calendar().date(byAdding: .day, value: 1,
                to: Self.calendar().startOfDay(for: Date(timeIntervalSince1970: start / 1_000)))!
            end = min(end, nextDay.timeIntervalSince1970 * 1_000)
        }
        closed.endedAt = max(closed.startedAt!, current.points.last?.timestamp ?? 0, end)
        archived.removeAll { $0.journeyId == closed.journeyId }
        archived.append(closed)
        current = JourneyTrackingRecord()
    }

    mutating func acknowledge(_ ids: Set<String>) {
        archived.removeAll { $0.journeyId.map(ids.contains) ?? false }
    }

    func json(authorization: String) -> [String: Any] {
        var result = current.json
        result["automatic"] = ["enabled": automaticEnabled, "authorization": authorization]
        result["archived"] = archived.map { $0.json }
        return result
    }
}

/// AppDelegate owns the lifetime, including Core Location background relaunch.
/// The Capacitor plugin is only an observer/command adapter for this service.
final class JourneyTrackingService: NSObject, CLLocationManagerDelegate {
    static let shared = JourneyTrackingService()
    typealias Completion = (Result<[String: Any], Error>) -> Void

    private let standard = CLLocationManager()
    private let significant = CLLocationManager()
    private let storageQueue = DispatchQueue(label: "kr.bangucheon.journey.storage")
    private var timeline = JourneyTimelineState()
    private var filter = JourneyLocationFilter()
    private var observers: [UUID: ([String: Any]) -> Void] = [:]
    private var bootstrapped = false
    private var standardRunning = false
    private var significantRunning = false
    private var pendingForegroundAuthorization = false
    private var manualStartRequested = false
    private var settingRevision = 0
    private var storageRevision = 0
    private var foregroundObserver: NSObjectProtocol?
    private let consentKey = "JourneyAutomaticConsent.v2"
    private let holdKey = "JourneyAutomaticSafetyHold.v2"
    private let defaults = UserDefaults.standard

    private var now: Double { Date().timeIntervalSince1970 * 1_000 }
    private var foreground: Bool { UIApplication.shared.applicationState != .background }
    private var storageURL: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("JourneyNative", isDirectory: true).appendingPathComponent("tracking.json")
    }

    var authorization: String {
        switch standard.authorizationStatus {
        case .notDetermined: return "notDetermined"
        case .authorizedWhenInUse: return "whenInUse"
        case .authorizedAlways: return "always"
        case .denied: return "denied"
        case .restricted: return "restricted"
        @unknown default: return "restricted"
        }
    }

    func bootstrap(locationWake: Bool = false) {
        guard !bootstrapped else { return }
        bootstrapped = true
        if FileManager.default.fileExists(atPath: storageURL.path) {
            do {
                timeline = try JSONDecoder().decode(JourneyTimelineState.self, from: Data(contentsOf: storageURL))
                timeline.restore(consentGate: defaults.bool(forKey: consentKey), safetyHold: defaults.bool(forKey: holdKey))
                // An earlier build persisted this informational migration notice
                // in the error field. Clear only that exact notice, not real errors.
                if timeline.current.error == "이전 수동 기록을 보관했습니다. 자동 기록을 켜면 오늘의 기록을 이어갑니다." {
                    timeline.current.error = nil
                }
            } catch {
                timeline = JourneyTimelineState()
                defaults.set(false, forKey: consentKey)
                timeline.current.error = "기기의 이동 기록 버퍼를 읽지 못했습니다. 저장된 기록을 확인한 뒤 자동 기록을 켜 주세요."
            }
        }
        standard.delegate = self
        significant.delegate = self
        standard.showsBackgroundLocationIndicator = true
        if !timeline.automaticEnabled || timeline.recoveryHold {
            // Significant monitoring registrations survive process termination.
            // Revoke an older registration even before this instance started one.
            stopAll()
        }
        foregroundObserver = NotificationCenter.default.addObserver(forName: UIApplication.didBecomeActiveNotification,
                                                                     object: nil, queue: .main) { [weak self] _ in
            self?.reconcile()
        }
        // No permission request here, even when Core Location launched the app.
        reconcile(allowBackground: locationWake)
    }

    func observe(_ observer: @escaping ([String: Any]) -> Void) -> UUID {
        bootstrap()
        let id = UUID()
        observers[id] = observer
        return id
    }

    func removeObserver(_ id: UUID) { observers.removeValue(forKey: id) }

    func getState() -> [String: Any] {
        bootstrap()
        if timeline.rollDay(now: now) { filter = JourneyLocationFilter(); persist() }
        refreshAvailabilityMessage()
        return timeline.json(authorization: authorization)
    }

    func setAutomatic(_ enabled: Bool, completion: @escaping Completion) {
        bootstrap()
        settingRevision += 1
        let revision = settingRevision
        pendingForegroundAuthorization = false
        manualStartRequested = false
        if !enabled {
            // Consent is revoked before asynchronous I/O; a late permission or
            // old write callback can never restart either location service.
            defaults.set(false, forKey: consentKey)
            stopAll()
            timeline.disable()
            persist(completion: completion)
            return
        }
        guard foreground else { completion(.failure(failure("앱 화면에서 자동 기록을 켜 주세요."))); return }
        stopAll()
        timeline.enable(now: now)
        filter = JourneyLocationFilter()
        persist { result in
            guard revision == self.settingRevision, self.timeline.automaticEnabled else {
                completion(.success(self.getState())); return
            }
            guard case .success = result else { completion(result); return }
            self.defaults.set(true, forKey: self.consentKey)
            self.defaults.set(false, forKey: self.holdKey)
            if self.authorization == "notDetermined" {
                self.pendingForegroundAuthorization = true
                self.timeline.current.error = "이동 경로를 기록하려면 위치 접근을 허용해 주세요."
                self.standard.requestWhenInUseAuthorization()
            } else {
                self.reconcile()
            }
            completion(.success(self.getState()))
        }
    }

    func requestBackgroundAuthorization() -> [String: Any] {
        bootstrap()
        guard timeline.automaticEnabled, foreground else { return getState() }
        if authorization == "whenInUse" {
            // Keeping When In Use produces no authorization delegate callback.
            // Return immediately and re-read on foreground/delegate notification.
            standard.requestAlwaysAuthorization()
        }
        return getState()
    }

    func ensureAutomaticJourney(completion: @escaping Completion) {
        bootstrap()
        guard timeline.automaticEnabled else {
            completion(.failure(failure("자동 기록을 켠 뒤 오늘의 사진을 추가해 주세요."))); return
        }
        timeline.ensureAutomaticJourney(now: now)
        persist(completion: completion)
    }

    func acknowledgeArchived(_ ids: [String], completion: @escaping Completion) {
        bootstrap()
        let oldArchives = timeline.archived
        timeline.acknowledge(Set(ids))
        persist { result in
            if case .failure = result {
                // JS may safely acknowledge again; never lose an uncommitted archive.
                for record in oldArchives where !self.timeline.archived.contains(where: { $0.journeyId == record.journeyId }) {
                    self.timeline.archived.append(record)
                }
            }
            completion(result)
        }
    }

    func startManual(_ id: String, completion: @escaping Completion) {
        bootstrap()
        guard !id.isEmpty, id.count <= 200 else { completion(.failure(failure("탐험 기록 식별자를 확인해 주세요."))); return }
        if timeline.current.journeyId == id { completion(.success(getState())); return }
        guard !timeline.automaticEnabled, timeline.current.status == "idle" else {
            completion(.failure(failure("진행 중인 기록을 먼저 확인해 주세요."))); return
        }
        timeline.archiveCurrent(now: now)
        timeline.current = JourneyTrackingRecord(journeyId: id, status: "paused", mode: "manual", startedAt: now)
        resume(completion: completion)
    }

    func pause(completion: @escaping Completion) {
        settingRevision += 1
        pendingForegroundAuthorization = false
        manualStartRequested = false
        stopAll()
        timeline.recoveryHold = true
        defaults.set(true, forKey: holdKey)
        timeline.current.status = timeline.current.journeyId == nil && !timeline.automaticEnabled ? "idle" : "paused"
        timeline.current.error = "기록을 일시 정지했습니다. 다시 켜기 또는 재개를 눌러 주세요."
        persist(completion: completion)
    }

    func resume(completion: @escaping Completion) {
        if timeline.automaticEnabled { setAutomatic(true, completion: completion); return }
        guard foreground, timeline.current.journeyId != nil, timeline.current.status != "idle" else {
            completion(.failure(failure("앱 화면에서 다시 시작할 기록을 확인해 주세요."))); return
        }
        timeline.recoveryHold = false
        defaults.set(false, forKey: holdKey)
        manualStartRequested = true
        if authorization == "notDetermined" {
            pendingForegroundAuthorization = true
            standard.requestWhenInUseAuthorization()
        } else { activateIfAllowed() }
        persist(completion: completion)
    }

    func stop(completion: @escaping Completion) {
        settingRevision += 1
        defaults.set(false, forKey: consentKey)
        stopAll()
        pendingForegroundAuthorization = false
        manualStartRequested = false
        timeline.automaticEnabled = false
        timeline.current.status = "idle"
        timeline.current.endedAt = now
        timeline.current.error = nil
        persist(completion: completion)
    }

    func clear(completion: @escaping Completion) {
        settingRevision += 1
        defaults.set(false, forKey: consentKey)
        defaults.set(false, forKey: holdKey)
        stopAll()
        pendingForegroundAuthorization = false
        manualStartRequested = false
        timeline = JourneyTimelineState()
        filter = JourneyLocationFilter()
        persist(completion: completion)
    }

    private func reconcile(allowBackground: Bool = false) {
        guard bootstrapped else { return }
        if timeline.rollDay(now: now) { filter = JourneyLocationFilter() }
        if timeline.mayAutomaticallyResume(authorization: authorization, foreground: foreground || pendingForegroundAuthorization) {
            // A background relaunch requires Always. Standard GPS alone cannot
            // relaunch an app that iOS terminated; significant changes can.
            if foreground || allowBackground || authorization == "always" { activateIfAllowed() }
        } else if timeline.automaticEnabled && (authorization == "denied" || authorization == "restricted" || authorization == "notDetermined") {
            stopAll()
            timeline.current.status = "paused"
        }
        configureSignificantMonitoring()
        refreshAvailabilityMessage()
        persist()
    }

    private func activateIfAllowed() {
        let granted = authorization == "always" || authorization == "whenInUse"
        guard granted, CLLocationManager.locationServicesEnabled(), !timeline.recoveryHold,
              timeline.automaticEnabled || manualStartRequested else {
            timeline.current.status = "paused"
            refreshAvailabilityMessage()
            return
        }
        guard foreground || pendingForegroundAuthorization || authorization == "always" || standardRunning else { return }
        if !standardRunning {
            if let last = timeline.current.points.last { timeline.current.segment = last.segment + 1 }
            filter = JourneyLocationFilter()
            standard.desiredAccuracy = timeline.automaticEnabled ? kCLLocationAccuracyNearestTenMeters : kCLLocationAccuracyBest
            standard.distanceFilter = timeline.automaticEnabled ? 15 : 5
            standard.activityType = .other
            standard.pausesLocationUpdatesAutomatically = timeline.automaticEnabled
            standard.allowsBackgroundLocationUpdates = true
            standard.startUpdatingLocation()
            standardRunning = true
        }
        timeline.current.status = "recording"
        timeline.current.error = nil
        refreshAvailabilityMessage()
        configureSignificantMonitoring()
    }

    private func configureSignificantMonitoring() {
        let shouldRun = timeline.automaticEnabled && !timeline.recoveryHold && authorization == "always" &&
            CLLocationManager.significantLocationChangeMonitoringAvailable() && CLLocationManager.locationServicesEnabled()
        if shouldRun && !significantRunning {
            significant.startMonitoringSignificantLocationChanges()
            significantRunning = true
        } else if !shouldRun {
            significant.stopMonitoringSignificantLocationChanges()
            significantRunning = false
        }
    }

    private func stopAll() {
        standard.stopUpdatingLocation()
        standard.allowsBackgroundLocationUpdates = false
        significant.stopMonitoringSignificantLocationChanges()
        standardRunning = false
        significantRunning = false
    }

    private func refreshAvailabilityMessage() {
        guard timeline.automaticEnabled || manualStartRequested else { return }
        if timeline.recoveryHold { return }
        if !CLLocationManager.locationServicesEnabled() {
            timeline.current.error = "iPhone 설정에서 위치 서비스를 켜 주세요. 현재 이동 경로를 저장하지 못하고 있습니다."
        } else if authorization == "denied" || authorization == "restricted" {
            timeline.current.error = "위치 권한이 없어 경로를 저장하지 못하고 있습니다. 설정에서 위치 접근을 허용해 주세요."
        } else if authorization == "notDetermined" {
            timeline.current.error = "위치 권한을 기다리는 중입니다. 자동 기록을 다시 켜서 위치 접근을 허용해 주세요."
        } else if standard.accuracyAuthorization == .reducedAccuracy {
            timeline.current.error = "정확한 위치가 꺼져 경로를 저장하지 못할 수 있습니다. 설정에서 ‘정확한 위치’를 켜 주세요."
        } else if UIApplication.shared.backgroundRefreshStatus != .available && authorization == "always" {
            timeline.current.error = "백그라운드 앱 새로 고침이 꺼져 있어 앱 종료 후 자동 재개가 제한됩니다."
        }
    }

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        guard bootstrapped else { return }
        // Both CLLocationManagers can notify; never interpret that as fresh consent.
        if timeline.automaticEnabled || manualStartRequested {
            if authorization == "always" || authorization == "whenInUse" {
                if timeline.automaticEnabled { reconcile() }
                else if pendingForegroundAuthorization { activateIfAllowed(); persist() }
            } else {
                stopAll()
                timeline.current.status = "paused"
                refreshAvailabilityMessage()
                persist()
            }
        }
        if authorization != "notDetermined" { pendingForegroundAuthorization = false }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        if manager === significant {
            guard timeline.automaticEnabled, !timeline.recoveryHold, authorization == "always" else { return }
            // Significant-change coordinates are too coarse for a truthful path.
            reconcile(allowBackground: true)
            return
        }
        guard standardRunning, timeline.current.status == "recording",
              (timeline.automaticEnabled || manualStartRequested), !timeline.recoveryHold else { return }
        let timestampNow = now
        var changed = timeline.rollDay(now: timestampNow)
        if changed { filter = JourneyLocationFilter() }
        var inaccurate = false
        for location in locations {
            let timestamp = location.timestamp.timeIntervalSince1970 * 1_000
            if timeline.automaticEnabled && JourneyTimelineState.dayKey(timestamp) != JourneyTimelineState.dayKey(timestampNow) { continue }
            if location.horizontalAccuracy > 50 || location.horizontalAccuracy <= 0 { inaccurate = true }
            guard let segment = filter.segment(for: location, previous: timeline.current.points.last,
                                               currentSegment: timeline.current.segment, now: timestampNow) else { continue }
            if timeline.current.points.count >= 60_000 {
                holdForError("오늘의 경로 한도에 도달해 기록을 멈췄습니다. 저장된 기록을 확인하고 자동 기록을 다시 켜 주세요.")
                return
            }
            if timeline.automaticEnabled { timeline.ensureAutomaticJourney(now: timestamp) }
            timeline.current.segment = segment
            timeline.current.points.append(JourneyPoint(lat: location.coordinate.latitude, lng: location.coordinate.longitude,
                timestamp: timestamp, accuracy: location.horizontalAccuracy, segment: segment))
            timeline.current.error = nil
            changed = true
        }
        if inaccurate && !changed {
            timeline.current.error = "GPS 정확도가 낮아 경로를 저장하지 못하고 있습니다. 정확한 위치 설정과 하늘이 보이는 곳에서 다시 확인해 주세요."
            changed = true
        }
        if changed { refreshAvailabilityMessage(); persist() }
    }

    func locationManagerDidPauseLocationUpdates(_ manager: CLLocationManager) {
        guard manager === standard, timeline.automaticEnabled, !timeline.recoveryHold else { return }
        standard.stopUpdatingLocation()
        standardRunning = false
        timeline.current.status = "paused"
        timeline.current.error = authorization == "always"
            ? "이동이 없어 절전 중입니다. 큰 이동 신호나 앱을 다시 열면 상세 경로 기록을 재개합니다."
            : "이동이 없어 절전 중입니다. 앱을 다시 열면 기록을 재개합니다. 앱 밖 자동 재개에는 ‘항상’ 위치 권한이 필요합니다."
        persist()
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        guard timeline.automaticEnabled || manualStartRequested else { return }
        if (error as? CLError)?.code == .locationUnknown {
            timeline.current.error = "현재 GPS 위치를 찾는 중입니다. 하늘이 보이는 곳에서 잠시 기다려 주세요."
            persist()
        } else if (error as? CLError)?.code == .denied {
            stopAll()
            timeline.current.status = "paused"
            refreshAvailabilityMessage()
            persist()
        } else {
            holdForError("위치 확인이 중단되어 기록을 일시 정지했습니다. 설정을 확인한 뒤 자동 기록을 다시 켜 주세요.")
        }
    }

    private func holdForError(_ message: String) {
        stopAll()
        pendingForegroundAuthorization = false
        timeline.recoveryHold = true
        defaults.set(true, forKey: holdKey)
        timeline.current.status = "paused"
        timeline.current.error = message
        persist()
    }

    private func failure(_ message: String) -> NSError { NSError(domain: "JourneyTracking", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }

    private func emit() {
        // Background collection goes straight to disk; no suspended-WebView backlog.
        guard foreground else { return }
        let snapshot = timeline.json(authorization: authorization)
        for observer in observers.values { observer(snapshot) }
    }

    private func persist(completion: Completion? = nil) {
        let snapshot = timeline
        let url = storageURL
        storageRevision += 1
        let revision = storageRevision
        // Keep the app alive long enough to commit a background location callback.
        let task = UIApplication.shared.beginBackgroundTask(withName: "Journey buffer commit")
        storageQueue.async {
            let result: Result<Void, Error>
            do {
                try FileManager.default.createDirectory(at: url.deletingLastPathComponent(), withIntermediateDirectories: true)
                let data = try JSONEncoder().encode(snapshot)
                try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                result = .success(())
            } catch { result = .failure(error) }
            DispatchQueue.main.async {
                if task != .invalid { UIApplication.shared.endBackgroundTask(task) }
                switch result {
                case .success:
                    self.emit()
                    completion?(.success(self.timeline.json(authorization: self.authorization)))
                case .failure:
                    if revision == self.storageRevision {
                        self.stopAll()
                        self.pendingForegroundAuthorization = false
                        self.timeline.recoveryHold = true
                        self.defaults.set(true, forKey: self.holdKey)
                        self.timeline.current.status = "paused"
                        self.timeline.current.error = "기기에 경로를 저장하지 못해 기록을 멈췄습니다. 저장 공간을 확인한 뒤 자동 기록을 다시 켜 주세요."
                        self.emit()
                    }
                    completion?(.failure(self.failure("기기에 경로를 저장하지 못했습니다. 저장 공간을 확인한 뒤 다시 시도해 주세요.")))
                }
            }
        }
    }
}
