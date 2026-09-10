package com.lilyco42.rembgui

data class ModelSpec(
    val id: String,
    val title: String,
    val sizeLabel: String,
    val url: String?,
    val fileName: String,
    val inputSize: Int,
    val mean: FloatArray,
    val std: FloatArray,
    val bundledAsset: String? = null,
)

object ModelCatalog {
    private val IMAGENET_MEAN = floatArrayOf(0.485f, 0.456f, 0.406f)
    private val IMAGENET_STD = floatArrayOf(0.229f, 0.224f, 0.225f)
    private val BASE = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/"

    val all: List<ModelSpec> = listOf(
        ModelSpec(
            id = "u2netp",
            title = "u2netp（轻量，内置）",
            sizeLabel = "4.5 MB",
            url = null,
            fileName = "u2netp.onnx",
            inputSize = 320,
            mean = IMAGENET_MEAN,
            std = IMAGENET_STD,
            bundledAsset = "u2netp.onnx",
        ),
        ModelSpec(
            id = "silueta",
            title = "silueta",
            sizeLabel = "43 MB",
            url = BASE + "silueta.onnx",
            fileName = "silueta.onnx",
            inputSize = 320,
            mean = IMAGENET_MEAN,
            std = IMAGENET_STD,
        ),
        ModelSpec(
            id = "u2net_human_seg",
            title = "u2net 人像",
            sizeLabel = "176 MB",
            url = BASE + "u2net_human_seg.onnx",
            fileName = "u2net_human_seg.onnx",
            inputSize = 320,
            mean = IMAGENET_MEAN,
            std = IMAGENET_STD,
        ),
        ModelSpec(
            id = "u2net",
            title = "u2net 通用",
            sizeLabel = "176 MB",
            url = BASE + "u2net.onnx",
            fileName = "u2net.onnx",
            inputSize = 320,
            mean = IMAGENET_MEAN,
            std = IMAGENET_STD,
        ),
        ModelSpec(
            id = "isnet-anime",
            title = "isnet 动漫",
            sizeLabel = "176 MB · 1024",
            url = BASE + "isnet-anime.onnx",
            fileName = "isnet-anime.onnx",
            inputSize = 1024,
            mean = IMAGENET_MEAN,
            std = floatArrayOf(1f, 1f, 1f),
        ),
        ModelSpec(
            id = "isnet-general-use",
            title = "isnet 通用",
            sizeLabel = "176 MB · 1024",
            url = BASE + "isnet-general-use.onnx",
            fileName = "isnet-general-use.onnx",
            inputSize = 1024,
            mean = floatArrayOf(0.5f, 0.5f, 0.5f),
            std = floatArrayOf(1f, 1f, 1f),
        ),
        ModelSpec(
            id = "bria-rmbg",
            title = "bria-rmbg",
            sizeLabel = "约 200 MB · 1024",
            url = BASE + "bria-rmbg-2.0.onnx",
            fileName = "bria-rmbg.onnx",
            inputSize = 1024,
            mean = IMAGENET_MEAN,
            std = IMAGENET_STD,
        ),
    )

    fun byId(id: String): ModelSpec = all.firstOrNull { it.id == id } ?: all.first()
}
