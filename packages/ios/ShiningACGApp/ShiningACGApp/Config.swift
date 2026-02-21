//
//  Config.swift
//  ShiningACGApp
//
//  Created by Copilot on 2026/2/21.
//

import Foundation

enum AppEnvironment {
  case debug
  case release

  static var current: AppEnvironment {
    #if DEBUG
      return .debug
    #else
      return .release
    #endif
  }
}

struct AppConfig {
  static var app: String {
    switch AppEnvironment.current {
    case .debug:
      return "test.app.shiningacg.club"
    case .release:
      return "app.shiningacg.club"
    }
  }

  static var site: String {
    switch AppEnvironment.current {
    case .debug:
      return "test.www.shiningacg.club"
    case .release:
      return "www.shiningacg.club"
    }
  }
}
