package club.shiningacg.ShiningAGCApp

import android.annotation.SuppressLint
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.webkit.WebChromeClient
import android.webkit.ValueCallback
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.browser.customtabs.CustomTabColorSchemeParams
import androidx.browser.customtabs.CustomTabsIntent
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import android.webkit.JavascriptInterface
import org.json.JSONObject
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.core.content.ContextCompat

/**
 * 使用 Chrome Custom Tabs 打开 URL（类似 iOS 的 SFSafariViewController）
 *
 * Chrome Custom Tabs 提供以下功能：
 * - 显示 URL 地址栏
 * - 分享按钮
 * - 在 Chrome 中打开选项
 * - 自定义工具栏颜色
 * - 原生浏览器体验
 * - 从底部滑入的动画效果
 */
fun openInCustomTab(
    context: android.content.Context,
    url: String,
    toolbarColor: Int? = null,
) {
    val customTabsIntent =
        CustomTabsIntent
            .Builder()
            .apply {
                // 设置工具栏颜色
                toolbarColor?.let { color ->
                    setDefaultColorSchemeParams(
                        CustomTabColorSchemeParams
                            .Builder()
                            .setToolbarColor(color)
                            .build(),
                    )
                }

                // 启用默认分享菜单
                setShareState(CustomTabsIntent.SHARE_STATE_ON)

                // 显示标题
                setShowTitle(true)

                // 使用底部向上滑入的动画（类似 SFSafariViewController）
                setStartAnimations(context, android.R.anim.slide_in_left, android.R.anim.slide_out_right)
                setExitAnimations(context, android.R.anim.slide_in_left, android.R.anim.slide_out_right)

                // URL 隐藏设置（保持显示完整 URL）
                setUrlBarHidingEnabled(false)
            }.build()

    customTabsIntent.launchUrl(context, url.toUri())
}

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewScreen(
    url: String,
    modifier: Modifier = Modifier,
) {
    // 获取 Context 和主题色用于 Chrome Custom Tabs
    val context = LocalContext.current
    val primaryColor = MaterialTheme.colorScheme.primary.toArgb()

    // 检测系统是否处于深色模式
    val isDarkTheme = isSystemInDarkTheme()

    val filePathCallback = remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val pendingFileChooserParams = remember { mutableStateOf<WebChromeClient.FileChooserParams?>(null) }

    val fileChooserLauncher = remember {
        FileChooserLauncher(context, "${BuildConfig.APPLICATION_ID}.fileprovider")
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = fileChooserLauncher.parseResult(result.resultCode, result.data)
        filePathCallback.value?.onReceiveValue(uris)
        filePathCallback.value = null
        fileChooserLauncher.clear()
    }

    // First launcher: request gallery/storage permission
    val galleryPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Gallery permission result - launch camera or chooser
        pendingFileChooserParams.value?.let { params ->
            val acceptTypes = params.acceptTypes ?: arrayOf("*/*")
            val needsCamera = acceptTypes.any { 
                it.startsWith("image/") || it == "*/*"
            }
            
            if (needsCamera && !hasCameraPermission()) {
                // Request camera permission next
                cameraPermissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
            } else {
                // No camera needed or already granted, launch chooser
                val intent = fileChooserLauncher.createChooserIntent(params)
                launcher.launch(intent)
                pendingFileChooserParams.value = null
            }
        }
    }

    // Second launcher: request camera permission (after gallery)
    val cameraPermissionLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        // Camera permission result - launch chooser regardless
        pendingFileChooserParams.value?.let { params ->
            val intent = fileChooserLauncher.createChooserIntent(params)
            launcher.launch(intent)
            pendingFileChooserParams.value = null
        }
    }

    fun hasGalleryPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context, 
                Manifest.permission.READ_MEDIA_IMAGES
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            true // Older Android uses manifest-declared permission
        }
    }

    fun hasCameraPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            context, 
            Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED
    }

    fun getGalleryPermissions(): Array<String> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            arrayOf(Manifest.permission.READ_MEDIA_IMAGES)
        } else {
            emptyArray() // No runtime permission needed for older Android
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            filePathCallback.value?.onReceiveValue(null)
            filePathCallback.value = null
        }
    }

    Box(modifier = modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    layoutParams =
                        ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT,
                        )

                    // 配置 WebView 设置（与 iOS 配置对应）
                    settings.apply {
                        javaScriptEnabled = true

                        // 启用 DOM 存储 (localStorage, sessionStorage) - 对 SPA 至关重要
                        domStorageEnabled = true

                        // 允许混合内容（HTTPS 页面加载 HTTP 资源）
                        mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW

                        // 允许文件访问
                        allowFileAccess = true
                        allowContentAccess = true

                        // 设置缓存模式
                        if (BuildConfig.DEBUG) {
                            // 调试模式下禁用缓存
                            cacheMode = WebSettings.LOAD_NO_CACHE
                        } else {
                            cacheMode = WebSettings.LOAD_DEFAULT
                        }

                        // 禁用缩放
                        setSupportZoom(false)
                        builtInZoomControls = false
                        displayZoomControls = false

                        // 用户代理 - 使用默认 WebView 用户代理并添加应用标识
                        userAgentString = "$userAgentString ShiningACGApp/Android"
                    }

                    addJavascriptInterface(WebAppInterface(ctx), "AndroidBridge")

                    // 禁用滚动条
                    isVerticalScrollBarEnabled = false
                    isHorizontalScrollBarEnabled = false

                    // 禁用过度滚动效果（弹性效果）
                    overScrollMode = View.OVER_SCROLL_NEVER

                    webViewClient =
                        object : WebViewClient() {
                            override fun shouldOverrideUrlLoading(
                                view: WebView?,
                                request: WebResourceRequest?,
                            ): Boolean {
                                request?.url?.let { uri ->
                                    val host = uri.host ?: return false

                                    // 拦截 www.shiningacg.club 并使用 Chrome Custom Tabs 打开
                                    // 类似 iOS 的 SFSafariViewController 效果
                                    if (host == BuildConfig.INTERCEPT_HOST) {
                                        openInCustomTab(ctx, uri.toString(), primaryColor)
                                        return true // 取消 WebView 导航，改为在 Custom Tab 中显示
                                    }

                                    // 允许其他 shiningacg.club 子域名在 WebView 中加载
                                    if (host.endsWith("shiningacg.club")) {
                                        return false // 允许 WebView 导航
                                    }

                                    // 其他外部链接也使用 Chrome Custom Tabs 打开
                                    openInCustomTab(ctx, uri.toString(), primaryColor)
                                    return true // 取消 WebView 导航
                                }
                                return false // 允许 WebView 导航
                            }
                        }

                    webChromeClient = object : WebChromeClient() {
                        override fun onShowFileChooser(
                            webView: WebView?,
                            callback: ValueCallback<Array<Uri>>?,
                            params: FileChooserParams?
                        ): Boolean {
                            filePathCallback.value?.onReceiveValue(null)
                            filePathCallback.value = callback
                            
                            pendingFileChooserParams.value = params
                            
                            // First check gallery permission
                            val galleryPermissions = getGalleryPermissions()
                            if (galleryPermissions.isNotEmpty() && !hasGalleryPermission()) {
                                galleryPermissionLauncher.launch(galleryPermissions)
                            } else {
                                // Gallery permission granted, check camera
                                val acceptTypes = params?.acceptTypes ?: arrayOf("*/*")
                                val needsCamera = acceptTypes.any { 
                                    it.startsWith("image/") || it == "*/*"
                                }
                                
                                if (needsCamera && !hasCameraPermission()) {
                                    cameraPermissionLauncher.launch(arrayOf(Manifest.permission.CAMERA))
                                } else {
                                    // All permissions granted, launch chooser
                                    params?.let {
                                        val intent = fileChooserLauncher.createChooserIntent(it)
                                        launcher.launch(intent)
                                        pendingFileChooserParams.value = null
                                    }
                                }
                            }
                            return true
                        }
                    }

                    // 启用远程调试（用于调试版本）
                    WebView.setWebContentsDebuggingEnabled(true)

                    loadUrl(url)
                }
            },
        )
    }
}
private class WebAppInterface(private val context: android.content.Context) {
    @JavascriptInterface
    fun postMessage(message: String) {
        try {
            val json = JSONObject(message)
            val action = json.optString("action")

            if (action == "vibrate") {
                val duration = json.optLong("duration", 200)
                vibrate(duration)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun vibrate(duration: Long) {
        val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val vibManager = context.getSystemService(android.content.Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
            vibManager.defaultVibrator
        } else {
            @Suppress("DEPRECATION")
            context.getSystemService(android.content.Context.VIBRATOR_SERVICE) as Vibrator
        }

        vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE))
    }
}