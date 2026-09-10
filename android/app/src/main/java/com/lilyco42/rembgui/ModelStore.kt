package com.lilyco42.rembgui

import android.content.Context
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

class ModelStore(private val context: Context) {

    val dir: File = File(context.filesDir, "models").apply { mkdirs() }

    fun file(spec: ModelSpec): File = File(dir, spec.fileName)

    fun isReady(spec: ModelSpec): Boolean {
        val f = file(spec)
        return f.exists() && f.length() > 0L
    }

    fun ensureBundled(spec: ModelSpec) {
        val asset = spec.bundledAsset ?: return
        val dest = file(spec)
        if (dest.exists() && dest.length() > 0L) return
        context.assets.open(asset).use { input ->
            dest.outputStream().use { output -> input.copyTo(output) }
        }
    }

    fun download(spec: ModelSpec, onProgress: (Long, Long) -> Unit) {
        val url = spec.url ?: return
        val dest = file(spec)
        if (dest.exists() && dest.length() > 0L) return
        val tmp = File(dir, spec.fileName + ".part")
        if (tmp.exists()) tmp.delete()
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            instanceFollowRedirects = true
            connectTimeout = 30_000
            readTimeout = 60_000
            setRequestProperty("User-Agent", "RembgStudio-Android")
        }
        try {
            conn.connect()
            val code = conn.responseCode
            if (code !in 200..299) {
                throw IllegalStateException("HTTP $code")
            }
            val total = conn.contentLengthLong
            conn.inputStream.use { input ->
                tmp.outputStream().use { output ->
                    val buf = ByteArray(64 * 1024)
                    var read = 0L
                    while (true) {
                        val n = input.read(buf)
                        if (n <= 0) break
                        output.write(buf, 0, n)
                        read += n
                        onProgress(read, total)
                    }
                }
            }
            if (!tmp.renameTo(dest)) {
                tmp.copyTo(dest, overwrite = true)
                tmp.delete()
            }
        } finally {
            conn.disconnect()
            if (tmp.exists() && (!dest.exists() || dest.length() == 0L)) {
                tmp.delete()
            }
        }
    }

    fun delete(spec: ModelSpec) {
        if (spec.bundledAsset != null) return
        file(spec).delete()
        File(dir, spec.fileName + ".part").delete()
    }
}
