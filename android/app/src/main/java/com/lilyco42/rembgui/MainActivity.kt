package com.lilyco42.rembgui

import android.content.ContentValues
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
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
import com.google.android.material.appbar.MaterialToolbar
import java.util.concurrent.Executors

class MainActivity : AppCompatActivity() {

    private lateinit var preview: ImageView
    private lateinit var emptyHint: TextView
    private lateinit var progress: ProgressBar
    private lateinit var pickBtn: Button
    private lateinit var runBtn: Button
    private lateinit var saveBtn: Button
    private lateinit var modelLabel: TextView

    private var source: Bitmap? = null
    private var result: Bitmap? = null
    private var showingResult = false

    private val io = Executors.newSingleThreadExecutor()
    private var remover: BackgroundRemover? = null
    private lateinit var store: ModelStore
    private var currentSpec: ModelSpec = ModelCatalog.all.first()
    private var downloadingId: String? = null
    private var modelList: LinearLayout? = null

    private val pickImage = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri: Uri? ->
        if (uri != null) loadImage(uri)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        store = ModelStore(this)
        val toolbar = findViewById<MaterialToolbar>(R.id.toolbar)
        toolbar.title = getString(R.string.app_name)
        toolbar.inflateMenu(R.menu.main)
        toolbar.setOnMenuItemClickListener { item ->
            if (item.itemId == R.id.action_models) {
                showModelDialog()
                true
            } else false
        }
        preview = findViewById(R.id.preview)
        emptyHint = findViewById(R.id.emptyHint)
        progress = findViewById(R.id.progress)
        pickBtn = findViewById(R.id.pickBtn)
        runBtn = findViewById(R.id.runBtn)
        saveBtn = findViewById(R.id.saveBtn)
        modelLabel = findViewById(R.id.modelLabel)

        pickBtn.setOnClickListener { pickImage.launch("image/*") }
        runBtn.setOnClickListener { runRemove() }
        saveBtn.setOnClickListener { saveResult() }
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
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncoming(intent)
    }

    private fun handleIncoming(intent: Intent?) {
        val uri = incomingUri(intent) ?: return
        loadImage(uri)
    }

    private fun incomingUri(intent: Intent?): Uri? {
        if (intent == null) return null
        if (intent.action == Intent.ACTION_SEND) {
            return if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(Intent.EXTRA_STREAM)
            }
        }
        return intent.data
    }

    override fun onDestroy() {
        io.shutdownNow()
        remover?.close()
        super.onDestroy()
    }

    private fun loadImage(uri: Uri) {
        try {
            val decoded = ImageDecoder.decodeBitmap(ImageDecoder.createSource(contentResolver, uri)) { decoder, info, _ ->
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
                val maxSide = maxOf(info.size.width, info.size.height)
                if (maxSide > 2048) {
                    val scale = 2048f / maxSide
                    decoder.setTargetSize(
                        (info.size.width * scale).toInt().coerceAtLeast(1),
                        (info.size.height * scale).toInt().coerceAtLeast(1)
                    )
                }
            }
            val argb = decoded.copy(Bitmap.Config.ARGB_8888, false)
            if (argb !== decoded) decoded.recycle()
            source?.recycle()
            result?.recycle()
            source = argb
            result = null
            showingResult = false
            preview.setImageBitmap(argb)
            emptyHint.visibility = View.GONE
            runBtn.isEnabled = true
            saveBtn.isEnabled = false
        } catch (e: Exception) {
            Toast.makeText(this, getString(R.string.load_failed, e.message ?: ""), Toast.LENGTH_LONG).show()
        }
    }

    private fun runRemove() {
        val src = source ?: return
        val engine = remover
        if (engine == null) {
            Toast.makeText(this, R.string.model_loading, Toast.LENGTH_SHORT).show()
            return
        }
        progress.visibility = View.VISIBLE
        runBtn.isEnabled = false
        pickBtn.isEnabled = false
        io.execute {
            try {
                val out = engine.remove(src)
                runOnUiThread {
                    result?.recycle()
                    result = out
                    showingResult = true
                    preview.setImageBitmap(out)
                    saveBtn.isEnabled = true
                    progress.visibility = View.GONE
                    runBtn.isEnabled = true
                    pickBtn.isEnabled = true
                    Toast.makeText(this, R.string.done_tap_compare, Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    progress.visibility = View.GONE
                    runBtn.isEnabled = true
                    pickBtn.isEnabled = true
                    Toast.makeText(this, getString(R.string.run_failed, e.message ?: ""), Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun saveResult() {
        val bmp = result ?: return
        val name = "rembg_${System.currentTimeMillis()}.png"
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, name)
            put(MediaStore.Downloads.MIME_TYPE, "image/png")
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        if (uri == null) {
            Toast.makeText(this, R.string.save_failed, Toast.LENGTH_SHORT).show()
            return
        }
        val ok = contentResolver.openOutputStream(uri)?.use {
            bmp.compress(Bitmap.CompressFormat.PNG, 100, it)
        } == true
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        contentResolver.update(uri, values, null, null)
        Toast.makeText(
            this,
            if (ok) getString(R.string.saved_download, name) else getString(R.string.save_failed),
            Toast.LENGTH_SHORT
        ).show()
    }

    private fun showModelDialog() {
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
        currentSpec = spec
        modelLabel.text = getString(R.string.model_current, spec.title)
        getSharedPreferences("rembg", MODE_PRIVATE).edit().putString(KEY_MODEL, spec.id).apply()
        io.execute {
            try {
                val next = BackgroundRemover(store.file(spec), spec)
                val old = remover
                remover = next
                old?.close()
                runOnUiThread {
                    bindModelList()
                    if (toast) Toast.makeText(this, getString(R.string.model_switched, spec.title), Toast.LENGTH_SHORT).show()
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this, getString(R.string.model_failed, e.message ?: ""), Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    companion object {
        private const val KEY_MODEL = "model_id"
    }
}
