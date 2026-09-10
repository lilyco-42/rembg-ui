package com.lilyco42.rembgui

import ai.onnxruntime.OnnxTensor
import ai.onnxruntime.OrtEnvironment
import ai.onnxruntime.OrtSession
import android.graphics.Bitmap
import android.graphics.Color
import java.io.File
import java.nio.FloatBuffer
import kotlin.math.max
import kotlin.math.min

class BackgroundRemover(
    modelFile: File,
    private val spec: ModelSpec,
) : AutoCloseable {

    private val env: OrtEnvironment = OrtEnvironment.getEnvironment()
    private val session: OrtSession
    private val inputName: String
    private val outputName: String
    private val size: Int = spec.inputSize

    init {
        val opts = OrtSession.SessionOptions().apply {
            setIntraOpNumThreads(4)
            setOptimizationLevel(OrtSession.SessionOptions.OptLevel.ALL_OPT)
        }
        session = env.createSession(modelFile.absolutePath, opts)
        inputName = session.inputNames.iterator().next()
        outputName = session.outputNames.iterator().next()
    }

    fun remove(src: Bitmap): Bitmap {
        val software = if (src.config == Bitmap.Config.HARDWARE) {
            src.copy(Bitmap.Config.ARGB_8888, false)
        } else {
            src
        }
        val scaled = Bitmap.createScaledBitmap(software, size, size, true)
        val input = FloatArray(3 * size * size)
        val pixels = IntArray(size * size)
        scaled.getPixels(pixels, 0, size, 0, 0, size, size)
        if (scaled !== software) scaled.recycle()

        var maxC = 1f
        for (p in pixels) {
            maxC = max(maxC, Color.red(p) / 255f)
            maxC = max(maxC, Color.green(p) / 255f)
            maxC = max(maxC, Color.blue(p) / 255f)
        }
        val plane = size * size
        val mean = spec.mean
        val std = spec.std
        for (i in pixels.indices) {
            val p = pixels[i]
            val r = Color.red(p) / 255f / maxC
            val g = Color.green(p) / 255f / maxC
            val b = Color.blue(p) / 255f / maxC
            input[i] = (r - mean[0]) / std[0]
            input[plane + i] = (g - mean[1]) / std[1]
            input[plane * 2 + i] = (b - mean[2]) / std[2]
        }

        val mask = FloatArray(size * size)
        val shape = longArrayOf(1, 3, size.toLong(), size.toLong())
        OnnxTensor.createTensor(env, FloatBuffer.wrap(input), shape).use { tensor ->
            session.run(mapOf(inputName to tensor), setOf(outputName)).use { result ->
                val out = result[0] as OnnxTensor
                out.floatBuffer.get(mask)
            }
        }

        var mi = mask[0]
        var ma = mask[0]
        for (v in mask) {
            if (v < mi) mi = v
            if (v > ma) ma = v
        }
        val den = (ma - mi).coerceAtLeast(1e-6f)
        for (i in mask.indices) mask[i] = (mask[i] - mi) / den

        val w = software.width
        val h = software.height
        val outPixels = IntArray(w * h)
        software.getPixels(outPixels, 0, w, 0, 0, w, h)
        for (y in 0 until h) {
            val my = (y + 0.5f) * size / h - 0.5f
            for (x in 0 until w) {
                val mx = (x + 0.5f) * size / w - 0.5f
                val alpha = (sampleBilinear(mask, size, mx, my) * 255f).toInt().coerceIn(0, 255)
                val idx = y * w + x
                outPixels[idx] = (outPixels[idx] and 0x00FFFFFF) or (alpha shl 24)
            }
        }
        val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        out.setPixels(outPixels, 0, w, 0, 0, w, h)
        if (software !== src) software.recycle()
        return out
    }

    override fun close() {
        session.close()
    }

    companion object {
        private fun sampleBilinear(mask: FloatArray, size: Int, x: Float, y: Float): Float {
            val x0 = min(size - 1, max(0, kotlin.math.floor(x.toDouble()).toInt()))
            val y0 = min(size - 1, max(0, kotlin.math.floor(y.toDouble()).toInt()))
            val x1 = min(size - 1, x0 + 1)
            val y1 = min(size - 1, y0 + 1)
            val fx = (x - x0).coerceIn(0f, 1f)
            val fy = (y - y0).coerceIn(0f, 1f)
            val v00 = mask[y0 * size + x0]
            val v10 = mask[y0 * size + x1]
            val v01 = mask[y1 * size + x0]
            val v11 = mask[y1 * size + x1]
            val v0 = v00 + (v10 - v00) * fx
            val v1 = v01 + (v11 - v01) * fx
            return v0 + (v1 - v0) * fy
        }
    }
}
