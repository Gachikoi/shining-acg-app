//
//  WebView.swift
//  ShiningACGApp
//
//  Created by 落殇 on 2026/1/4.
//
import Photos
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers
import WebKit

struct WebView: UIViewRepresentable {
  @Environment(\.colorScheme) private var colorScheme
  let url: URL
  var onOpenUrlInSheet: ((URL) -> Void)?

  func makeCoordinator() -> Coordinator {
    Coordinator(self)
  }

  func makeUIView(context: Context) -> WKWebView {
    let scriptSource = """
          // 解决黑夜模式下首屏白屏问题
          (function() {
              // 假设 mode-watcher 的逻辑是添加 'dark' class
              // 这里可以直接写死 dark，或者根据原生的特质动态传入
              let isDark = \(colorScheme == .dark) ? 'true' : 'false';
              if (isDark === 'true') {
                  document.documentElement.classList.add('dark');
                // document.documentElement.style.backgroundColor = '#000'; // 只能设置 html 元素背景，可能被其他元素的背景色覆盖，无法解决白屏问题
              }
          })();
      """

    let script = WKUserScript(
      source: scriptSource,
      injectionTime: .atDocumentStart,  // 关键：在文档开始解析时就注入，早于任何首屏渲染
      forMainFrameOnly: true
    )

    let userContentController = WKUserContentController()
    userContentController.addUserScript(script)

    // 注入 JSBridge 消息处理器
    userContentController.add(context.coordinator, name: "ShiningBridge")

    let configuration = WKWebViewConfiguration()
    configuration.userContentController = userContentController

    let wkwebView = WKWebView(frame: .zero, configuration: configuration)
    wkwebView.navigationDelegate = context.coordinator
    wkwebView.uiDelegate = context.coordinator

    // 解决黑夜模式下首屏白屏问题：初始隐藏，等待脚本注入后显示
    wkwebView.alpha = 0

    // 开启远程调试 (iOS 16.4+)
    if #available(iOS 16.4, *) {
      wkwebView.isInspectable = true
    }

    // 禁用长按预览和弹出菜单
    wkwebView.allowsLinkPreview = false

    // 禁用前进后退手势
    wkwebView.allowsBackForwardNavigationGestures = false

    // 禁用页面缩放
    wkwebView.scrollView.minimumZoomScale = 1.0
    wkwebView.scrollView.maximumZoomScale = 1.0

    // 禁用滚动条
    wkwebView.scrollView.showsHorizontalScrollIndicator = false
    wkwebView.scrollView.showsVerticalScrollIndicator = false

    let request = URLRequest(url: url)
    wkwebView.load(request)

    return wkwebView
  }

  func updateUIView(_ uiView: WKWebView, context: Context) {}

  class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
    var parent: WebView
    private var openPanelCompletion: (([URL]?) -> Void)?

    // 预创建 Feedback Generator
    private let impactGenerators:
      [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] = {
        let styles: [UIImpactFeedbackGenerator.FeedbackStyle] = [
          .light, .medium, .heavy, .soft, .rigid,
        ]
        var map: [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] = [:]
        for style in styles {
          let g = UIImpactFeedbackGenerator(style: style)
          map[style] = g
        }
        return map
      }()
    private let notificationGenerator: UINotificationFeedbackGenerator = {
      let g = UINotificationFeedbackGenerator()
      return g
    }()
    private let selectionGenerator: UISelectionFeedbackGenerator = {
      let g = UISelectionFeedbackGenerator()
      return g
    }()

    init(_ parent: WebView) {
      self.parent = parent
    }

    enum FeedbackKind {
      case impact(UIImpactFeedbackGenerator.FeedbackStyle)
      case notification(UINotificationFeedbackGenerator.FeedbackType)
      case selection
    }

    // 统一的位置感知触发方法，触发后立即 re-prepare 保持就绪
    private func triggerFeedback(kind: FeedbackKind, at location: CGPoint?) {
      switch kind {
      case .impact(let style):
        let generator = impactGenerators[style] ?? impactGenerators[.medium]!
        if #available(iOS 17.5, *), let loc = location {
          generator.impactOccurred(at: loc)
        } else {
          generator.impactOccurred()
        }
      case .notification(let type):
        if #available(iOS 17.5, *), let loc = location {
          notificationGenerator.notificationOccurred(type, at: loc)
        } else {
          notificationGenerator.notificationOccurred(type)
        }
      case .selection:
        if #available(iOS 17.5, *), let loc = location {
          selectionGenerator.selectionChanged(at: loc)
        } else {
          selectionGenerator.selectionChanged()
        }
        selectionGenerator.prepare()
      }
    }

    func userContentController(
      _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
    ) {
      if message.name == "ShiningBridge",
        let body = message.body as? [String: Any],
        let action = body["action"] as? String
      {
        if action == "vibrate" {
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
            triggerFeedback(kind: .impact(style), at: location)

          case "notification":
            let feedbackType: UINotificationFeedbackGenerator.FeedbackType
            switch styleString {
            case "success": feedbackType = .success
            case "warning": feedbackType = .warning
            case "error": feedbackType = .error
            default: feedbackType = .success
            }
            triggerFeedback(kind: .notification(feedbackType), at: location)

          case "selection":
            triggerFeedback(kind: .selection, at: location)

          default:
            triggerFeedback(kind: .impact(.medium), at: location)
          }
        } else if action == "readyForDisply" {

        }

      }
    }

    //    url 拦截
    func webView(
      _ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
      decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
      if let url = navigationAction.request.url {
        let targetHost = AppConfig.site
        if url.host == targetHost {
          parent.onOpenUrlInSheet?(url)
          decisionHandler(.cancel)
          return
        }
      }
      decisionHandler(.allow)
    }

    //    解决黑夜模式下首屏白屏问题：在页面加载完成后淡入显示 WebView
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
      webView.alpha = 1
    }
  }
}
