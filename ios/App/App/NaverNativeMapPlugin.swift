import UIKit
import WebKit
import Capacitor
import NMapsMap
import NMapsGeometry

/// A full-screen native map sits below the transparent web UI. Only touches
/// outside measured web controls are passed down by MapOverlayWebView.
@objc(NaverNativeMapPlugin)
public final class NaverNativeMapPlugin: CAPPlugin, CAPBridgedPlugin, NMFAuthManagerDelegate, NMFMapViewLoadDelegate, NMFMapViewCameraDelegate {
    public let identifier = "NaverNativeMapPlugin"
    public let jsName = "NaverNativeMap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "create", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "destroy", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "captureJourneySnapshot", returnType: CAPPluginReturnPromise)
    ]

    private var nativeView: NativeMapBackgroundView?
    private var mapView: NMFMapView?
    private var markers: [NMFMarker] = []
    private var markerItems: [JSObject] = []
    private var routeLine: NMFPolylineOverlay?
    private var journeyLines: [NMFPolylineOverlay] = []
    private var journeyPhotos: [NMFMarker] = []
    private var journeyPhotoImages: [String: (payload: String, image: NMFOverlayImage)] = [:]
    private var snapshotOperation: JourneySnapshotOperation?
    private var markerImages: [String: NMFOverlayImage] = [:]
    private var wantsVisible = false
    private var hasValidRect = false
    private var authFailed = false
    private var wantsInteraction = false
    private var hasTouchGeometry = false

    @objc public func create(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let clientId = call.getString("clientId")?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !clientId.isEmpty else {
                call.reject("네이버 지도 Client ID를 입력해 주세요.", "MISSING_CLIENT_ID")
                return
            }
            guard let host = self.bridge?.viewController?.view,
                  let webView = self.bridge?.webView as? MapOverlayWebView,
                  webView.superview === host else {
                call.reject("지도 화면을 준비하지 못했습니다. 앱을 다시 열어 주세요.", "NO_WEBVIEW")
                return
            }
            self.tearDownMap()
            let auth = NMFAuthManager.shared()
            auth.delegate = self
            // Use the current Naver Cloud Maps client. No Client Secret is needed.
            auth.client = NMFNcpKeyClient(ncpKeyId: clientId, beta: false)

            let nativeView = NativeMapBackgroundView(frame: host.bounds)
            nativeView.isHidden = true
            nativeView.clipsToBounds = true
            nativeView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            let map = nativeView.mapView
            map.locale = "ko"
            map.addLoadDelegate(delegate: self)
            map.addCameraDelegate(delegate: self)
            // Keep the SDK's Naver logo and attribution interactive and visible.
            host.insertSubview(nativeView, belowSubview: webView)
            self.nativeView = nativeView
            self.mapView = map
            self.applyRect(call.getObject("rect"))
            self.applyTouchGeometry(call)
            self.applyContentInsets(call.getObject("contentInsets"))
            self.applyCamera(center: call.getObject("center"), zoom: call.getDouble("zoom"))
            self.applyMarkers(call.getArray("markers", JSObject.self) ?? [])
            self.applyRoute(call.getObject("route"))
            self.applyJourney(call.getObject("journey"))
            self.applyFitBounds(call.getObject("fitBounds"))
            call.resolve()
            if auth.authState == .authorized {
                self.notifyListeners("authState", data: ["authorized": true])
            }
        }
    }

    @objc public func update(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.mapView != nil else {
                call.reject("지도가 아직 준비되지 않았습니다.", "MAP_NOT_CREATED")
                return
            }
            if let rect = call.getObject("rect") { self.applyRect(rect) }
            self.applyTouchGeometry(call)
            self.applyContentInsets(call.getObject("contentInsets"))
            self.applyCamera(center: call.getObject("center"), zoom: call.getDouble("zoom"))
            if let markers = call.getArray("markers", JSObject.self) { self.applyMarkers(markers) }
            if let route = call.getObject("route") {
                self.applyRoute(route)
            } else if call.options["route"] is NSNull {
                self.applyRoute(nil)
            }
            if let journey = call.getObject("journey") { self.applyJourney(journey) }
            else if call.options["journey"] is NSNull { self.applyJourney(nil) }
            self.applyFitBounds(call.getObject("fitBounds"))
            call.resolve()
        }
    }

    @objc public func setVisible(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.wantsVisible = call.getBool("visible") ?? false
            self.applyVisibility()
            call.resolve()
        }
    }

    @objc public func destroy(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.tearDownMap()
            if NMFAuthManager.shared().delegate === self { NMFAuthManager.shared().delegate = nil }
            call.resolve()
        }
    }

    private func applyRect(_ data: JSObject?) {
        guard let data,
              let x = number(data["x"]), let y = number(data["y"]),
              let width = number(data["width"]), let height = number(data["height"]),
              width > 0, height > 0,
              let webView = bridge?.webView as? MapOverlayWebView else {
            hasValidRect = false
            applyVisibility()
            return
        }
        // CSS pixels match UIKit points at the app's fixed initial viewport scale.
        let cssRect = CGRect(x: x, y: y, width: width, height: height)
        let frame = cssRect.intersection(webView.bounds)
        hasValidRect = !frame.isNull && frame.width >= 40 && frame.height >= 40
        webView.mapTouchRect = hasValidRect ? frame : .zero
        applyVisibility()
    }

    private func applyVisibility() {
        let visible = wantsVisible && hasValidRect && !authFailed
        nativeView?.isHidden = !visible
        (bridge?.webView as? MapOverlayWebView)?.mapInteractionEnabled =
            visible && wantsInteraction && hasTouchGeometry && snapshotOperation == nil
    }

    private func applyTouchGeometry(_ call: CAPPluginCall) {
        if let rects = call.getArray("webTouchRects", JSObject.self),
           let webView = bridge?.webView as? MapOverlayWebView {
            let parsed = rects.compactMap { data -> CGRect? in
                guard let x = number(data["x"]), let y = number(data["y"]),
                      let width = number(data["width"]), let height = number(data["height"]),
                      width >= 0, height >= 0 else { return nil }
                return CGRect(x: x, y: y, width: width, height: height)
            }
            hasTouchGeometry = parsed.count == rects.count
            webView.webTouchRects = parsed
        }
        if let enabled = call.getBool("interactionEnabled") { wantsInteraction = enabled }
        applyVisibility()
    }

    private func applyContentInsets(_ data: JSObject?) {
        guard let data, let top = number(data["top"]), let right = number(data["right"]),
              let bottom = number(data["bottom"]), let left = number(data["left"]) else { return }
        nativeView?.overlayInsets = UIEdgeInsets(top: max(0, top), left: max(0, left),
                                               bottom: max(0, bottom), right: max(0, right))
    }

    private func applyCamera(center: JSObject?, zoom: Double?) {
        guard let map = mapView else { return }
        let validZoom = zoom.flatMap { $0.isFinite ? min(21, max(5, $0)) : nil }
        if let center, let coordinate = coordinate(center) {
            map.moveCamera(NMFCameraUpdate(scrollTo: coordinate, zoomTo: validZoom ?? map.cameraPosition.zoom))
        } else if let validZoom {
            map.moveCamera(NMFCameraUpdate(zoomTo: validZoom))
        }
    }

    private func applyMarkers(_ data: [JSObject]) {
        // Keep source coordinates and order intact while the camera changes.
        markerItems = Array(data.prefix(200))
        renderMarkers()
    }

    private func renderMarkers() {
        guard snapshotOperation == nil else { return }
        for marker in markers {
            marker.touchHandler = nil
            marker.mapView = nil
        }
        markers.removeAll()
        guard let map = mapView else { return }
        let groups = markerGroups(on: map)
        for group in groups {
            if group.count > 1 {
                addCluster(group, on: map)
                continue
            }
            guard let index = group.first else { continue }
            let item = markerItems[index]
            guard let id = item["id"] as? String, let position = coordinate(item) else { continue }
            let marker = NMFMarker()
            marker.position = position
            let selected = item["selected"] as? Bool ?? false
            let completed = item["completed"] as? Bool ?? false
            let kind = item["kind"] as? String
            let isLocation = kind == "location"
            let approximate = item["approximate"] as? Bool ?? false
            let qrStatus = item["qrStatus"] as? String ?? "none"
            let rawNumber = number(item["number"])
            let stopNumber = rawNumber.flatMap { $0 >= 1 && $0 <= 99 && $0.rounded() == $0 ? Int($0) : nil }
            marker.captionText = item["label"] as? String ?? item["title"] as? String ?? "탐험 장소"
            marker.captionTextSize = selected ? 12 : 11
            marker.captionRequestedWidth = 100
            marker.captionMinZoom = selected ? 5 : 12
            marker.subCaptionMinZoom = selected ? 5 : 13.5
            marker.isHideCollidedCaptions = true
            marker.isForceShowCaption = selected
            marker.isForceShowIcon = selected || isLocation
            marker.captionColor = UIColor(red: 0.10, green: 0.22, blue: 0.17, alpha: 1)
            marker.captionHaloColor = .white
            switch kind {
            case "heritage": marker.subCaptionText = approximate ? "유산 대표 위치" : "유산 위치"
            case "facility": marker.subCaptionText = approximate ? "대표 위치" : "공식 안내 위치"
            case "viewing": marker.subCaptionText = approximate ? "조망 주변 위치" : "조망 위치"
            case "approximate": marker.subCaptionText = "근사 위치"
            case "location": marker.subCaptionText = "내 위치"
            default: marker.subCaptionText = ""
            }
            if selected && qrStatus != "none" {
                let qrLabel = qrStatus == "ready" ? "QR 안내판 사진 확인" : "QR 위치 확인 중"
                marker.subCaptionText += " · \(qrLabel)"
                marker.subCaptionRequestedWidth = 130
            }
            marker.subCaptionTextSize = 10
            marker.subCaptionColor = UIColor(red: 0.28, green: 0.35, blue: 0.31, alpha: 1)
            marker.subCaptionHaloColor = .white
            marker.iconImage = markerImage(number: stopNumber, kind: kind, selected: selected,
                                           completed: completed, qrStatus: qrStatus, approximate: approximate)
            marker.anchor = CGPoint(x: 0.5, y: 0.5)
            marker.zIndex = selected ? 100 : (isLocation ? 90 : (stopNumber == nil ? 0 : 20))
            marker.touchHandler = { [weak self] _ in
                guard let self, self.mapView != nil else { return false }
                self.notifyListeners("markerTap", data: ["id": id])
                return true
            }
            marker.mapView = map
            markers.append(marker)
        }
    }

    /// Connected groups use UIKit points, so pin density follows zoom and tilt.
    /// Selected places and the user's location always remain individual markers.
    private func markerGroups(on map: NMFMapView) -> [[Int]] {
        let points: [CGPoint?] = markerItems.map { item in
            guard item["id"] is String, let position = coordinate(item) else { return nil }
            let point = map.projection.point(from: position)
            return point.x.isFinite && point.y.isFinite ? point : nil
        }
        let independent = markerItems.map {
            ($0["selected"] as? Bool ?? false) || $0["kind"] as? String == "location"
        }
        var remaining = Set(markerItems.indices)
        var groups: [[Int]] = []
        for seed in markerItems.indices where remaining.remove(seed) != nil {
            guard !independent[seed], points[seed] != nil else {
                groups.append([seed])
                continue
            }
            var group = [seed]
            var cursor = 0
            while cursor < group.count {
                let member = group[cursor]
                cursor += 1
                guard let origin = points[member] else { continue }
                for candidate in markerItems.indices where remaining.contains(candidate) && !independent[candidate] {
                    guard let point = points[candidate] else { continue }
                    let dx = point.x - origin.x
                    let dy = point.y - origin.y
                    if dx * dx + dy * dy <= 40 * 40 {
                        remaining.remove(candidate)
                        group.append(candidate)
                    }
                }
            }
            groups.append(group.sorted())
        }
        return groups
    }

    private func addCluster(_ indices: [Int], on map: NMFMapView) {
        let members = indices.compactMap { index -> (id: String, position: NMGLatLng, point: CGPoint)? in
            let item = markerItems[index]
            guard let id = item["id"] as? String, let position = coordinate(item) else { return nil }
            return (id, position, map.projection.point(from: position))
        }
        guard members.count > 1 else { return }
        let center = CGPoint(x: members.map { $0.point.x }.reduce(0, +) / CGFloat(members.count),
                             y: members.map { $0.point.y }.reduce(0, +) / CGFloat(members.count))
        // Anchor at an actual member location, never at a fabricated map point.
        let representative = members.min {
            hypot($0.point.x - center.x, $0.point.y - center.y) <
                hypot($1.point.x - center.x, $1.point.y - center.y)
        }!
        let marker = NMFMarker()
        marker.position = representative.position
        marker.iconImage = clusterImage(count: members.count)
        marker.anchor = CGPoint(x: 0.5, y: 0.5)
        marker.zIndex = 40
        marker.captionText = "장소 선택"
        marker.captionTextSize = 10
        marker.captionColor = UIColor(red: 0.10, green: 0.22, blue: 0.17, alpha: 1)
        marker.captionHaloColor = .white
        marker.isHideCollidedCaptions = true
        let ids = members.map { $0.id }
        marker.touchHandler = { [weak self] _ in
            guard let self, self.mapView === map else { return false }
            self.notifyListeners("clusterTap", data: ["ids": ids])
            return true
        }
        marker.mapView = map
        markers.append(marker)
    }

    private func clusterImage(count: Int) -> NMFOverlayImage {
        let key = "cluster|\(count)"
        if let image = markerImages[key] { return image }
        let green = UIColor(red: 0.14, green: 0.38, blue: 0.30, alpha: 1)
        let image = UIGraphicsImageRenderer(size: CGSize(width: 48, height: 44)).image { context in
            let cg = context.cgContext
            cg.setShadow(offset: CGSize(width: 0, height: 1), blur: 3,
                         color: UIColor.black.withAlphaComponent(0.18).cgColor)
            UIColor(red: 0.99, green: 0.99, blue: 0.96, alpha: 1).setFill()
            UIBezierPath(roundedRect: CGRect(x: 3, y: 3, width: 42, height: 38), cornerRadius: 19).fill()
            cg.setShadow(offset: .zero, blur: 0)
            green.setFill()
            UIBezierPath(roundedRect: CGRect(x: 6, y: 6, width: 36, height: 32), cornerRadius: 16).fill()
            let text = "\(count)곳" as NSString
            let attributes: [NSAttributedString.Key: Any] = [
                .font: UIFont.monospacedDigitSystemFont(ofSize: count < 100 ? 12 : 10, weight: .bold),
                .foregroundColor: UIColor.white
            ]
            let textSize = text.size(withAttributes: attributes)
            text.draw(at: CGPoint(x: 24 - textSize.width / 2, y: 22 - textSize.height / 2),
                      withAttributes: attributes)
        }
        let overlay = NMFOverlayImage(image: image)
        if markerImages.count >= 200 { markerImages.removeAll() }
        markerImages[key] = overlay
        return overlay
    }

    private func applyRoute(_ data: JSObject?) {
        routeLine?.mapView = nil
        routeLine = nil
        guard let map = mapView, let data, let rawPoints = data["points"] as? [JSObject],
              rawPoints.count >= 2, rawPoints.count <= 2_000 else { return }
        let points = rawPoints.compactMap(coordinate)
        // Do not connect across a malformed or missing coordinate.
        guard points.count == rawPoints.count,
              let line = NMFPolylineOverlay(points) else { return }
        line.color = UIColor(red: 0.14, green: 0.43, blue: 0.34, alpha: 0.9)
        line.width = 3.5
        line.capType = .round
        line.joinType = .round
        // Only explicitly verified walking geometry may be drawn as a solid line.
        line.pattern = data["kind"] as? String == "walking" ? [] : [8, 7]
        line.mapView = map
        routeLine = line
    }

    private func applyFitBounds(_ data: JSObject?) {
        guard let map = mapView, let data, let rawPoints = data["points"] as? [JSObject],
              !rawPoints.isEmpty, rawPoints.count <= 100_000 else { return }
        let points = rawPoints.compactMap(coordinate)
        guard points.count == rawPoints.count else { return }
        nativeView?.layoutIfNeeded()
        let bounds = NMGLatLngBounds(latLngs: points)
        if points.count == 1 || (bounds.latSpan < 0.00001 && bounds.lngSpan < 0.00001) {
            map.moveCamera(NMFCameraUpdate(scrollTo: bounds.center, zoomTo: 15.5))
            return
        }
        let requestedPadding = CGFloat(number(data["padding"]) ?? 42)
        let contentSize = min(map.contentWidth, map.contentHeight)
        let padding = min(max(12, requestedPadding), max(12, CGFloat(contentSize) / 4))
        // SDK fitting already accounts for the measured HTML overlay insets.
        map.moveCamera(NMFCameraUpdate(fit: bounds, padding: padding))
    }

    /// Recorded coordinates are independent of the suggested A/B visit-order line.
    private func applyJourney(_ data: JSObject?) {
        for line in journeyLines { line.mapView = nil }
        for marker in journeyPhotos { marker.touchHandler = nil; marker.mapView = nil }
        journeyLines.removeAll()
        journeyPhotos.removeAll()
        guard let map = mapView, let data else { journeyPhotoImages.removeAll(); return }
        let rawPoints = data["points"] as? [JSObject] ?? []
        var segments: [[NMGLatLng]] = []
        var current: [NMGLatLng] = []
        var previousSegment: Double?
        var previousTimestamp: Double?
        for item in rawPoints.prefix(60_000) {
            guard let position = coordinate(item), let segment = number(item["segment"]),
                  segment >= 0, segment.rounded() == segment,
                  let timestamp = number(item["timestamp"]), timestamp >= 0,
                  let accuracy = number(item["accuracy"]), accuracy >= 0 else {
                if current.count > 1 { segments.append(current) }
                current.removeAll(); previousSegment = nil; previousTimestamp = nil
                continue
            }
            if previousSegment != nil && (previousSegment != segment
                || timestamp <= (previousTimestamp ?? timestamp)
                || timestamp - (previousTimestamp ?? timestamp) > 120_000) {
                if current.count > 1 { segments.append(current) }
                current.removeAll()
            }
            current.append(position)
            previousSegment = segment
            previousTimestamp = timestamp
        }
        if current.count > 1 { segments.append(current) }
        for points in segments {
            guard let line = NMFPolylineOverlay(points) else { continue }
            line.color = UIColor(red: 0.90, green: 0.41, blue: 0.31, alpha: 0.95)
            line.width = 4.5
            line.capType = .round
            line.joinType = .round
            line.pattern = []
            line.zIndex = 5
            line.mapView = map
            journeyLines.append(line)
        }
        let photos = data["photos"] as? [JSObject] ?? []
        var activeIds = Set<String>()
        for (index, item) in photos.enumerated() {
            guard let id = item["id"] as? String, !id.isEmpty, activeIds.insert(id).inserted,
                  let position = coordinate(item) else { continue }
            let marker = NMFMarker()
            marker.position = position
            marker.iconImage = journeyPhotoImage(id: id, dataUrl: item["thumbnailUrl"] as? String)
            marker.anchor = CGPoint(x: 0.5, y: 1)
            marker.zIndex = 150
            marker.isForceShowIcon = true
            marker.captionText = "사진 \(index + 1)"
            marker.captionTextSize = 10
            marker.captionColor = UIColor(red: 0.56, green: 0.23, blue: 0.16, alpha: 1)
            marker.captionHaloColor = .white
            marker.isHideCollidedCaptions = true
            marker.touchHandler = { [weak self] _ in
                guard let self, self.mapView === map else { return false }
                self.notifyListeners("photoTap", data: ["id": id])
                return true
            }
            marker.mapView = map
            journeyPhotos.append(marker)
        }
        journeyPhotoImages = journeyPhotoImages.filter { activeIds.contains($0.key) }
    }

    private func journeyPhotoImage(id: String, dataUrl: String?) -> NMFOverlayImage {
        let payload = dataUrl ?? ""
        if let cached = journeyPhotoImages[id], cached.payload == payload { return cached.image }
        var photo: UIImage?
        let prefix = "data:image/jpeg;base64,"
        if payload.hasPrefix(prefix), payload.utf8.count <= 2_000_000,
           let bytes = Data(base64Encoded: String(payload.dropFirst(prefix.count))) {
            photo = UIImage(data: bytes)
        }
        let coral = UIColor(red: 0.90, green: 0.41, blue: 0.31, alpha: 1)
        let image = UIGraphicsImageRenderer(size: CGSize(width: 56, height: 60)).image { context in
            let cg = context.cgContext
            cg.setShadow(offset: CGSize(width: 0, height: 2), blur: 3, color: UIColor.black.withAlphaComponent(0.2).cgColor)
            UIColor.white.setFill()
            UIBezierPath(roundedRect: CGRect(x: 3, y: 3, width: 50, height: 50), cornerRadius: 11).fill()
            cg.setShadow(offset: .zero, blur: 0)
            coral.setFill()
            let tip = UIBezierPath(); tip.move(to: CGPoint(x: 23, y: 52)); tip.addLine(to: CGPoint(x: 33, y: 52)); tip.addLine(to: CGPoint(x: 28, y: 59)); tip.close(); tip.fill()
            let content = CGRect(x: 7, y: 7, width: 42, height: 42)
            cg.saveGState()
            UIBezierPath(roundedRect: content, cornerRadius: 7).addClip()
            if let photo, photo.size.width > 0, photo.size.height > 0 {
                let scale = max(content.width / photo.size.width, content.height / photo.size.height)
                let size = CGSize(width: photo.size.width * scale, height: photo.size.height * scale)
                photo.draw(in: CGRect(x: content.midX - size.width / 2, y: content.midY - size.height / 2, width: size.width, height: size.height))
            } else {
                UIColor(red: 1, green: 0.94, blue: 0.91, alpha: 1).setFill(); UIRectFill(content)
                UIImage(systemName: "camera.fill")?.withTintColor(coral, renderingMode: .alwaysOriginal)
                    .draw(in: CGRect(x: 17, y: 18, width: 22, height: 19))
            }
            cg.restoreGState()
            coral.setStroke()
            let border = UIBezierPath(roundedRect: CGRect(x: 4, y: 4, width: 48, height: 48), cornerRadius: 10)
            border.lineWidth = 2; border.stroke()
        }
        let overlay = NMFOverlayImage(image: image)
        journeyPhotoImages[id] = (payload, overlay)
        return overlay
    }

    @objc public func captureJourneySnapshot(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [self] in
            guard self.snapshotOperation == nil else { call.reject("지도 이미지를 준비하고 있습니다.", "SNAPSHOT_BUSY"); return }
            guard let map = self.mapView, let view = self.nativeView,
                  view.window != nil, map.loaded, !self.authFailed,
                  NMFAuthManager.shared().authState == .authorized else {
                call.reject("네이버 지도가 준비되지 않아 경로 그림으로 영상을 만듭니다.", "MAP_UNAVAILABLE")
                return
            }
            let points = call.getArray("points", JSObject.self) ?? []
            let photos = call.getArray("photos", JSObject.self) ?? []
            guard points.count <= 60_000, photos.count <= 300, !points.isEmpty || !photos.isEmpty,
                  points.allSatisfy({ item in
                      guard self.coordinate(item) != nil, let segment = self.number(item["segment"]),
                            let timestamp = self.number(item["timestamp"]), let accuracy = self.number(item["accuracy"]) else { return false }
                      return segment >= 0 && segment.rounded() == segment && timestamp >= 0 && accuracy >= 0
                  }),
                  photos.allSatisfy({ self.coordinate($0) != nil && ($0["id"] as? String)?.isEmpty == false }) else {
                call.reject("여행 좌표를 확인해 주세요.", "INVALID_JOURNEY"); return
            }
            let operation = JourneySnapshotOperation(call: call, camera: map.cameraPosition,
                                                     insets: view.overlayInsets, points: points, photos: photos)
            self.snapshotOperation = operation
            self.applyVisibility()
            // Export only this trip's base map. Other places, routes and live GPS
            // overlays are restored after capture, and never leak into the video.
            self.markers.forEach { $0.mapView = nil }
            self.routeLine?.mapView = nil
            self.journeyLines.forEach { $0.mapView = nil }
            self.journeyPhotos.forEach { $0.mapView = nil }
            view.overlayInsets = .zero
            let positions = (points + photos).compactMap(self.coordinate)
            let bounds = NMGLatLngBounds(latLngs: positions)
            map.moveCamera(NMFCameraUpdate(position: NMFCameraPosition(bounds.center, zoom: 15, tilt: 0, heading: 0)))
            let update = bounds.latSpan < 0.00001 && bounds.lngSpan < 0.00001
                ? NMFCameraUpdate(scrollTo: bounds.center, zoomTo: 15.5)
                : NMFCameraUpdate(fit: bounds, padding: 65)
            update.animation = .none
            map.moveCamera(update)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) { [weak self] in self?.pollJourneySnapshot(operation) }
            DispatchQueue.main.asyncAfter(deadline: .now() + 12) { [weak self] in
                guard let self, self.snapshotOperation === operation else { return }
                self.finishJourneySnapshot(operation, result: nil, error: "지도 이미지 준비 시간이 초과되었습니다.")
            }
        }
    }

    private func pollJourneySnapshot(_ operation: JourneySnapshotOperation) {
        guard snapshotOperation === operation, let map = mapView, let view = nativeView else { return }
        guard !authFailed, NMFAuthManager.shared().authState == .authorized else {
            finishJourneySnapshot(operation, result: nil, error: "지도 인증을 확인해 주세요."); return
        }
        guard map.fullyRendered, map.renderingStable else {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in self?.pollJourneySnapshot(operation) }
            return
        }
        let size = view.snapshotView.bounds.size
        guard size.width > 0, size.height > 0 else {
            finishJourneySnapshot(operation, result: nil, error: "지도 이미지 크기를 확인하지 못했습니다."); return
        }
        func projected(_ item: JSObject) -> CGPoint {
            let point = map.projection.point(from: coordinate(item)!)
            let local = map.convert(point, to: view.snapshotView)
            return CGPoint(x: local.x / size.width, y: local.y / size.height)
        }
        var previousSegment: Double?
        var previousTimestamp: Double?
        var exportSegment = 0
        let points: [JSObject] = operation.points.map { item in
            let point = projected(item)
            let segment = number(item["segment"])!, timestamp = number(item["timestamp"])!
            if let previousTimestamp, previousSegment != segment || timestamp <= previousTimestamp || timestamp - previousTimestamp > 120_000 { exportSegment += 1 }
            previousSegment = segment; previousTimestamp = timestamp
            return ["x": Double(point.x), "y": Double(point.y), "segment": exportSegment]
        }
        let photos: [JSObject] = operation.photos.map { item in
            let point = projected(item)
            return ["id": item["id"] as! String, "x": Double(point.x), "y": Double(point.y)]
        }
        // The official wrapper includes its NAVER logo/attribution controls.
        view.snapshotView.takeSnapshot(withShowControls: true) { [weak self] image in
            DispatchQueue.main.async {
                guard let self, self.snapshotOperation === operation else { return }
                guard image.size.width > 0, image.size.height > 0, let bytes = image.jpegData(compressionQuality: 0.9) else {
                    self.finishJourneySnapshot(operation, result: nil, error: "지도 이미지를 저장하지 못했습니다."); return
                }
                self.finishJourneySnapshot(operation, result: ["dataUrl": "data:image/jpeg;base64," + bytes.base64EncodedString(), "points": points, "photos": photos], error: nil)
            }
        }
    }

    private func finishJourneySnapshot(_ operation: JourneySnapshotOperation, result: JSObject?, error: String?) {
        guard snapshotOperation === operation else { return }
        snapshotOperation = nil
        if let map = mapView {
            nativeView?.overlayInsets = operation.insets
            let restore = NMFCameraUpdate(position: operation.camera)
            restore.animation = .none
            map.moveCamera(restore)
            renderMarkers()
            routeLine?.mapView = map
            journeyLines.forEach { $0.mapView = map }
            journeyPhotos.forEach { $0.mapView = map }
        }
        applyVisibility()
        if let result { operation.call.resolve(result) }
        else { operation.call.reject(error ?? "지도 이미지를 준비하지 못했습니다.", "SNAPSHOT_FAILED") }
    }

    private func markerImage(number: Int?, kind: String?, selected: Bool, completed: Bool,
                             qrStatus: String, approximate: Bool) -> NMFOverlayImage {
        let key = "\(number ?? 0)|\(kind ?? "")|\(selected)|\(completed)|\(qrStatus)|\(approximate)"
        if let image = markerImages[key] { return image }
        let isLocation = kind == "location"
        let isViewing = kind == "viewing"
        let green = UIColor(red: 0.14, green: 0.38, blue: 0.30, alpha: 1)
        let blue = UIColor(red: 0.14, green: 0.43, blue: 0.59, alpha: 1)
        let fill = selected ? UIColor(red: 0.96, green: 0.75, blue: 0.34, alpha: 1)
            : (completed ? green : (isLocation ? blue : UIColor(red: 0.99, green: 0.99, blue: 0.96, alpha: 1)))
        let ink: UIColor = (completed || isLocation) && !selected ? .white : (isViewing ? blue : green)
        let size = CGSize(width: 42, height: 42)
        let image = UIGraphicsImageRenderer(size: size).image { context in
            let cg = context.cgContext
            let circle = CGRect(x: 5, y: 5, width: 31, height: 31)
            cg.setShadow(offset: CGSize(width: 0, height: 1), blur: 3, color: UIColor.black.withAlphaComponent(0.18).cgColor)
            fill.setFill()
            UIBezierPath(ovalIn: circle).fill()
            cg.setShadow(offset: .zero, blur: 0)
            (selected ? green : (isViewing ? blue : green.withAlphaComponent(0.75))).setStroke()
            let border = UIBezierPath(ovalIn: circle)
            border.lineWidth = selected ? 2.5 : 1.5
            if approximate { border.setLineDash([3, 2], count: 2, phase: 0) }
            border.stroke()
            if let number {
                let text = String(number) as NSString
                let attributes: [NSAttributedString.Key: Any] = [
                    .font: UIFont.monospacedDigitSystemFont(ofSize: 14, weight: .bold), .foregroundColor: ink
                ]
                let textSize = text.size(withAttributes: attributes)
                text.draw(at: CGPoint(x: circle.midX - textSize.width / 2, y: circle.midY - textSize.height / 2), withAttributes: attributes)
            } else {
                let symbol = isLocation ? "location.fill" : (isViewing ? "binoculars.fill" : "mappin")
                UIImage(systemName: symbol)?.withTintColor(ink, renderingMode: .alwaysOriginal)
                    .draw(in: CGRect(x: 13, y: 13, width: 15, height: 15))
            }
            if completed || qrStatus != "none" {
                // QR describes documented signboard status, not a QR coordinate
                // or completion of the app's separate demo quiz.
                let hasQrStatus = qrStatus != "none"
                let badge = hasQrStatus ? CGRect(x: 20, y: 26, width: 22, height: 14)
                    : CGRect(x: 26, y: 25, width: 15, height: 15)
                let edge = UIBezierPath(roundedRect: badge, cornerRadius: 6)
                (hasQrStatus ? UIColor.white : green).setFill()
                edge.fill()
                green.withAlphaComponent(0.75).setStroke()
                edge.lineWidth = 1
                edge.stroke()
                if hasQrStatus {
                    let text = (qrStatus == "ready" ? "QR" : "QR?") as NSString
                    let attributes: [NSAttributedString.Key: Any] = [
                        .font: UIFont.systemFont(ofSize: 8, weight: .bold),
                        .foregroundColor: qrStatus == "ready" ? green : UIColor.darkGray
                    ]
                    let textSize = text.size(withAttributes: attributes)
                    text.draw(at: CGPoint(x: badge.midX - textSize.width / 2, y: badge.midY - textSize.height / 2), withAttributes: attributes)
                } else {
                    UIImage(systemName: "checkmark")?.withTintColor(.white, renderingMode: .alwaysOriginal)
                        .draw(in: CGRect(x: 29, y: 28, width: 9, height: 9))
                }
            }
        }
        let overlay = NMFOverlayImage(image: image)
        if markerImages.count >= 200 { markerImages.removeAll() }
        markerImages[key] = overlay
        return overlay
    }

    private func coordinate(_ data: JSObject) -> NMGLatLng? {
        guard let lat = number(data["lat"]), let lng = number(data["lng"]),
              (-90...90).contains(lat), (-180...180).contains(lng) else { return nil }
        return NMGLatLng(lat: lat, lng: lng)
    }

    private func number(_ value: Any?) -> Double? {
        guard let number = value as? NSNumber else { return nil }
        let value = number.doubleValue
        return value.isFinite ? value : nil
    }

    private func tearDownMap() {
        if let operation = snapshotOperation { finishJourneySnapshot(operation, result: nil, error: "지도 화면이 닫혔습니다.") }
        applyJourney(nil)
        wantsVisible = false
        hasValidRect = false
        authFailed = false
        wantsInteraction = false
        hasTouchGeometry = false
        if let webView = bridge?.webView as? MapOverlayWebView {
            webView.mapInteractionEnabled = false
            webView.mapTouchRect = .zero
            webView.webTouchRects = []
        }
        for marker in markers {
            marker.touchHandler = nil
            marker.mapView = nil
        }
        markers.removeAll()
        markerItems.removeAll()
        routeLine?.mapView = nil
        routeLine = nil
        markerImages.removeAll()
        mapView?.removeLoadDelegate(delegate: self)
        mapView?.removeCameraDelegate(delegate: self)
        nativeView?.removeFromSuperview()
        mapView = nil
        nativeView = nil
    }

    public func authorized(_ state: NMFAuthState, error: Error?) {
        DispatchQueue.main.async {
            guard self.mapView != nil else { return }
            if state == .authorized {
                self.authFailed = false
                self.applyVisibility()
                self.notifyListeners("authState", data: ["authorized": true])
            } else if let error = error as NSError? {
                self.authFailed = true
                self.applyVisibility()
                // Do not forward URLs or identifiers contained in SDK error details.
                self.notifyListeners("authState", data: [
                    "authorized": false,
                    "code": error.code,
                    "message": "네이버 지도 인증을 확인해 주세요. Maps Client ID와 iOS Bundle ID(kr.bangucheon.passport), 인터넷 연결을 확인해 주세요."
                ])
            }
        }
    }

    public func mapViewDidFinishLoadingMap(_ mapView: NMFMapView) {
        guard mapView === self.mapView else { return }
        renderMarkers()
        notifyListeners("mapReady", data: [:])
    }

    public func mapViewCameraIdle(_ mapView: NMFMapView) {
        guard mapView === self.mapView else { return }
        renderMarkers()
    }
}

/// Official SDK controls are placed in the visible area without shrinking the
/// map itself. The SDK logo remains visible and opens its legal information.
private final class NativeMapBackgroundView: UIView {
    let snapshotView = NMFNaverMapView(frame: .zero)
    var mapView: NMFMapView { snapshotView.mapView }
    private let zoomControl = NMFZoomControlView(frame: CGRect(x: 0, y: 0, width: 44, height: 94))
    private let scaleControl = NMFScaleView(frame: CGRect(x: 0, y: 0, width: 100, height: 24))
    private let compassControl = NMFCompassView(frame: CGRect(x: 0, y: 0, width: 40, height: 40))
    var overlayInsets = UIEdgeInsets.zero {
        didSet { setNeedsLayout(); layoutIfNeeded() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        snapshotView.showCompass = false
        snapshotView.showScaleBar = false
        snapshotView.showZoomControls = false
        snapshotView.showLocationButton = false
        snapshotView.showIndoorLevelPicker = false
        addSubview(snapshotView)
        zoomControl.mapView = mapView
        scaleControl.mapView = mapView
        compassControl.mapView = mapView
        addSubview(zoomControl)
        addSubview(scaleControl)
        addSubview(compassControl)
    }

    required init?(coder: NSCoder) { fatalError("Use init(frame:)") }

    override func layoutSubviews() {
        super.layoutSubviews()
        snapshotView.frame = bounds
        snapshotView.layoutIfNeeded()
        guard bounds.width > 80, bounds.height > 80 else { return }
        var insets = overlayInsets
        // Even unusually large overlays leave a finite camera content area.
        let verticalScale = min(1, (bounds.height - 80) / max(1, insets.top + insets.bottom))
        let horizontalScale = min(1, (bounds.width - 80) / max(1, insets.left + insets.right))
        insets.top *= verticalScale
        insets.bottom *= verticalScale
        insets.left *= horizontalScale
        insets.right *= horizontalScale
        if mapView.contentInset != insets { mapView.setContentInset(insets, keepCamera: true) }
        // The SDK already positions its logo relative to contentInset.
        mapView.logoMargin = UIEdgeInsets(top: 10, left: 12, bottom: 10, right: 10)
        let bottom = bounds.height - insets.bottom - 10
        let centerY = (insets.top + bounds.height - insets.bottom) / 2
        let scaleY = bottom - 90
        let zoomY = max(insets.top + 64, min(centerY - 47, scaleY - 106))
        zoomControl.frame = CGRect(x: insets.left + 12, y: zoomY, width: 44, height: 94)
        scaleControl.frame = CGRect(x: insets.left + 12, y: scaleY, width: 100, height: 24)
        compassControl.frame = CGRect(x: insets.left + 12, y: insets.top + 12, width: 40, height: 40)
    }
}

private final class JourneySnapshotOperation {
    let call: CAPPluginCall
    let camera: NMFCameraPosition
    let insets: UIEdgeInsets
    let points: [JSObject]
    let photos: [JSObject]
    init(call: CAPPluginCall, camera: NMFCameraPosition, insets: UIEdgeInsets, points: [JSObject], photos: [JSObject]) {
        self.call = call; self.camera = camera; self.insets = insets; self.points = points; self.photos = photos
    }
}
