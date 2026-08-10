//
//  WebView.swift
//  ShiningACGApp
//
//  Created by 落殇 on 2026/1/4.
//
import AVFoundation
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
  var onLoadingStatusChange: ((Bool) -> Void)?
  /// 网络加载失败回调，携带分类后的 NetworkFailureKind
  var onNetworkFail: ((NetworkFailureKind) -> Void)?
  /// 首屏内容加载成功回调（仅 didFinish 时触发一次的语义在调用侧实现）
  var onDidFinish: (() -> Void)?
  /// 相机或麦克风权限被拒回调，type 区分摄像头 / 麦克风 / 二者
  var onMediaPermissionDenied: ((WKMediaCaptureType) -> Void)?
  /// 重新加载令牌：父视图递增此值即触发 WebView 重新 load 初始 url
  var reloadToken: Int = 0

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

    // 开启 App-Bound Domains 以获得更好的 Service Worker 支持和持久化
    // 这可以将 Web 内容标记为 App 的一部分，避免 WebKit 的 ITP (Intelligent Tracking Prevention) 机制误删 Service Worker 和存储数据（通常 7 天未使用会被清理）
    // 注意：Info.plist 中必须包含 App 涉及的所有域名（shiningacg.club）
    configuration.limitsNavigationsToAppBoundDomains = true

    // 明确指定使用默认的持久化数据存储（虽然是默认值，但强调其重要性）
    configuration.websiteDataStore = WKWebsiteDataStore.default()

    // 允许内联媒体播放
    configuration.allowsInlineMediaPlayback = true

    // 允许画中画
    configuration.allowsPictureInPictureMediaPlayback = true

    let wkwebView = WKWebView(frame: .zero, configuration: configuration)
    wkwebView.navigationDelegate = context.coordinator
    wkwebView.uiDelegate = context.coordinator

    // 使 scrollView 内部视图 ignore safe area
    wkwebView.scrollView.contentInsetAdjustmentBehavior = .never

    // 解决黑夜模式下首屏白屏/屏幕完全黑问题
    wkwebView.isOpaque = false

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

  func updateUIView(_ uiView: WKWebView, context: Context) {
    context.coordinator.parent = self
    // 父视图通过递增 reloadToken 触发重新加载初始 URL
    if context.coordinator.lastReloadToken != reloadToken {
      context.coordinator.lastReloadToken = reloadToken
      uiView.load(URLRequest(url: url))
    }
  }

  class Coordinator: NSObject, WKNavigationDelegate, WKScriptMessageHandler, WKUIDelegate {
    var parent: WebView
    /// 已处理的 reloadToken 值，避免 updateUIView 重复触发 reload
    var lastReloadToken: Int = 0

    // 预创建 Feedback Generator
    private let impactGenerators:
      [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] = {
        let styles: [UIImpactFeedbackGenerator.FeedbackStyle] = [
          .light, .medium, .heavy, .soft, .rigid,
        ]
        var map: [UIImpactFeedbackGenerator.FeedbackStyle: UIImpactFeedbackGenerator] = [:]
        for style in styles {
          map[style] = UIImpactFeedbackGenerator(style: style)
        }
        return map
      }()

    private let notificationGenerator = UINotificationFeedbackGenerator()
    private let selectionGenerator = UISelectionFeedbackGenerator()

    init(_ parent: WebView) {
      self.parent = parent
    }

    // 解析前端传来的 type 和 style
    private func getFeedbackParameters(type: String?, styleString: String?) -> (
      type: String, style: Any
    ) {
      let t = type ?? "impact"

      switch t {
      case "notification":
        let feedbackType: UINotificationFeedbackGenerator.FeedbackType
        switch styleString {
        case "success": feedbackType = .success
        case "warning": feedbackType = .warning
        case "error": feedbackType = .error
        default: feedbackType = .success
        }
        return (t, feedbackType)

      case "selection":
        return (t, "selection")

      default:  // 默认为 impact
        let style: UIImpactFeedbackGenerator.FeedbackStyle
        switch styleString {
        case "light": style = .light
        case "medium": style = .medium
        case "heavy": style = .heavy
        case "soft": style = .soft
        case "rigid": style = .rigid
        default: style = .medium
        }
        return ("impact", style)
      }
    }

    func userContentController(
      _ userContentController: WKUserContentController, didReceive message: WKScriptMessage
    ) {
      guard message.name == "ShiningBridge",
        let body = message.body as? [String: Any],
        let action = body["action"] as? String
      else { return }

      if action == "vibrate" || action == "prepareForVibrate" {
        let type = body["type"] as? String
        let styleString = body["style"] as? String
        let params = getFeedbackParameters(type: type, styleString: styleString)

        var location: CGPoint? = nil
        if let x = body["x"] as? Int, let y = body["y"] as? Int {
          location = CGPoint(x: x, y: y)
        }

        if action == "prepareForVibrate" {
          // 提前唤醒马达
          self.prepareFeedback(type: params.type, style: params.style)
        } else {
          // 实际触发震动
          self.triggerFeedback(type: params.type, style: params.style, at: location)
        }
      }
    }

    // MARK: - 触觉反馈核心逻辑

    // 唤醒马达（消除冷启动延迟）
    private func prepareFeedback(type: String, style: Any) {
      switch type {
      case "impact":
        if let impactStyle = style as? UIImpactFeedbackGenerator.FeedbackStyle,
          let generator = impactGenerators[impactStyle]
        {
          generator.prepare()
        }
      case "notification":
        notificationGenerator.prepare()
      case "selection":
        selectionGenerator.prepare()
      default:
        break
      }
    }

    // 触发马达
    private func triggerFeedback(type: String, style: Any, at location: CGPoint?) {
      switch type {
      case "impact":
        if let impactStyle = style as? UIImpactFeedbackGenerator.FeedbackStyle,
          let generator = impactGenerators[impactStyle]
        {
          if #available(iOS 17.5, *), let loc = location {
            generator.impactOccurred(at: loc)
          } else {
            generator.impactOccurred()
          }
        }
      case "notification":
        if let notifType = style as? UINotificationFeedbackGenerator.FeedbackType {
          if #available(iOS 17.5, *), let loc = location {
            notificationGenerator.notificationOccurred(notifType, at: loc)
          } else {
            notificationGenerator.notificationOccurred(notifType)
          }
        }
      case "selection":
        if #available(iOS 17.5, *), let loc = location {
          selectionGenerator.selectionChanged(at: loc)
        } else {
          selectionGenerator.selectionChanged()
        }
      default:
        break
      }
    }

    /// 判断错误是否属于"取消"类（如重复 load 触发的 -999），不应作为网络故障对外暴露
    private func isCancelledError(_ error: NSError) -> Bool {
      return error.domain == NSURLErrorDomain && error.code == NSURLErrorCancelled
    }

    /// 统一处理加载失败：分类 → 上报 → 仅对临时错误做一次自动延迟重试
    private func handleNavigationFailure(_ webView: WKWebView, error: NSError) {
      if isCancelledError(error) { return }

      let kind = NetworkMonitor.shared.classify(error)
      NSLog("WebView load failed: code=\(error.code) kind=\(kind)")

      parent.onNetworkFail?(kind)

      // 仅对临时性错误自动重试一次（飞行模式/蜂窝权限拒绝交由用户处理）
      switch kind {
      case .timeout, .unstable, .offline:
        DispatchQueue.main.asyncAfter(deadline: .now() + 3.0) { [weak webView, weak self] in
          guard let webView = webView, let self = self else { return }
          webView.load(URLRequest(url: self.parent.url))
        }
      case .airplaneMode, .cellularDenied, .dnsFailed, .unknown:
        break
      }
    }

    // 主框架的导航请求阶段失败（如 DNS/连接失败）
    func webView(
      _ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
      withError error: Error
    ) {
      handleNavigationFailure(webView, error: error as NSError)
    }

    // 内容已开始接收但加载过程中失败
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
      handleNavigationFailure(webView, error: error as NSError)
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
      parent.onLoadingStatusChange?(false)
      parent.onDidFinish?()
    }

    // MARK: - 媒体捕获权限（相机 / 麦克风）

    /// WKWebView 内 <input type="file" capture> / getUserMedia 触发相机或麦克风时回调。
    /// 结合 AVCaptureDevice 授权状态决策：notDetermined → 让系统弹窗；denied/restricted → 拒绝并通知 UI 引导去设置；authorized → 放行。
    func webView(
      _ webView: WKWebView,
      requestMediaCapturePermissionFor origin: WKSecurityOrigin,
      initiatedByFrame frame: WKFrameInfo,
      type: WKMediaCaptureType,
      decisionHandler: @escaping (WKPermissionDecision) -> Void
    ) {
      let mediaTypes: [AVMediaType] = {
        switch type {
        case .camera: return [.video]
        case .microphone: return [.audio]
        case .cameraAndMicrophone: return [.video, .audio]
        @unknown default: return [.video]
        }
      }()

      let statuses = mediaTypes.map { AVCaptureDevice.authorizationStatus(for: $0) }

      if statuses.contains(where: { $0 == .denied || $0 == .restricted }) {
        decisionHandler(.deny)
        parent.onMediaPermissionDenied?(type)
        return
      }

      if statuses.contains(where: { $0 == .notDetermined }) {
        // 让 WebKit 走系统原生弹窗（用户首次授权流程）
        decisionHandler(.prompt)
        return
      }

      decisionHandler(.grant)
    }
  }
}
