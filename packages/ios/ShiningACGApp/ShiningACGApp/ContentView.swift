//
//  ContentView.swift
//  ShiningACGApp
//
//  Created by 落殇 on 2026/1/1.
//

import SwiftUI
import WebKit
import Foundation
import SafariServices

struct IdentifiableURL: Identifiable {
    let id = UUID()
    let url: URL
}

struct ContentView: View {
  let url=URL(string: "https://app.shiningacg.club")
  @State private var sheetUrl: IdentifiableURL?
  
  var body: some View {
    if let url {
      WebView(url: url) { interceptedUrl in
        sheetUrl = IdentifiableURL(url: interceptedUrl)
      }
      .ignoresSafeArea(.keyboard)
      .sheet(item: $sheetUrl) { item in
        SafariView(url: item.url)
          .ignoresSafeArea()
      }
    } else {
      Text("内容加载失败")
    }
  }
}

struct SafariView: UIViewControllerRepresentable {
  let url: URL

  func makeUIViewController(context: Context) -> SFSafariViewController {
    return SFSafariViewController(url: url)
  }

  func updateUIViewController(_ uiViewController: SFSafariViewController, context: Context) {}
}

#Preview {
  ContentView()
}
