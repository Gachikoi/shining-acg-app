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
  @State private var isLoading = true
  @State private var showNetworkAlert = false
  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    if let url {
      ZStack {
        if colorScheme == .dark { Color(red: 9 / 255, green: 9 / 255, blue: 11 / 255) }
        WebView(
          url: url,
          onOpenUrlInSheet: { interceptedUrl in
            sheetUrl = IdentifiableURL(url: interceptedUrl)
          },
          onLoadingStatusChange: { status in
            withAnimation {
              isLoading = status
            }
            if !status {
              showNetworkAlert = false
            }
          },
          onNetworkFail: {
            showNetworkAlert = true
          })
        if isLoading {
          LaunchScreenView()
            .zIndex(1)
            .transition(.opacity)
        }
      }
      .ignoresSafeArea()
      .alert("网络连接失败", isPresented: $showNetworkAlert) {
        Button("去设置") {
          if let url = URL(string: UIApplication.openSettingsURLString) {
            UIApplication.shared.open(url)
          }
        }
        Button("取消", role: .cancel) {}
      } message: {
        Text("请在设置中开启网络权限，否则无法加载内容。")
      }
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
