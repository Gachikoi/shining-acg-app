//
//  WebView.swift
//  ShiningACGApp
//
//  Created by 落殇 on 2026/1/4.
//
import SwiftUI
import UIKit
import WebKit

struct WebView: UIViewRepresentable {
  let url: URL
  var onOpenUrlInSheet: ((URL) -> Void)?

  func makeCoordinator() -> Coordinator {
    Coordinator(self)
  }

  func makeUIView(context: Context) -> WKWebView {
    let source = """
        
      """
    let script = WKUserScript(
      source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    let userContentController = WKUserContentController()
    userContentController.addUserScript(script)

    // 注入 JSBridge 消息处理器
    userContentController.add(context.coordinator, name: "ShiningBridge")

    let configuration = WKWebViewConfiguration()
    configuration.userContentController = userContentController

    let wkwebView = WKWebView(frame: .zero, configuration: configuration)
    wkwebView.navigationDelegate = context.coordinator

    // 开启远程调试 (iOS 16.4+)
    if #available(iOS 16.4, *) {
      wkwebView.isInspectable = true
    }

    // 禁用长按预览和弹出菜单
    wkwebView.allowsLinkPreview = false

    // 允许前进后退手势
    wkwebView.allowsBackForwardNavigationGestures = false

    // 禁用页面缩放
    wkwebView.scrollView.minimumZoomScale = 1.0
    wkwebView.scrollView.maximumZoomScale = 1.0

    // 禁用弹性效果（防止上下滑动时移动）
    wkwebView.scrollView.alwaysBounceVertical = false

    // 禁用滚动条
    wkwebView.scrollView.showsHorizontalScrollIndicator = false
    wkwebView.scrollView.showsVerticalScrollIndicator = false

    var request = URLRequest(url: url)
    #if DEBUG
      // 调试模式下忽略本地缓存，每次重新请求
      request.cachePolicy = .reloadIgnoringLocalCacheData
    #endif
    wkwebView.load(request)

    return wkwebView
  }

  func updateUIView(_ uiView: WKWebView, context: Context) {

  }

  class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler {
    var parent: WebView

    init(_ parent: WebView) {
      self.parent = parent
    }

    func userContentController(
      _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
    ) {
      if message.name == "ShiningBridge",
        let body = message.body as? [String: Any],
        let action = body["action"] as? String
      {
        if action == "vibrate" {
          // Prepare location (iOS 17.5+)
          var location: CGPoint? = nil
          if let x = body["x"] as? Int, let y = body["y"] as? Int {
            location = CGPoint(x: x, y: y)
          }

          let type = body["type"] as? String
          let styleString = body["style"] as? String

          switch type {
          case "impact":
            let style: UIImpactFeedbackGenerator.FeedbackStyle
            switch styleString {
            case "light": style = .light
            case "medium": style = .medium
            case "heavy": style = .heavy
            case "soft": style = .soft
            case "rigid": style = .rigid
            default: style = .medium
            }
            let generator = UIImpactFeedbackGenerator(style: style)
            generator.prepare()
            if #available(iOS 17.5, *), let loc = location {
              generator.impactOccurred(at: loc)
            } else {
              generator.impactOccurred()
            }

          case "notification":
            let feedbackType: UINotificationFeedbackGenerator.FeedbackType
            switch styleString {
            case "success": feedbackType = .success
            case "warning": feedbackType = .warning
            case "error": feedbackType = .error
            default: feedbackType = .success
            }
            let generator = UINotificationFeedbackGenerator()
            generator.prepare()
            generator.notificationOccurred(feedbackType)

          case "selection":
            let generator = UISelectionFeedbackGenerator()
            generator.prepare()
            if #available(iOS 17.5, *), let loc = location {
              generator.selectionChanged(at: loc)
            } else {
              generator.selectionChanged()
            }

          default:
            let generator = UIImpactFeedbackGenerator(style: .medium)
            generator.prepare()
            if #available(iOS 17.5, *), let loc = location {
              generator.impactOccurred(at: loc)
            } else {
              generator.impactOccurred()
            }
          }
        }
      }
    }

    func webView(
      _ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
      if let url = navigationAction.request.url {
        // 拦截 www.shiningacg.club 的访问
        let targetHost = AppConfig.siteHost
        if url.host == targetHost {
          parent.onOpenUrlInSheet?(url)
          decisionHandler(.cancel)
          return
        }
      }
      decisionHandler(.allow)
    }
  }
}
