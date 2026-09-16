package com.lilyco42.rembgui

import org.junit.Assert.assertEquals
import org.junit.Test

class MemoryPolicyTest {
    @Test
    fun decodeLimitStepsDownForLowMemoryPhones() {
        assertEquals(1280, MemoryPolicy.decodeMaxSide(192))
        assertEquals(1536, MemoryPolicy.decodeMaxSide(256))
        assertEquals(2048, MemoryPolicy.decodeMaxSide(512))
    }

    @Test
    fun ortThreadsRespectBothCpuAndMemoryLimits() {
        assertEquals(1, MemoryPolicy.ortThreads(192, 8))
        assertEquals(2, MemoryPolicy.ortThreads(256, 8))
        assertEquals(2, MemoryPolicy.ortThreads(512, 2))
        assertEquals(4, MemoryPolicy.ortThreads(512, 8))
    }
}
