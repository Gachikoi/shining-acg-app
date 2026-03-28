package club.shiningacg.ShiningAGCApp

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.MediaStore
import android.util.Log
import android.webkit.WebChromeClient
import androidx.core.content.FileProvider
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * File chooser launcher for WebView that handles both camera capture and gallery/file picker.
 * 
 * This class creates a combined intent that allows users to choose between:
 * - Taking a photo with the camera
 * - Selecting a file from the gallery/file system
 * 
 * Usage:
 * ```
 * val fileChooserLauncher = FileChooserLauncher(context, "${BuildConfig.APPLICATION_ID}.fileprovider")
 * val intent = fileChooserLauncher.createChooserIntent(fileChooserParams)
 * // Launch with Activity Result API
 * val result = fileChooserLauncher.parseResult(resultCode, data)
 * ```
 */
class FileChooserLauncher(
    private val context: Context,
    private val fileProviderAuthority: String
) {
    private var cameraPhotoUri: Uri? = null

    /**
     * Creates a combined intent for file chooser with camera and gallery options.
     *
     * @param params WebChromeClient.FileChooserParams containing MIME types and other constraints
     * @return Intent that presents both camera and gallery options to the user
     */
    fun createChooserIntent(params: WebChromeClient.FileChooserParams): Intent {
        Log.d("FileChooserLauncher", "createChooserIntent called")
        // Clear previous state to prevent pollution across invocations
        cameraPhotoUri = null
        
        // Create camera intent with temporary file
        val cameraResult = createCameraIntent()
        val cameraIntent = cameraResult?.first
        cameraPhotoUri = cameraResult?.second
        Log.d("FileChooserLauncher", "cameraIntent created: ${cameraIntent != null}")

        // Create gallery/file picker intent from params
        val galleryIntent = params.createIntent()
        Log.d("FileChooserLauncher", "galleryIntent created")

        // Combine into chooser dialog
        val chooserTitle = "选择文件"
        val chooserIntent = Intent.createChooser(galleryIntent, chooserTitle)

        // Add camera intent as an extra option if available
        cameraIntent?.let {
            chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(it))
        }
        Log.d("FileChooserLauncher", "chooserIntent created, has camera: ${cameraIntent != null}")

        return chooserIntent
    }

    /**
     * Parses the result from the file chooser activity.
     *
     * @param resultCode The result code from the activity (Activity.RESULT_OK, etc.)
     * @param data The intent data containing the selected file URI(s)
     * @return Array of URIs, or null if the operation was cancelled or failed
     */
    fun parseResult(resultCode: Int, data: Intent?): Array<Uri>? {
        Log.d("FileChooserLauncher", "parseResult called, resultCode: $resultCode")
        if (resultCode != android.app.Activity.RESULT_OK) {
            clear()
            Log.d("FileChooserLauncher", "parseResult returning null due to non-OK resultCode")
            return null
        }
        
        val isCameraResult = cameraPhotoUri != null && 
                             data?.data == null && 
                             data?.clipData == null
        
        val result = if (isCameraResult && cameraPhotoUri != null) {
            arrayOf(cameraPhotoUri!!)
        } else {
            val uris = WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            uris?.forEach { uri ->
                grantReadPermission(uri)
            }
            uris
        }
        
        Log.d("FileChooserLauncher", "parseResult returning: ${result?.contentToString()}")
        clear()
        return result
    }

    private fun grantReadPermission(uri: Uri) {
        try {
            context.grantUriPermission(
                context.packageName,
                uri,
                Intent.FLAG_GRANT_READ_URI_PERMISSION
            )
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    /**
     * Creates an intent for capturing an image with the camera.
     * Also creates a temporary file for storing the captured image.
     *
     * @return Pair of (camera intent, URI for the temp file) or null if creation failed
     */
    private fun createCameraIntent(): Pair<Intent, Uri>? {
        return try {
            // Create temporary file for the photo
            val photoFile = createImageFile()
            
            // Get content URI via FileProvider
            val photoUri = FileProvider.getUriForFile(
                context,
                fileProviderAuthority,
                photoFile
            )

            // Create camera capture intent
            val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
                // Grant write permission to the camera app for this URI
                putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
                addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }

            Log.d("FileChooserLauncher", "createCameraIntent succeeded")
            Pair(cameraIntent, photoUri)
        } catch (e: Exception) {
            Log.d("FileChooserLauncher", "createCameraIntent failed: ${e.message}")
            e.printStackTrace()
            null
        }
    }

    /**
     * Creates a temporary image file in the app's external files directory.
     *
     * @return File object for the temporary image
     */
    private fun createImageFile(): File {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFileName = "JPEG_${timeStamp}_"
        val storageDir = File(context.getExternalFilesDir(null), "Pictures")
        
        // Ensure directory exists
        if (!storageDir.exists()) {
            storageDir.mkdirs()
        }
        
        return File.createTempFile(imageFileName, ".jpg", storageDir)
    }

    /**
     * Clears the stored camera photo URI.
     * Call this after processing the result to avoid memory leaks.
     */
    fun clear() {
        cameraPhotoUri = null
    }
}
