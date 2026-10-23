import UIKit
import WebKit
import Capacitor
import NMapsMap
import NMapsGeometry

/// A full-screen native map sits below the transparent web UI. Only touches
/// outside measured web controls are passed down by MapOverlayWebView.
@objc(NaverNativeMapPlugin)
public final class NaverNativeMapPlugin: CAPPlugin, CAPBridgedPlugin, NMFAuthManagerDelegate, NMFMapViewLoadDelegate {
    public let identifier = "NaverNativeMapPlugin"
    public let jsName = "NaverNativeMap"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "create", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setVisible", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "destroy", returnType: CAPPluginReturnPromise)
    ]

    private var nativeView: NativeMapBackgroundView?
    private var mapView: NMFMapView?
    private var markers: [NMFMarker] = []
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
            // Keep the SDK's Naver logo and attribution interactive and visible.
            host.insertSubview(nativeView, belowSubview: webView)
            self.nativeView = nativeView
            self.mapView = map
            self.applyRect(call.getObject("rect"))
            self.applyTouchGeometry(call)
            self.applyContentInsets(call.getObject("contentInsets"))
            self.applyCamera(center: call.getObject("center"), zoom: call.getDouble("zoom"))
            self.applyMarkers(call.getArray("markers", JSObject.self) ?? [])
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
            visible && wantsInteraction && hasTouchGeometry
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
        for marker in markers { marker.mapView = nil }
        markers.removeAll()
        guard let map = mapView else { return }
        // This app has a small, curated place list, plus one optional GPS marker.
        for item in data.prefix(200) {
            guard let id = item["id"] as? String, let position = coordinate(item) else { continue }
            let marker = NMFMarker()
            marker.position = position
            let selected = item["selected"] as? Bool ?? false
            let completed = item["completed"] as? Bool ?? false
            let kind = item["kind"] as? String
            let isLocation = kind == "location"
            marker.captionText = item["label"] as? String ?? item["title"] as? String ?? "탐험 장소"
            marker.captionTextSize = 12
            marker.captionRequestedWidth = 100
            marker.captionColor = UIColor(red: 0.10, green: 0.22, blue: 0.17, alpha: 1)
            marker.captionHaloColor = .white
            switch kind {
            case "heritage": marker.subCaptionText = "유산 위치"
            case "facility": marker.subCaptionText = "공식 안내 위치"
            case "viewing": marker.subCaptionText = "관람 위치"
            case "location": marker.subCaptionText = "내 위치"
            default: marker.subCaptionText = ""
            }
            marker.subCaptionTextSize = 10
            marker.subCaptionColor = UIColor(red: 0.28, green: 0.35, blue: 0.31, alpha: 1)
            marker.subCaptionHaloColor = .white
            marker.iconImage = isLocation ? NMF_MARKER_IMAGE_BLUE : (selected ? NMF_MARKER_IMAGE_YELLOW : (completed ? NMF_MARKER_IMAGE_GREEN : NMF_MARKER_IMAGE_RED))
            marker.zIndex = selected ? 100 : (isLocation ? 90 : 0)
            marker.touchHandler = { [weak self] _ in
                guard let self, self.mapView != nil else { return false }
                self.notifyListeners("markerTap", data: ["id": id])
                return true
            }
            marker.mapView = map
            markers.append(marker)
        }
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
        mapView?.removeLoadDelegate(delegate: self)
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
        notifyListeners("mapReady", data: [:])
    }
}

/// Official SDK controls are placed in the visible area without shrinking the
/// map itself. The SDK logo remains visible and opens its legal information.
private final class NativeMapBackgroundView: UIView {
    let mapView = NMFMapView(frame: .zero)
    private let zoomControl = NMFZoomControlView(frame: CGRect(x: 0, y: 0, width: 44, height: 94))
    private let scaleControl = NMFScaleView(frame: CGRect(x: 0, y: 0, width: 100, height: 24))
    private let compassControl = NMFCompassView(frame: CGRect(x: 0, y: 0, width: 40, height: 40))
    var overlayInsets = UIEdgeInsets.zero {
        didSet { setNeedsLayout(); layoutIfNeeded() }
    }

    override init(frame: CGRect) {
        super.init(frame: frame)
        addSubview(mapView)
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
        mapView.frame = bounds
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
