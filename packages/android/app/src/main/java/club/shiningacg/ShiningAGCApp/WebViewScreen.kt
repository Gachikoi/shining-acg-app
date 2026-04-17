package club.shiningacg.ShiningAGCApp

import android.annotation.SuppressLint
import android.content.Intent
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
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.net.toUri
import android.webkit.JavascriptInterface
import org.json.JSONObject
import android.os.Build
import android.view.HapticFeedbackConstants
import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import android.util.Log

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

private const val MIN_WEBVIEW_VERSION = 99

@SuppressLint("SetJavaScriptEnabled")
@Composable
fun WebViewScreen(
    url: String,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val primaryColor = MaterialTheme.colorScheme.primary.toArgb()

    val webViewMajorVersion = remember {
        WebView.getCurrentWebViewPackage()
            ?.versionName?.split(".")?.firstOrNull()?.toIntOrNull() ?: 0
    }

    if (webViewMajorVersion < MIN_WEBVIEW_VERSION) {
        WebViewUpdatePrompt(modifier = modifier)
        return
    }

    var webViewNativeReady by remember { mutableStateOf(false) }
    var webViewNativeError by remember { mutableStateOf<Throwable?>(null) }

    LaunchedEffect(Unit) {
        try {
            WebView(context).destroy()
            webViewNativeReady = true
        } catch (e: Throwable) {
            Log.e("WebViewScreen", "WebView native library failed to load", e)
            webViewNativeError = e
        }
    }

    webViewNativeError?.let { err ->
        WebViewNativeLoadFailedPrompt(
            modifier = modifier,
            throwable = err,
        )
        return
    }

    if (!webViewNativeReady) {
        Box(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            CircularProgressIndicator()
        }
        return
    }

    val filePathCallback = remember { mutableStateOf<ValueCallback<Array<Uri>>?>(null) }
    val pendingFileChooserParams = remember { mutableStateOf<WebChromeClient.FileChooserParams?>(null) }

    val fileChooserLauncher = remember {
        FileChooserLauncher(context, "${BuildConfig.APPLICATION_ID}.fileprovider")
    }

    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.StartActivityForResult()
    ) { result ->
        Log.d("WebViewScreen", "launcher result: resultCode=${result.resultCode}")
        Log.d("WebViewScreen", "launcher result: data=${result.data}")
        Log.d("WebViewScreen", "launcher result: data.data=${result.data?.data}")
        Log.d("WebViewScreen", "launcher result: data.clipData=${result.data?.clipData}")
        
        val uris = fileChooserLauncher.parseResult(result.resultCode, result.data)
        Log.d("WebViewScreen", "parseResult returned: ${uris?.contentToString()}")
        
        if (filePathCallback.value != null) {
            Log.d("WebViewScreen", "Calling onReceiveValue with uris")
            filePathCallback.value?.onReceiveValue(uris)
        } else {
            Log.e("WebViewScreen", "filePathCallback is NULL! Cannot return result to WebView")
        }
        filePathCallback.value = null
        fileChooserLauncher.clear()
    }

    // Helper functions FIRST (they don't depend on anything)
    fun hasGalleryPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_MEDIA_IMAGES
            ) == PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_MEDIA_VIDEO
            ) == PackageManager.PERMISSION_GRANTED
        } else {
            ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.READ_EXTERNAL_STORAGE
            ) == PackageManager.PERMISSION_GRANTED
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
            arrayOf(
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            )
        } else {
            arrayOf(Manifest.permission.READ_EXTERNAL_STORAGE)
        }
    }

    // THEN define cameraPermissionLauncher (used by galleryPermissionLauncher)
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

    // FINALLY define galleryPermissionLauncher (uses cameraPermissionLauncher and hasCameraPermission)
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

                    addJavascriptInterface(WebAppInterface(ctx, this), "AndroidBridge")

                    // 禁用滚动条
                    isVerticalScrollBarEnabled = false
                    isHorizontalScrollBarEnabled = false

                    // 禁用系统默认触觉反馈（如长按震动），由 JSBridge 显式控制
                    isHapticFeedbackEnabled = false

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
                            Log.d("WebViewScreen", "onShowFileChooser called, callback=$callback, params=$params")
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
@Composable
private fun WebViewUpdatePrompt(modifier: Modifier = Modifier) {
    val context = LocalContext.current
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "浏览器内核版本过低",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "请更新 Android System WebView 至版本 $MIN_WEBVIEW_VERSION 或以上，以确保应用正常运行。",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center
        )
        Spacer(modifier = Modifier.height(24.dp))
        Button(onClick = {
            try {
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, "market://details?id=com.google.android.webview".toUri())
                )
            } catch (_: Exception) {
                context.startActivity(
                    Intent(Intent.ACTION_VIEW, "https://play.google.com/store/apps/details?id=com.google.android.webview".toUri())
                )
            }
        }) {
            Text("前往更新")
        }
    }
}

/**
 * 版本号满足要求但无法加载 libwebviewchromium（常见于模拟器 ABI 与 WebView 包不一致、或安装不完整）。
 */
@Composable
private fun WebViewNativeLoadFailedPrompt(
    modifier: Modifier = Modifier,
    throwable: Throwable,
) {
    val context = LocalContext.current
    Column(
        modifier = modifier
            .fillMaxSize()
            .padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            text = "无法启动浏览器组件",
            style = MaterialTheme.typography.headlineSmall,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(modifier = Modifier.height(12.dp))
        Text(
            text = "系统已安装 Android System WebView，但无法加载其原生库。若在模拟器上出现，请改用与镜像 ABI 一致的 WebView（或带 Google Play 的 x86_64/arm64-v8a 镜像），或在 Play 商店重新安装「Android System WebView」。真机通常无此问题。",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
        if (BuildConfig.DEBUG) {
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = throwable.message ?: throwable.javaClass.simpleName,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        }
        Spacer(modifier = Modifier.height(24.dp))
        Button(
            onClick = {
                try {
                    context.startActivity(
                        Intent(Intent.ACTION_VIEW, "market://details?id=com.google.android.webview".toUri()),
                    )
                } catch (_: Exception) {
                    context.startActivity(
                        Intent(
                            Intent.ACTION_VIEW,
                            "https://play.google.com/store/apps/details?id=com.google.android.webview".toUri(),
                        ),
                    )
                }
            },
        ) {
            Text("打开 Play 商店")
        }
    }
}

private class WebAppInterface(
    private val context: android.content.Context,
    private val webView: WebView
) {
    @JavascriptInterface
    fun postMessage(message: String) {
        try {
            val json = JSONObject(message)
            val action = json.optString("action")

            if (action == "vibrate") {
                val type = json.optString("type", "impact")
                val style = json.optString("style", "medium")
                Log.d("WebAppInterface", "postMessage: action=$action, type=$type, style=$style")
                performHaptic(type, style)
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * 使用 View.performHapticFeedback() 产生细腻的触觉反馈（类似戳破气泡的轻触），
     * 而非 Vibrator 的嗡嗡马达震动。因 WebView 已关闭默认触觉反馈，需附加 FLAG_IGNORE_VIEW_SETTING。
     */
    private fun performHaptic(type: String, style: String) {
        val feedbackConstant = when (type) {
            "notification" -> when (style) {
                "success", "warning", "error" -> HapticFeedbackConstants.VIRTUAL_KEY
                else -> HapticFeedbackConstants.VIRTUAL_KEY
            }
            "selection" -> HapticFeedbackConstants.VIRTUAL_KEY
            else -> when (style) {
                "light", "soft" -> HapticFeedbackConstants.VIRTUAL_KEY
                "medium" -> HapticFeedbackConstants.LONG_PRESS
                "heavy", "rigid" -> HapticFeedbackConstants.LONG_PRESS
                else -> HapticFeedbackConstants.VIRTUAL_KEY
            }
        }

        Log.d("WebAppInterface", "performHaptic: type=$type, style=$style, constant=$feedbackConstant")
        webView.performHapticFeedback(
            feedbackConstant,
            HapticFeedbackConstants.FLAG_IGNORE_VIEW_SETTING
        )
    }
}