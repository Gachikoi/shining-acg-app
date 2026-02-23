//
//  ContentView.swift
//  ShiningACGApp
//
//  Created by 落殇 on 2026/1/1.
//

import Foundation
import SafariServices
import SwiftUI
import WebKit

struct IdentifiableURL: Identifiable {
  let id = UUID()
  let url: URL
}

struct ContentView: View {
  let url = URL(string: "https://\(AppConfig.app)")
  @State private var sheetUrl: IdentifiableURL?
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    if let url {
      WebView(url: url) { interceptedUrl in
        sheetUrl = IdentifiableURL(url: interceptedUrl)
      }
      .ignoresSafeArea()
      .sheet(item: $sheetUrl) { item in
        SafariView(url: item.url)
          .ignoresSafeArea()
      }
    } else {
      Text("URL 错误")
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
