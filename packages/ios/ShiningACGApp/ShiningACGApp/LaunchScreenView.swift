//
//  LaunchScreenView.swift
//  ShiningACGApp
//
//  Created by Copilot on 2026/2/24.
//

import SwiftUI
import UIKit

struct LaunchScreenView: UIViewControllerRepresentable {
  func makeUIViewController(context: Context) -> UIViewController {
    let storyboard = UIStoryboard(name: "Launch Screen", bundle: nil)
    return storyboard.instantiateInitialViewController()!
  }

  func updateUIViewController(_ uiViewController: UIViewController, context: Context) {}
}

#Preview {
  LaunchScreenView()
}
