import Capacitor
import UIKit
import WebKit

/// The web UI owns its measured controls. Other touches belong to the map below.
/// Until complete geometry arrives, every touch stays in the web view.
final class MapOverlayWebView: WKWebView {
    var mapInteractionEnabled = false
    var mapTouchRect = CGRect.zero
    var webTouchRects: [CGRect] = []

    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        if mapInteractionEnabled,
           mapTouchRect.contains(point),
           !webTouchRects.contains(where: { $0.contains(point) }) {
            return nil
        }
        return super.hitTest(point, with: event)
    }
}

final class MainViewController: CAPBridgeViewController {
    override func webView(with frame: CGRect, configuration: WKWebViewConfiguration) -> WKWebView {
        MapOverlayWebView(frame: frame, configuration: configuration)
    }

    override func capacitorDidLoad() {
        guard let webView else { return }
        // Capacitor's documented factory keeps its configured WebView, bridge,
        // origin and data store. A container adds a native layer underneath it.
        let container = UIView(frame: webView.frame)
        container.backgroundColor = UIColor(red: 0.96, green: 0.97, blue: 0.94, alpha: 1)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.backgroundColor = .clear
        webView.underPageBackgroundColor = .clear
        webView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            webView.topAnchor.constraint(equalTo: container.topAnchor),
            webView.bottomAnchor.constraint(equalTo: container.bottomAnchor)
        ])
        view = container
        bridge?.registerPluginInstance(NaverNativeMapPlugin())
        bridge?.registerPluginInstance(JourneyNativePlugin())
    }
}
