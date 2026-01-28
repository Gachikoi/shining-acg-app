//
//  WebView.swift
//  ShiningACGApp
//
//  Created by 落殇 on 2026/1/4.
//
import SwiftUI
import WebKit

struct WebView:UIViewRepresentable {
  let url:URL
  var onOpenUrlInSheet: ((URL) -> Void)?
  
  func makeCoordinator() -> Coordinator {
    Coordinator(self)
  }
  
  func makeUIView(context: Context) -> WKWebView {
    let source = """
      
    """
    let script = WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)
    let userContentController = WKUserContentController()
    userContentController.addUserScript(script)
    
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
    
    let request = URLRequest(url: url)
    wkwebView.load(request)
    
    return wkwebView
  }
  
  func updateUIView(_ uiView: WKWebView, context: Context) {
    
  }
  
  class Coordinator: NSObject, WKNavigationDelegate {
    var parent: WebView
    
    init(_ parent: WebView) {
      self.parent = parent
    }
    
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
      if let url = navigationAction.request.url {
        // 拦截 www.shiningacg.club 的访问
        if url.host == "www.shiningacg.club" {
          parent.onOpenUrlInSheet?(url)
          decisionHandler(.cancel)
          return
        }
      }
      decisionHandler(.allow)
    }
  }
}
