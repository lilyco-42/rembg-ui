package com.lilyco42.rembgui

/**
 * Conservative limits for phones with different memory classes.
 *
 * Android reports memory in MiB, while the image decoder and ONNX Runtime also
 * allocate native buffers that are not visible to the Kotlin heap. Keeping the
 * policy pure makes the choices explicit and prevents a large camera image from
 * starving the process on entry-level devices.
 */
object MemoryPolicy {
    fun decodeMaxSide(memoryClassMb: Int): Int = when {
        memoryClassMb <= 192 -> 1280
        memoryClassMb <= 256 -> 1536
        else -> 2048
    }

    fun ortThreads(memoryClassMb: Int, availableProcessors: Int): Int {
        val cpuLimit = availableProcessors.coerceAtLeast(1)
        val memoryLimit = when {
            memoryClassMb <= 192 -> 1
            memoryClassMb <= 256 -> 2
            else -> 4
        }
        return minOf(cpuLimit, memoryLimit)
    }
}
