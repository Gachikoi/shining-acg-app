//
//  ContentView.swift
//  ShiningACGApp
//
//  Created by 落殇 on 2026/1/1.
//

import SwiftUI
import WebKit

struct ContentView: View {
  var body: some View {
    WebView(url: URL(string: "https://www.baidu.com"))
      .webViewBackForwardNavigationGestures(.disabled)
  }
}

#Preview {
  ContentView()
}
