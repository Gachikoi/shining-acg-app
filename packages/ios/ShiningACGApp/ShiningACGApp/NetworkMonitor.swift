//
//  NetworkMonitor.swift
//  ShiningACGApp
//
//  网络可达性监视器 + 故障分类。
//
//  - 用 NWPathMonitor 持续观察系统层网络状态（接口、是否 satisfied）
//  - 用 CTCellularData 获取应用层蜂窝数据权限状态
//  - 暴露 classify(_:) 将 WKWebView 抛出的 NSError 结合实时网络快照
//    映射为可驱动 UI 分支的 NetworkFailureKind
//

import Combine
import CoreTelephony
import Foundation
import Network

/// 网络失败的语义化分类，用于驱动差异化的 UI 提示与重试策略
enum NetworkFailureKind: Equatable {
  /// 飞行模式或所有网络接口都不可用
  case airplaneMode
  /// 应用蜂窝数据权限被关闭（设置 > 应用 > 蜂窝数据）
  case cellularDenied
  /// 临时离线：路径不可用但非飞行模式 / 非蜂窝权限
  case offline
  /// 请求超时（弱网或服务端响应慢）
  case timeout
  /// DNS 解析失败（找不到主机）
  case dnsFailed
  /// 连接建立失败或中途断开
  case unstable
  /// 其他未明确归类的错误
  case unknown
}

/// 纯函数：基于 NSError 与实时网络快照分类故障原因
///
/// - Parameters:
///   - error: WKWebView didFail 抛出的 NSError
///   - path: NWPathMonitor 最近一次的 NWPath 快照，可能为 nil（监视器尚未发布）
///   - cellularRestricted: 应用蜂窝数据权限是否受限（来自 CTCellularData）
/// - Returns: 分类结果
func classifyNetworkFailure(
  error: NSError,
  path: NWPath?,
  cellularRestricted: Bool
) -> NetworkFailureKind {
  let pathUnsatisfied = path?.status != .satisfied
  let noInterfaces = path?.availableInterfaces.isEmpty ?? true

  switch error.code {
  case NSURLErrorNotConnectedToInternet:  // -1009
    // 路径完全不可用且无接口 → 高概率飞行模式
    if pathUnsatisfied && noInterfaces { return .airplaneMode }
    // 应用被限制使用蜂窝且无 Wi-Fi 可用
    if cellularRestricted { return .cellularDenied }
    return .offline

  case NSURLErrorDataNotAllowed:  // -1020：蜂窝数据被禁用或应用被限制
    return .cellularDenied

  case NSURLErrorTimedOut:  // -1001
    return .timeout

  case NSURLErrorCannotFindHost:  // -1003
    return .dnsFailed

  case NSURLErrorCannotConnectToHost,  // -1004
    NSURLErrorNetworkConnectionLost:  // -1005
    return .unstable

  default:
    if pathUnsatisfied && noInterfaces { return .airplaneMode }
    if pathUnsatisfied { return .offline }
    return .unknown
  }
}

/// 单例 NetworkMonitor：发布可达性变化，缓存当前 NWPath 与蜂窝受限状态
final class NetworkMonitor: ObservableObject {
  static let shared = NetworkMonitor()

  /// 当前网络是否可用（path.status == .satisfied）
  @Published private(set) var isReachable: Bool = true

  /// 最近一次的 NWPath 快照（供分类函数使用）
  private(set) var currentPath: NWPath?

  /// 应用蜂窝数据权限是否受限
  private(set) var cellularRestricted: Bool = false

  private let monitor = NWPathMonitor()
  private let queue = DispatchQueue(label: "com.shiningacg.networkmonitor")
  private let cellularData = CTCellularData()

  private init() {
    monitor.pathUpdateHandler = { [weak self] path in
      guard let self = self else { return }
      DispatchQueue.main.async {
        self.currentPath = path
        self.isReachable = (path.status == .satisfied)
      }
    }
    monitor.start(queue: queue)

    // CTCellularData 通过 notifier 异步返回初始值与后续变化
    cellularData.cellularDataRestrictionDidUpdateNotifier = { [weak self] state in
      DispatchQueue.main.async {
        self?.cellularRestricted = (state == .restricted)
      }
    }
  }

  /// 把 WKWebView 抛出的 NSError 分类为 NetworkFailureKind
  /// - Parameter error: WKWebView 抛出的 NSError
  /// - Returns: 分类后的 NetworkFailureKind
  func classify(_ error: NSError) -> NetworkFailureKind {
    return classifyNetworkFailure(
      error: error,
      path: currentPath,
      cellularRestricted: cellularRestricted
    )
  }
}
