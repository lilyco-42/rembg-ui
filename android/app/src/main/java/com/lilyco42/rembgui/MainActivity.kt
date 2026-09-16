package com.lilyco42.rembgui

import android.app.ActivityManager
import android.content.ContentValues
import android.content.ClipData
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.FileProvider
import com.google.android.material.appbar.MaterialToolbar
import java.io.BufferedOutputStream
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.Locale
import java.util.concurrent.Executors
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream
import org.json.JSONArray
import org.json.JSONObject

class MainActivity : AppCompatActivity() {

    private lateinit var toolbar: MaterialToolbar
    private lateinit var preview: ImageView
    private lateinit var emptyHint: TextView
    private lateinit var progress: ProgressBar
    private lateinit var pickBtn: Button
    private lateinit var runBtn: Button
    private lateinit var saveBtn: Button
    private lateinit var modelLabel: TextView
    private lateinit var batchPickBtn: Button
    private lateinit var batchRunBtn: Button
    private lateinit var batchExportBtn: Button
    private lateinit var batchClearBtn: Button
    private lateinit var batchStatus: TextView

    private var source: Bitmap? = null
    private var result: Bitmap? = null
    private var showingResult = false

    private val io = Executors.newSingleThreadExecutor()
    private var remover: BackgroundRemover? = null
    private lateinit var store: ModelStore
    private var currentSpec: ModelSpec = ModelCatalog.all.first()
    private var downloadingId: String? = null
    private var modelList: LinearLayout? = null
    @Volatile
    private var loadGeneration = 0L
    private var loadingImage = false
    private var modelLoading = false
    private var singleRunning = false
    private var batchRunning = false
    @Volatile
    private var batchCancelRequested = false
    private var shareBusy = false
    private var saveBusy = false
    private lateinit var batchOutputDir: File
    private val batch = mutableListOf<BatchEntry>()
    private val memoryClassMb: Int by lazy {
        (getSystemService(ACTIVITY_SERVICE) as ActivityManager).memoryClass
    }

    private val pickImage = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) loadImage(uri)
    }

    private val pickBatch = registerForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments()
    ) { uris: List<Uri> ->
        if (uris.isNotEmpty()) selectBatch(uris)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        store = ModelStore(this)
        batchOutputDir = File(cacheDir, "batch-output").apply { mkdirs() }
        toolbar = findViewById(R.id.toolbar)
        toolbar.title = getString(R.string.app_name)
        toolbar.inflateMenu(R.menu.main)
        toolbar.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                R.id.action_models -> {
                    showModelDialog()
                    true
                }
                R.id.action_share -> {
                    shareResult()
                    true
                }
                R.id.action_purchase -> {
                    openPurchasePage()
                    true
                }
                else -> false
            }
        }
        preview = findViewById(R.id.preview)
        emptyHint = findViewById(R.id.emptyHint)
        progress = findViewById(R.id.progress)
        pickBtn = findViewById(R.id.pickBtn)
        runBtn = findViewById(R.id.runBtn)
        saveBtn = findViewById(R.id.saveBtn)
        modelLabel = findViewById(R.id.modelLabel)
        batchPickBtn = findViewById(R.id.batchPickBtn)
        batchRunBtn = findViewById(R.id.batchRunBtn)
        batchExportBtn = findViewById(R.id.batchExportBtn)
        batchClearBtn = findViewById(R.id.batchClearBtn)
        batchStatus = findViewById(R.id.batchStatus)
        restoreBatch()

        pickBtn.setOnClickListener { pickImage.launch("image/*") }
        runBtn.setOnClickListener { runRemove() }
        saveBtn.setOnClickListener { saveResult() }
        batchPickBtn.setOnClickListener { pickBatch.launch(arrayOf("image/png", "image/jpeg", "image/webp")) }
        batchRunBtn.setOnClickListener { if (batchRunning) batchCancelRequested = true else runBatch() }
        batchExportBtn.setOnClickListener { exportBatch() }
        batchClearBtn.setOnClickListener { clearBatch() }
        preview.setOnClickListener {
            if (source != null && result != null) {
                showingResult = !showingResult
                preview.setImageBitmap(if (showingResult) result else source)
                Toast.makeText(
                    this,
                    if (showingResult) R.string.showing_result else R.string.showing_original,
                    Toast.LENGTH_SHORT
                ).show()
            }
        }

        val savedId = getSharedPreferences("rembg", MODE_PRIVATE).getString(KEY_MODEL, "u2netp") ?: "u2netp"
        switchModel(ModelCatalog.byId(savedId), toast = false)

        handleIncoming(intent)
        updateBatchUi()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncoming(intent)
    }

    private fun handleIncoming(intent: Intent?) {
        val incoming = incomingUris(intent)
        if (incoming.size > 1) {
            selectBatch(incoming)
        } else {
            incoming.firstOrNull()?.let(::loadImage)
        }
    }

    private fun incomingUris(intent: Intent?): List<Uri> {
        if (intent == null) return emptyList()
        if (intent.action == Intent.ACTION_SEND_MULTIPLE) {
            val values = if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM)
            }
            return (values ?: clipUris(intent.clipData)).distinct()
        }
        if (intent.action == Intent.ACTION_SEND) {
            val uri = if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Intent.EXTRA_STREAM)
            }
            return listOfNotNull(uri).ifEmpty { clipUris(intent.clipData) }
        }
        return listOfNotNull(intent.data)
    }

    override fun onDestroy() {
        loadGeneration++
        batchCancelRequested = true
        io.shutdownNow()
        remover?.close()
        source?.recycle()
        result?.recycle()
        super.onDestroy()
    }

    private fun loadImage(uri: Uri) {
        if (singleRunning || batchRunning || modelLoading || saveBusy || shareBusy) return
        val request = ++loadGeneration
        loadingImage = true
        progress.visibility = View.VISIBLE
        pickBtn.isEnabled = false
        runBtn.isEnabled = false
        saveBtn.isEnabled = false
        toolbar.menu.findItem(R.id.action_share)?.isEnabled = false
        io.execute {
            try {
                val argb = decodeImage(uri)
                runOnUiThread {
                    if (request != loadGeneration || isFinishing || isDestroyed) {
                        argb.recycle()
                        return@runOnUiThread
                    }
                    source?.recycle()
                    result?.recycle()
                    source = argb
                    result = null
                    showingResult = false
                    preview.setImageBitmap(argb)
                    emptyHint.visibility = View.GONE
                    loadingImage = false
                    progress.visibility = View.GONE
                    pickBtn.isEnabled = true
                    runBtn.isEnabled = true
                    saveBtn.isEnabled = false
                    updateBatchUi()
                }
            } catch (e: Exception) {
                showLoadFailure(request, e.message ?: "")
            } catch (e: OutOfMemoryError) {
                showLoadFailure(request, getString(R.string.memory_limit))
            }
        }
    }

    private fun decodeImage(uri: Uri): Bitmap {
        val maxSideLimit = MemoryPolicy.decodeMaxSide(memoryClassMb)
        val decoded = ImageDecoder.decodeBitmap(ImageDecoder.createSource(contentResolver, uri)) { decoder, info, _ ->
            decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            val maxSide = maxOf(info.size.width, info.size.height)
            if (maxSide > maxSideLimit) {
                val scale = maxSideLimit.toFloat() / maxSide
                decoder.setTargetSize(
                    (info.size.width * scale).toInt().coerceAtLeast(1),
                    (info.size.height * scale).toInt().coerceAtLeast(1),
                )
            }
        }
        val argb = if (decoded.config == Bitmap.Config.ARGB_8888) {
            decoded
        } else {
            decoded.copy(Bitmap.Config.ARGB_8888, false)
        }
        if (argb !== decoded) decoded.recycle()
        return argb
    }

    private fun showLoadFailure(request: Long, message: String) {
        runOnUiThread {
            if (request != loadGeneration || isFinishing || isDestroyed) return@runOnUiThread
            loadingImage = false
            progress.visibility = View.GONE
            pickBtn.isEnabled = true
            runBtn.isEnabled = source != null
            saveBtn.isEnabled = result != null
            Toast.makeText(this, getString(R.string.load_failed, message), Toast.LENGTH_LONG).show()
        }
    }

    private fun runRemove() {
        if (loadingImage || modelLoading || singleRunning || batchRunning || saveBusy || shareBusy) return
        val src = source ?: return
        val engine = remover
        if (engine == null) {
            Toast.makeText(this, R.string.model_loading, Toast.LENGTH_SHORT).show()
            return
        }
        progress.visibility = View.VISIBLE
        singleRunning = true
        runBtn.isEnabled = false
        pickBtn.isEnabled = false
        updateBatchUi()
        io.execute {
            try {
                val out = engine.remove(src)
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    singleRunning = false
                    result?.recycle()
                    result = out
                    showingResult = true
                    preview.setImageBitmap(out)
                    saveBtn.isEnabled = true
                    toolbar.menu.findItem(R.id.action_share)?.isEnabled = true
                    progress.visibility = View.GONE
                    runBtn.isEnabled = true
                    pickBtn.isEnabled = true
                    updateBatchUi()
                    Toast.makeText(this, R.string.done_tap_compare, Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    singleRunning = false
                    progress.visibility = View.GONE
                    runBtn.isEnabled = true
                    pickBtn.isEnabled = true
                    updateBatchUi()
                    Toast.makeText(this, getString(R.string.run_failed, e.message ?: ""), Toast.LENGTH_LONG).show()
                }
            } catch (_: OutOfMemoryError) {
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    singleRunning = false
                    progress.visibility = View.GONE
                    runBtn.isEnabled = true
                    pickBtn.isEnabled = true
                    updateBatchUi()
                    Toast.makeText(this, R.string.memory_limit, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun saveResult() {
        val bmp = result ?: return
        if (saveBusy || shareBusy || singleRunning || batchRunning) return
        val name = "rembg_${System.currentTimeMillis()}.png"
        saveBusy = true
        pickBtn.isEnabled = false
        runBtn.isEnabled = false
        saveBtn.isEnabled = false
        progress.visibility = View.VISIBLE
        updateBatchUi()
        io.execute {
            val ok = try {
                saveBitmapToDownloads(bmp, name)
            } catch (_: Exception) {
                false
            }
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                saveBusy = false
                progress.visibility = View.GONE
                pickBtn.isEnabled = true
                runBtn.isEnabled = source != null
                saveBtn.isEnabled = result != null
                updateBatchUi()
                Toast.makeText(
                    this,
                    if (ok) getString(R.string.saved_download, name) else getString(R.string.save_failed),
                    Toast.LENGTH_SHORT,
                ).show()
            }
        }
    }

    private fun saveBitmapToDownloads(bmp: Bitmap, name: String): Boolean {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, "image/png")
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        if (uri == null) {
            return false
        }
        val ok = contentResolver.openOutputStream(uri)?.use {
            bmp.compress(Bitmap.CompressFormat.PNG, 100, it)
        } == true
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        contentResolver.update(uri, values, null, null)
        if (!ok) contentResolver.delete(uri, null, null)
        return ok
    }

    private fun selectBatch(uris: List<Uri>) {
        if (singleRunning || batchRunning || loadingImage || shareBusy || saveBusy) return
        releaseSinglePreview()
        clearBatchOutputs()
        batch.clear()
        val distinct = uris.distinct()
        distinct.take(MAX_BATCH_SIZE).forEach { uri ->
            // OpenMultipleDocuments grants read access for the selected URI. A
            // persistable grant is best-effort because some document providers
            // do not expose one; the current batch still works in this process.
            try {
                contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
            } catch (_: SecurityException) {
                // Non-persistable providers are common for cloud/photo pickers.
            }
            batch += BatchEntry(uri = uri, name = displayName(uri))
        }
        batchStatus.text = if (distinct.size > MAX_BATCH_SIZE) {
            getString(R.string.batch_too_many)
        } else {
            getString(R.string.batch_selected, batch.size)
        }
        persistBatch()
        updateBatchUi()
    }

    private fun releaseSinglePreview() {
        source?.let { if (!it.isRecycled) it.recycle() }
        result?.let { if (!it.isRecycled) it.recycle() }
        source = null
        result = null
        showingResult = false
        preview.setImageDrawable(null)
        emptyHint.visibility = View.VISIBLE
        toolbar.menu.findItem(R.id.action_share)?.isEnabled = false
        saveBtn.isEnabled = false
        runBtn.isEnabled = false
    }

    private fun clipUris(clipData: ClipData?): List<Uri> {
        if (clipData == null) return emptyList()
        return (0 until clipData.itemCount).mapNotNull { index -> clipData.getItemAt(index).uri }
    }

    private fun restoreBatch() {
        val raw = getSharedPreferences(BATCH_PREFS, MODE_PRIVATE).getString(BATCH_SESSION_KEY, null) ?: return
        try {
            val entries = JSONArray(raw)
            for (index in 0 until entries.length().coerceAtMost(MAX_BATCH_SIZE)) {
                val item = entries.optJSONObject(index) ?: continue
                val uriText = item.optString("uri").takeIf { it.isNotBlank() } ?: continue
                val name = item.optString("name").takeIf { it.isNotBlank() } ?: "image"
                val status = runCatching {
                    BatchStatus.valueOf(item.optString("status", "PENDING").uppercase(Locale.US))
                }.getOrDefault(BatchStatus.PENDING)
                val outputName = item.optString("output").takeIf { it.isNotBlank() }
                val output = outputName?.let { File(batchOutputDir, File(it).name) }
                val ready = status == BatchStatus.DONE && output?.isFile == true
                batch += BatchEntry(
                    uri = Uri.parse(uriText),
                    name = name,
                    status = if (ready) BatchStatus.DONE else BatchStatus.PENDING,
                    outputFile = if (ready) output else null,
                    error = item.optString("error").takeIf { it.isNotBlank() },
                )
            }
            if (batch.isNotEmpty()) {
                batchStatus.text = getString(R.string.batch_selected, batch.size)
            }
        } catch (_: Exception) {
            batch.clear()
            getSharedPreferences(BATCH_PREFS, MODE_PRIVATE).edit().remove(BATCH_SESSION_KEY).apply()
        }
    }

    private fun persistBatch() {
        if (!::batchOutputDir.isInitialized) return
        val entries = JSONArray().apply {
            batch.forEach { entry ->
                put(JSONObject().apply {
                    put("uri", entry.uri.toString())
                    put("name", entry.name)
                    put("status", if (entry.status == BatchStatus.PROCESSING) "pending" else entry.status.name.lowercase(Locale.US))
                    entry.outputFile?.let { put("output", it.name) }
                    entry.error?.let { put("error", it) }
                })
            }
        }
        getSharedPreferences(BATCH_PREFS, MODE_PRIVATE).edit()
            .putString(BATCH_SESSION_KEY, entries.toString())
            .apply()
    }

    private fun displayName(uri: Uri): String {
        contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
            if (cursor.moveToFirst()) {
                val index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (index >= 0) cursor.getString(index)?.takeIf { it.isNotBlank() }?.let { return it }
            }
        }
        return uri.lastPathSegment?.substringAfterLast('/')?.takeIf { it.isNotBlank() } ?: "image"
    }

    private fun updateBatchUi() {
        if (!::batchStatus.isInitialized) return
        val total = batch.size
        val done = batch.count { it.status == BatchStatus.DONE && it.outputFile?.isFile == true }
        val failed = batch.count { it.status == BatchStatus.ERROR }
        val pending = total - done - failed
        if (total == 0) {
            batchStatus.text = getString(R.string.batch_empty)
        } else if (!batchRunning && pending == 0) {
            batchStatus.text = getString(R.string.batch_finished, done, failed)
        } else {
            batchStatus.text = getString(R.string.batch_status, done, total, failed, pending)
        }
        val controlsReady = !singleRunning && !batchRunning && !modelLoading && !loadingImage && !shareBusy && !saveBusy
        toolbar.menu.findItem(R.id.action_models)?.isEnabled = controlsReady
        toolbar.menu.findItem(R.id.action_share)?.isEnabled = controlsReady && result != null
        batchPickBtn.isEnabled = controlsReady
        batchRunBtn.isEnabled = if (batchRunning) true else {
            !singleRunning && !modelLoading && !saveBusy &&
            remover != null && batch.any { it.status != BatchStatus.DONE || it.outputFile?.isFile != true }
        }
        batchRunBtn.text = if (batchRunning) getString(R.string.batch_cancel) else getString(R.string.batch_run)
        batchExportBtn.isEnabled = controlsReady && done > 0
        batchClearBtn.isEnabled = controlsReady && total > 0
    }

    private fun runBatch() {
        if (singleRunning || batchRunning || batch.isEmpty() || saveBusy || shareBusy) return
        val engine = remover
        if (engine == null) {
            Toast.makeText(this, R.string.model_loading, Toast.LENGTH_SHORT).show()
            return
        }
        batchCancelRequested = false
        batchRunning = true
        pickBtn.isEnabled = false
        runBtn.isEnabled = false
        saveBtn.isEnabled = false
        updateBatchUi()
        io.execute {
            var completed = 0
            var failed = 0
            for ((index, entry) in batch.withIndex()) {
                if (batchCancelRequested || Thread.currentThread().isInterrupted) break
                if (entry.status == BatchStatus.DONE && entry.outputFile?.isFile == true) {
                    completed++
                    continue
                }
                entry.status = BatchStatus.PROCESSING
                entry.error = null
                postBatchUi(getString(R.string.batch_processing, index + 1, batch.size))
                var input: Bitmap? = null
                var output: Bitmap? = null
                try {
                    input = decodeImage(entry.uri)
                    output = engine.remove(input)
                    val outputFile = File(batchOutputDir, batchOutputName(entry.name, index))
                    FileOutputStream(outputFile).use { stream ->
                        if (!output.compress(Bitmap.CompressFormat.PNG, 100, stream)) {
                            throw IllegalStateException("PNG 编码失败")
                        }
                    }
                    entry.outputFile = outputFile
                    entry.status = BatchStatus.DONE
                    completed++
                } catch (e: OutOfMemoryError) {
                    entry.status = BatchStatus.ERROR
                    entry.error = getString(R.string.memory_limit)
                    failed++
                } catch (e: Exception) {
                    entry.status = BatchStatus.ERROR
                    entry.error = e.message?.take(120) ?: "未知错误"
                    failed++
                } finally {
                    output?.let { if (!it.isRecycled) it.recycle() }
                    input?.let { if (!it.isRecycled) it.recycle() }
                    persistBatch()
                    postBatchUi(null)
                }
            }
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                batchRunning = false
                updateBatchUi()
                val remaining = batch.count { it.status != BatchStatus.DONE }
                if (batchCancelRequested) {
                    batchStatus.text = getString(R.string.batch_stopped, completed, remaining)
                } else {
                    batchStatus.text = getString(R.string.batch_finished, completed, failed)
                }
                pickBtn.isEnabled = true
                runBtn.isEnabled = source != null
                saveBtn.isEnabled = result != null
            }
        }
    }

    private fun postBatchUi(message: String?) {
        runOnUiThread {
            if (isFinishing || isDestroyed) return@runOnUiThread
            if (message != null) batchStatus.text = message
            updateBatchUi()
            if (message != null) batchStatus.text = message
        }
    }

    private fun clearBatch() {
        if (singleRunning || batchRunning || shareBusy || saveBusy) return
        clearBatchOutputs()
        batch.clear()
        batchCancelRequested = false
        persistBatch()
        updateBatchUi()
    }

    private fun clearBatchOutputs() {
        if (!::batchOutputDir.isInitialized) return
        batchOutputDir.listFiles()?.forEach { it.delete() }
    }

    private fun batchOutputName(sourceName: String, index: Int): String {
        val stem = sourceName.substringBeforeLast('.', sourceName)
            .replace(Regex("[^\\p{L}\\p{N}_-]+"), "_")
            .trim('_')
            .take(64)
            .ifBlank { "image" }
        return String.format(Locale.US, "%03d_%s.png", index + 1, stem)
    }

    private fun exportBatch() {
        if (singleRunning || batchRunning || shareBusy || saveBusy) return
        val done = batch.filter { it.status == BatchStatus.DONE && it.outputFile?.isFile == true }
        if (done.isEmpty()) {
            Toast.makeText(this, R.string.batch_no_done, Toast.LENGTH_SHORT).show()
            return
        }
        val totalBytes = done.sumOf { it.outputFile?.length() ?: 0L }
        if (totalBytes > MAX_EXPORT_BYTES) {
            Toast.makeText(this, getString(R.string.batch_export_failed, "文件总量超过 64 MiB"), Toast.LENGTH_LONG).show()
            return
        }
        batchExportBtn.isEnabled = false
        progress.visibility = View.VISIBLE
        io.execute {
            val zip = File(cacheDir, "rembg-batch-${System.currentTimeMillis()}.zip")
            try {
                ZipOutputStream(BufferedOutputStream(FileOutputStream(zip))).use { archive ->
                    for ((index, entry) in batch.withIndex()) {
                        val file = entry.outputFile ?: continue
                        if (entry.status != BatchStatus.DONE || !file.isFile) continue
                        archive.putNextEntry(ZipEntry(batchOutputName(entry.name, index)))
                        FileInputStream(file).use { input -> input.copyTo(archive, ZIP_BUFFER_SIZE) }
                        archive.closeEntry()
                    }
                    val manifest = JSONObject().apply {
                        put("version", 1)
                        put("model", currentSpec.id)
                        put("format", "png")
                        put("items", JSONArray().apply {
                            batch.forEachIndexed { index, entry ->
                                put(JSONObject().apply {
                                    put("source", entry.name)
                                    put("status", entry.status.name.lowercase(Locale.US))
                                    if (entry.status == BatchStatus.DONE) put("output", batchOutputName(entry.name, index))
                                    entry.error?.let { put("error", it) }
                                })
                            }
                        })
                    }.toString(2).toByteArray(Charsets.UTF_8)
                    archive.putNextEntry(ZipEntry("delivery-manifest.json"))
                    archive.write(manifest)
                    archive.closeEntry()
                }
                val name = "rembg-delivery-${System.currentTimeMillis()}.zip"
                val ok = saveFileToDownloads(zip, name, "application/zip")
                zip.delete()
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    progress.visibility = View.GONE
                    batchExportBtn.isEnabled = true
                    Toast.makeText(
                        this,
                        if (ok) getString(R.string.batch_exported, name)
                        else getString(R.string.batch_export_failed, getString(R.string.save_failed)),
                        Toast.LENGTH_LONG,
                    ).show()
                }
            } catch (e: Exception) {
                zip.delete()
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    progress.visibility = View.GONE
                    batchExportBtn.isEnabled = true
                    Toast.makeText(this, getString(R.string.batch_export_failed, e.message ?: "未知错误"), Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun saveFileToDownloads(file: File, name: String, mime: String): Boolean {
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
        return try {
            contentResolver.openOutputStream(uri)?.use { output ->
                FileInputStream(file).use { input -> input.copyTo(output, ZIP_BUFFER_SIZE) }
            } ?: error("无法打开下载目录")
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            contentResolver.update(uri, values, null, null)
            true
        } catch (_: Exception) {
            contentResolver.delete(uri, null, null)
            false
        }
    }

    private fun shareResult() {
        val bmp = result ?: return
        if (shareBusy || saveBusy || singleRunning || batchRunning) return
        shareBusy = true
        toolbar.menu.findItem(R.id.action_share)?.isEnabled = false
        pickBtn.isEnabled = false
        runBtn.isEnabled = false
        saveBtn.isEnabled = false
        batchPickBtn.isEnabled = false
        Toast.makeText(this, R.string.share_ready, Toast.LENGTH_SHORT).show()
        io.execute {
            val shareDir = File(cacheDir, "share").apply { mkdirs() }
            val file = File(shareDir, "rembg-result.png")
            try {
                FileOutputStream(file).use { stream ->
                    if (!bmp.compress(Bitmap.CompressFormat.PNG, 100, stream)) error("PNG 编码失败")
                }
                val uri = FileProvider.getUriForFile(this, "com.lilyco42.rembgui.fileprovider", file)
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    shareBusy = false
                    toolbar.menu.findItem(R.id.action_share)?.isEnabled = result != null
                    updateBatchUi()
                    pickBtn.isEnabled = true
                    runBtn.isEnabled = source != null
                    saveBtn.isEnabled = result != null
                    val send = Intent(Intent.ACTION_SEND).apply {
                        type = "image/png"
                        putExtra(Intent.EXTRA_STREAM, uri)
                        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                    }
                    startActivity(Intent.createChooser(send, getString(R.string.share)))
                }
            } catch (e: Exception) {
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    shareBusy = false
                    toolbar.menu.findItem(R.id.action_share)?.isEnabled = result != null
                    updateBatchUi()
                    pickBtn.isEnabled = true
                    runBtn.isEnabled = source != null
                    saveBtn.isEnabled = result != null
                    Toast.makeText(this, getString(R.string.share_failed, e.message ?: "未知错误"), Toast.LENGTH_LONG).show()
                }
            } catch (_: OutOfMemoryError) {
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    shareBusy = false
                    toolbar.menu.findItem(R.id.action_share)?.isEnabled = result != null
                    updateBatchUi()
                    pickBtn.isEnabled = true
                    runBtn.isEnabled = source != null
                    saveBtn.isEnabled = result != null
                    Toast.makeText(this, R.string.memory_limit, Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun openPurchasePage() {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(PURCHASE_URL)))
        } catch (e: Exception) {
            Toast.makeText(this, getString(R.string.purchase_failed, e.message ?: "无法打开浏览器"), Toast.LENGTH_LONG).show()
        }
    }

    private fun showModelDialog() {
        if (modelLoading || singleRunning || batchRunning || loadingImage || saveBusy || shareBusy) {
            Toast.makeText(this, R.string.model_busy, Toast.LENGTH_SHORT).show()
            return
        }
        val content = LayoutInflater.from(this).inflate(R.layout.dialog_models, null)
        modelList = content.findViewById(R.id.modelList)
        bindModelList()
        AlertDialog.Builder(this)
            .setTitle(R.string.models_title)
            .setView(content)
            .setNegativeButton(android.R.string.cancel, null)
            .setOnDismissListener { modelList = null }
            .show()
    }

    private fun bindModelList() {
        val list = modelList ?: return
        list.removeAllViews()
        val inflater = LayoutInflater.from(this)
        for (spec in ModelCatalog.all) {
            val row = inflater.inflate(R.layout.item_model, list, false)
            row.findViewById<TextView>(R.id.modelTitle).text = spec.title
            val ready = store.isReady(spec)
            val meta = row.findViewById<TextView>(R.id.modelMeta)
            val action = row.findViewById<Button>(R.id.modelAction)
            when {
                modelLoading || singleRunning -> {
                    meta.text = getString(R.string.model_loading)
                    action.text = getString(R.string.model_loading)
                    action.isEnabled = false
                }
                downloadingId == spec.id -> {
                    meta.text = getString(R.string.model_missing, spec.sizeLabel)
                    action.text = getString(R.string.model_progress, 0)
                    action.isEnabled = false
                }
                ready && currentSpec.id == spec.id -> {
                    meta.text = getString(R.string.model_ready, spec.sizeLabel)
                    action.text = getString(R.string.model_using)
                    action.isEnabled = false
                }
                ready -> {
                    meta.text = getString(R.string.model_ready, spec.sizeLabel)
                    action.text = getString(R.string.model_use)
                    action.setOnClickListener { switchModel(spec) }
                }
                else -> {
                    meta.text = getString(R.string.model_missing, spec.sizeLabel)
                    action.text = getString(R.string.model_download)
                    action.setOnClickListener { downloadModel(spec) }
                }
            }
            list.addView(row)
        }
    }

    private fun downloadModel(spec: ModelSpec) {
        if (singleRunning || batchRunning || modelLoading || saveBusy || shareBusy) return
        if (spec.url == null) {
            store.ensureBundled(spec)
            switchModel(spec)
            return
        }
        downloadingId = spec.id
        bindModelList()
        io.execute {
            try {
                store.download(spec) { read, total ->
                    if (total > 0) {
                        val pct = ((read * 100) / total).toInt()
                        runOnUiThread { updateDownloadProgress(spec.id, pct) }
                    }
                }
                runOnUiThread {
                    downloadingId = null
                    Toast.makeText(this, R.string.model_download_ok, Toast.LENGTH_SHORT).show()
                    switchModel(spec)
                    bindModelList()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    downloadingId = null
                    bindModelList()
                    Toast.makeText(this, getString(R.string.model_download_fail, e.message ?: ""), Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun updateDownloadProgress(id: String, pct: Int) {
        val list = modelList ?: return
        val index = ModelCatalog.all.indexOfFirst { it.id == id }
        if (index < 0 || index >= list.childCount) return
        val row = list.getChildAt(index)
        row.findViewById<Button>(R.id.modelAction).text = getString(R.string.model_progress, pct)
    }

    private fun switchModel(spec: ModelSpec, toast: Boolean = true) {
        if (modelLoading || singleRunning || batchRunning || saveBusy || shareBusy) return
        if (!store.isReady(spec)) {
            store.ensureBundled(spec)
        }
        if (!store.isReady(spec)) {
            if (spec.id != "u2netp") {
                switchModel(ModelCatalog.byId("u2netp"), toast)
            } else {
                Toast.makeText(this, R.string.model_loading, Toast.LENGTH_SHORT).show()
            }
            return
        }
        modelLoading = true
        bindModelList()
        updateBatchUi()
        io.execute {
            try {
                val next = BackgroundRemover(store.file(spec), spec, memoryClassMb)
                runOnUiThread {
                    if (isFinishing || isDestroyed) {
                        next.close()
                        return@runOnUiThread
                    }
                    val old = remover
                    remover = next
                    old?.close()
                    currentSpec = spec
                    modelLabel.text = getString(R.string.model_current, spec.title)
                    getSharedPreferences("rembg", MODE_PRIVATE).edit().putString(KEY_MODEL, spec.id).apply()
                    modelLoading = false
                    bindModelList()
                    updateBatchUi()
                    pickBtn.isEnabled = !loadingImage && !singleRunning && !batchRunning && !saveBusy && !shareBusy
                    runBtn.isEnabled = source != null && !loadingImage && !singleRunning && !batchRunning && !saveBusy && !shareBusy
                    saveBtn.isEnabled = result != null && !singleRunning && !batchRunning && !saveBusy && !shareBusy
                    if (toast) Toast.makeText(this, getString(R.string.model_switched, spec.title), Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    if (isFinishing || isDestroyed) return@runOnUiThread
                    modelLoading = false
                    bindModelList()
                    updateBatchUi()
                    pickBtn.isEnabled = !loadingImage && !singleRunning && !batchRunning && !saveBusy && !shareBusy
                    runBtn.isEnabled = source != null && !loadingImage && !singleRunning && !batchRunning && !saveBusy && !shareBusy
                    saveBtn.isEnabled = result != null && !singleRunning && !batchRunning && !saveBusy && !shareBusy
                    Toast.makeText(this, getString(R.string.model_failed, e.message ?: ""), Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    companion object {
        private const val KEY_MODEL = "model_id"
        private const val MAX_BATCH_SIZE = 10
        private const val MAX_EXPORT_BYTES = 64L * 1024L * 1024L
        private const val ZIP_BUFFER_SIZE = 64 * 1024
        private const val PURCHASE_URL = "https://lain42.top/sub/buy.html"
        private const val BATCH_PREFS = "rembg_batch"
        private const val BATCH_SESSION_KEY = "session"
    }
}

private enum class BatchStatus {
    PENDING,
    PROCESSING,
    DONE,
    ERROR,
}

private data class BatchEntry(
    val uri: Uri,
    val name: String,
    @Volatile var status: BatchStatus = BatchStatus.PENDING,
    @Volatile var outputFile: File? = null,
    @Volatile var error: String? = null,
)
