package com.lilyco42.rembgui

/**
 * Batch sizing policy, kept free of Android types so the plan tiers and their
 * ceiling are unit-testable on the JVM.
 */
object BatchPolicy {
    /** Upper bound for any batch limit, so a malformed plan cannot queue unbounded work. */
    const val MAX_CEILING = 200

    fun limit(planMaxBatchImages: Int): Int = planMaxBatchImages.coerceIn(1, MAX_CEILING)
}
