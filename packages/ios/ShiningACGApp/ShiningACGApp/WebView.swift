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
  
  func makeUIView(context: Context) -> WKWebView {
    // 注入 meta 标签禁用缩放
    let source = """
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
          meta = document.createElement('meta');
          meta.name = 'viewport';
          document.getElementsByTagName('head')[0].appendChild(meta);
      }
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';
    """
    let script = WKUserScript(source: source, injectionTime: .atDocumentEnd, forMainFrameOnly: true)
    let userContentController = WKUserContentController()
    userContentController.addUserScript(script)
    
    let configuration = WKWebViewConfiguration()
    configuration.userContentController = userContentController
    
    let wkwebView = WKWebView(frame: .zero, configuration: configuration)
    
    // 允许前进后退手势
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
    
  }
}
