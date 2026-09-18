package com.lilyco42.rembgui

import org.junit.Assert.assertEquals
import org.junit.Test

class BatchPolicyTest {
    @Test
    fun limitFollowsThePlanTier() {
        assertEquals(10, BatchPolicy.limit(10))
        assertEquals(50, BatchPolicy.limit(50))
        assertEquals(200, BatchPolicy.limit(200))
    }

    @Test
    fun limitStaysInsideFloorAndCeiling() {
        assertEquals(1, BatchPolicy.limit(0))
        assertEquals(1, BatchPolicy.limit(-5))
        assertEquals(200, BatchPolicy.limit(100_000))
    }
}
