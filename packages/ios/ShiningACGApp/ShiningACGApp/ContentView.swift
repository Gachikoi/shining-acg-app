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
  /// 是否处于初始加载阶段（驱动 LaunchScreen）
  @State private var isLoading = true
  /// 首屏是否曾成功加载过，区分"启动期错误（防白屏）"与"运行期错误（toast/alert）"
  @State private var hasEverLoaded = false
  /// 当前网络故障类型，nil 表示无故障
  @State private var failureKind: NetworkFailureKind? = nil
  /// 媒体权限被拒类型（相机/麦克风/二者）
  @State private var deniedMediaType: WKMediaCaptureType? = nil
  /// 递增以触发 WebView 重新加载
  @State private var reloadToken = 0
  @StateObject private var networkMonitor = NetworkMonitor.shared
  @Environment(\.colorScheme) private var colorScheme

  /// 首屏期间发生的故障：保留 LaunchScreen 为底，叠加全屏错误页，避免白屏
  private var isFirstLoadFailure: Bool {
    !hasEverLoaded && failureKind != nil
  }

  /// 运行期故障：首屏已成功加载过，故障以 alert 呈现于内容之上
  private var isRuntimeFailure: Bool {
    hasEverLoaded && failureKind != nil
  }

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
          },
          onNetworkFail: { kind in
            failureKind = kind
          },
          onDidFinish: {
            hasEverLoaded = true
            failureKind = nil
          },
          onMediaPermissionDenied: { type in
            deniedMediaType = type
          },
          reloadToken: reloadToken
        )

        // 首屏未完成时叠加 LaunchScreen，避免裸 WebView 白屏暴露
        if isLoading || isFirstLoadFailure {
          LaunchScreenView()
            .zIndex(1)
            .transition(.opacity)
        }

        // 首屏期间发生故障：在 LaunchScreen 之上持续展示错误页（含重试），直到加载成功
        if isFirstLoadFailure, let kind = failureKind {
          NetworkErrorView(kind: kind, onRetry: retryLoad)
            .zIndex(2)
            .transition(.opacity)
        }
      }
      .ignoresSafeArea()
      .animation(.easeInOut(duration: 0.2), value: isFirstLoadFailure)
      // 运行期故障：以 alert 呈现，不打扰已加载的内容
      .alert(
        runtimeAlertTitle,
        isPresented: Binding(
          get: { isRuntimeFailure },
          set: { if !$0 { failureKind = nil } }
        ),
        presenting: failureKind
      ) { kind in
        runtimeAlertButtons(for: kind)
      } message: { kind in
        Text(messageText(for: kind))
      }
      // 媒体权限被拒引导
      .alert(
        mediaPermissionTitle,
        isPresented: Binding(
          get: { deniedMediaType != nil },
          set: { if !$0 { deniedMediaType = nil } }
        ),
        presenting: deniedMediaType
      ) { _ in
        Button("去设置") { openSystemSettings() }
        Button("取消", role: .cancel) {}
      } message: { type in
        Text(mediaPermissionMessage(for: type))
      }
      .onChange(of: networkMonitor.isReachable) { reachable in
        // 网络恢复时仅自动重试首屏故障场景，避免打扰运行期已加载的页面
        if reachable && isFirstLoadFailure {
          retryLoad()
        }
      }
      .sheet(item: $sheetUrl) { item in
        SafariView(url: item.url)
          .ignoresSafeArea()
      }
    } else {
      Text("URL 错误")
    }
  }

  /// 触发 WebView 重新加载并清空错误状态
  private func retryLoad() {
    failureKind = nil
    isLoading = true
    reloadToken += 1
  }

  private func openSystemSettings() {
    if let url = URL(string: UIApplication.openSettingsURLString) {
      UIApplication.shared.open(url)
    }
  }

  // MARK: - 文案与按钮分支

  private var runtimeAlertTitle: String {
    guard let kind = failureKind else { return "" }
    return titleText(for: kind)
  }

  private func titleText(for kind: NetworkFailureKind) -> String {
    switch kind {
    case .airplaneMode: return "无网络连接"
    case .cellularDenied: return "蜂窝数据被限制"
    case .offline: return "网络已断开"
    case .timeout: return "网络不稳定"
    case .dnsFailed: return "无法连接服务器"
    case .unstable: return "连接中断"
    case .unknown: return "加载失败"
    }
  }

  private func messageText(for kind: NetworkFailureKind) -> String {
    switch kind {
    case .airplaneMode:
      return "请关闭飞行模式或连接 Wi-Fi 后重试。"
    case .cellularDenied:
      return "已在设置中关闭本应用的蜂窝数据。请开启蜂窝数据或连接 Wi-Fi。"
    case .offline:
      return "当前网络不可用，请检查 Wi-Fi 或蜂窝数据连接。"
    case .timeout:
      return "加载超时，请检查网络后重试。"
    case .dnsFailed:
      return "可能是网络限制或服务器问题，请稍后重试。"
    case .unstable:
      return "网络连接中断，请检查网络后重试。"
    case .unknown:
      return "出现未知错误，请稍后重试。"
    }
  }

  /// 运行期 alert 的按钮组合：仅在与权限/系统设置相关的分类才提供"去设置"
  @ViewBuilder
  private func runtimeAlertButtons(for kind: NetworkFailureKind) -> some View {
    switch kind {
    case .airplaneMode, .cellularDenied:
      Button("去设置") { openSystemSettings() }
      Button("重试") { retryLoad() }
      Button("取消", role: .cancel) {}
    default:
      Button("重试") { retryLoad() }
      Button("取消", role: .cancel) {}
    }
  }

  // MARK: - 媒体权限文案

  private var mediaPermissionTitle: String {
    switch deniedMediaType {
    case .camera: return "需要相机权限"
    case .microphone: return "需要麦克风权限"
    case .cameraAndMicrophone: return "需要相机与麦克风权限"
    default: return "需要媒体权限"
    }
  }

  private func mediaPermissionMessage(for type: WKMediaCaptureType) -> String {
    switch type {
    case .camera:
      return "拍摄照片或视频需要使用相机。请在「设置 > 隐私 > 相机」中允许本应用访问相机。"
    case .microphone:
      return "录音或录制视频需要使用麦克风。请在「设置 > 隐私 > 麦克风」中允许本应用访问麦克风。"
    case .cameraAndMicrophone:
      return "录制视频需要同时使用相机和麦克风。请在设置中分别允许本应用访问。"
    @unknown default:
      return "请在系统设置中允许本应用访问所需权限。"
    }
  }
}

/// 首屏故障态全屏页：含图标、分类文案、重试按钮，覆盖在 LaunchScreen 之上防白屏
struct NetworkErrorView: View {
  let kind: NetworkFailureKind
  let onRetry: () -> Void

  @Environment(\.colorScheme) private var colorScheme

  var body: some View {
    ZStack {
      // 半透明背板：保留底层 LaunchScreen 的品牌氛围
      (colorScheme == .dark ? Color.black : Color.white)
        .opacity(0.92)
        .ignoresSafeArea()

      VStack(spacing: 20) {
        Image(systemName: iconName)
          .font(.system(size: 56, weight: .light))
          .foregroundStyle(.secondary)

        Text(title)
          .font(.title3)
          .fontWeight(.semibold)

        Text(message)
          .font(.subheadline)
          .foregroundStyle(.secondary)
          .multilineTextAlignment(.center)
          .padding(.horizontal, 32)

        VStack(spacing: 12) {
          Button(action: onRetry) {
            Text("重试")
              .font(.body.weight(.medium))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 12)
              .background(Color.accentColor)
              .foregroundStyle(.white)
              .clipShape(RoundedRectangle(cornerRadius: 12))
          }

          if showSettingsButton {
            Button {
              if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
              }
            } label: {
              Text("打开系统设置")
                .font(.body)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(Color.secondary.opacity(0.12))
                .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .foregroundStyle(.primary)
          }
        }
        .padding(.horizontal, 40)
        .padding(.top, 8)
      }
    }
  }

  private var iconName: String {
    switch kind {
    case .airplaneMode: return "airplane"
    case .cellularDenied: return "antenna.radiowaves.left.and.right.slash"
    case .offline: return "wifi.slash"
    case .timeout: return "hourglass.bottomhalf.filled"
    case .dnsFailed: return "exclamationmark.icloud"
    case .unstable: return "wifi.exclamationmark"
    case .unknown: return "exclamationmark.triangle"
    }
  }

  private var title: String {
    switch kind {
    case .airplaneMode: return "无网络连接"
    case .cellularDenied: return "蜂窝数据被限制"
    case .offline: return "网络已断开"
    case .timeout: return "网络不稳定"
    case .dnsFailed: return "无法连接服务器"
    case .unstable: return "连接中断"
    case .unknown: return "加载失败"
    }
  }

  private var message: String {
    switch kind {
    case .airplaneMode:
      return "请关闭飞行模式或连接 Wi-Fi 后重试。"
    case .cellularDenied:
      return "已在设置中关闭本应用的蜂窝数据。请开启蜂窝数据或连接 Wi-Fi。"
    case .offline:
      return "当前网络不可用，请检查 Wi-Fi 或蜂窝数据连接。"
    case .timeout:
      return "加载超时，请检查网络后重试。"
    case .dnsFailed:
      return "可能是网络限制或服务器问题，请稍后重试。"
    case .unstable:
      return "网络连接中断，请检查网络后重试。"
    case .unknown:
      return "出现未知错误，请稍后重试。"
    }
  }

  /// 仅对与系统设置直接相关的分类显示"打开系统设置"按钮，避免对纯网络问题误导
  private var showSettingsButton: Bool {
    switch kind {
    case .airplaneMode, .cellularDenied: return true
    default: return false
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
