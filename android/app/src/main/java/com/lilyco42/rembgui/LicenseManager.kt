package com.lilyco42.rembgui

import android.content.Context
import android.util.Base64
import net.i2p.crypto.eddsa.EdDSAEngine
import net.i2p.crypto.eddsa.EdDSAPublicKey
import net.i2p.crypto.eddsa.spec.EdDSANamedCurveTable
import net.i2p.crypto.eddsa.spec.EdDSAPublicKeySpec
import org.json.JSONObject
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Calendar
import java.util.Locale
import java.util.UUID

/**
 * Verifies the same ``ol1`` Ed25519 license used by the desktop build and
 * keeps a small local monthly usage counter for the native Android client.
 *
 * The counter is intentionally local: Android remains useful offline, while
 * the hosted billing service remains the source of truth for purchase,
 * refunds, revocation and cross-device usage.
 */
class LicenseManager(context: Context) {

    data class State(
        val licensed: Boolean,
        val planId: String,
        val label: String,
        val licenseId: String?,
        val expiresAt: Long?,
        val maxBatchImages: Int,
        val monthlyImages: Int,
    )

    data class Reservation(
        internal val subject: String,
        internal val period: String,
        internal val amount: Int,
        internal val limit: Int,
    )

    private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    private val lock = Any()
    private val deviceHash: String
    @Volatile
    private var state: State

    init {
        val deviceId = prefs.getString(KEY_DEVICE_ID, null) ?: UUID.randomUUID().toString().also {
            prefs.edit().putString(KEY_DEVICE_ID, it).apply()
        }
        deviceHash = sha256(deviceId)
        state = loadState()
    }

    fun currentState(): State = synchronized(lock) {
        state = refreshExpiry(state)
        state
    }

    fun token(): String = prefs.getString(KEY_TOKEN, "") ?: ""

    /** Validate and persist a token. An empty token intentionally returns to trial. */
    @Throws(LicenseException::class)
    fun activate(rawToken: String): State = synchronized(lock) {
        val token = rawToken.trim()
        val next = if (token.isEmpty()) {
            prefs.edit().remove(KEY_TOKEN).apply()
            trialState()
        } else {
            val verified = verify(token)
            prefs.edit().putString(KEY_TOKEN, token).apply()
            verified
        }
        state = next
        next
    }

    fun clear() = synchronized(lock) {
        prefs.edit().remove(KEY_TOKEN).apply()
        state = trialState()
    }

    /** Reserve one image before decoding/inference; null means the quota is full. */
    fun reserve(amount: Int = 1): Reservation? = synchronized(lock) {
        require(amount in 1..MAX_RESERVATION) { "用量请求无效" }
        state = refreshExpiry(state)
        val current = state
        val period = periodKey()
        val subject = subjectFor(current)
        val key = usageKey(subject, period)
        val used = prefs.getInt(key, 0).coerceAtLeast(0)
        if (used + amount > current.monthlyImages) return null
        // Commit the reservation before starting native inference. A process
        // kill must not silently lose a paid usage unit.
        if (!prefs.edit().putInt(key, used + amount).commit()) return null
        Reservation(subject, period, amount, current.monthlyImages)
    }

    /** Return a reservation after an inference or export failure. */
    fun release(reservation: Reservation?): Unit {
        synchronized(lock) {
            if (reservation == null) return
            val key = usageKey(reservation.subject, reservation.period)
            val used = prefs.getInt(key, 0).coerceAtLeast(0)
            prefs.edit().putInt(key, (used - reservation.amount).coerceAtLeast(0)).commit()
        }
    }

    fun usage(): Usage = synchronized(lock) {
        state = refreshExpiry(state)
        val period = periodKey()
        val used = prefs.getInt(usageKey(subjectFor(state), period), 0).coerceAtLeast(0)
        Usage(period, used, state.monthlyImages, (state.monthlyImages - used).coerceAtLeast(0))
    }

    data class Usage(val period: String, val used: Int, val limit: Int, val remaining: Int)

    enum class RemoteSyncStatus {
        SKIPPED,
        ACTIVE,
        REVOKED,
        UNAVAILABLE,
    }

    data class RemoteSyncResult(val status: RemoteSyncStatus, val state: State)

    /**
     * Check the hosted entitlement when connectivity is available. The token
     * is sent without any image or device data; a network failure deliberately
     * keeps the locally verified license usable for weak/offline networks.
     */
    fun syncRemote(): RemoteSyncResult {
        val savedToken = token().trim()
        if (savedToken.isEmpty()) {
            return RemoteSyncResult(RemoteSyncStatus.SKIPPED, currentState())
        }
        val planId = currentState().planId
        val product = remoteProductFor(planId)
            ?: return RemoteSyncResult(RemoteSyncStatus.SKIPPED, currentState())
        val active = remoteActive(savedToken, product)
            ?: return RemoteSyncResult(RemoteSyncStatus.UNAVAILABLE, currentState())

        return synchronized(lock) {
            // Do not let a late network response overwrite a token the user
            // replaced while the request was in flight.
            if (prefs.getString(KEY_TOKEN, "")?.trim() != savedToken) {
                return@synchronized RemoteSyncResult(RemoteSyncStatus.UNAVAILABLE, state)
            }
            if (!active) {
                prefs.edit().remove(KEY_TOKEN).commit()
                state = trialState()
                RemoteSyncResult(RemoteSyncStatus.REVOKED, state)
            } else {
                state = refreshExpiry(state)
                RemoteSyncResult(RemoteSyncStatus.ACTIVE, state)
            }
        }
    }

    fun summary(): String {
        val current = currentState()
        val usage = usage()
        val suffix = if (current.licensed && current.expiresAt != null) {
            " · 到期 ${formatDate(current.expiresAt)}"
        } else {
            ""
        }
        return "${current.label} · 本期剩余 ${usage.remaining}/${usage.limit} 张$suffix"
    }

    private fun loadState(): State {
        val saved = prefs.getString(KEY_TOKEN, "") ?: ""
        if (saved.isBlank()) return trialState()
        return try {
            verify(saved)
        } catch (_: LicenseException) {
            // Keep a bad/expired token out of the inference path. The user can
            // paste a replacement from the purchase page at any time.
            trialState()
        }
    }

    private fun refreshExpiry(value: State): State {
        if (!value.licensed || value.expiresAt == null) return value
        if (nowSeconds() < value.expiresAt) return value
        return trialState()
    }

    private fun verify(token: String): State {
        if (token.length > MAX_TOKEN_LENGTH) throw LicenseException("授权令牌过长")
        val parts = token.split('.')
        if (parts.size != 3 || parts[0] != TOKEN_VERSION) throw LicenseException("授权令牌格式无效")
        val payloadPart = parts[1]
        val signaturePart = parts[2]
        val payloadBytes = decode(payloadPart, "授权内容")
        val signature = decode(signaturePart, "授权签名")
        if (signature.size != SIGNATURE_BYTES) throw LicenseException("授权签名长度无效")

        try {
            val params = EdDSANamedCurveTable.getByName("Ed25519")
                ?: throw LicenseException("授权验证曲线不可用")
            val publicKey = EdDSAPublicKey(EdDSAPublicKeySpec(PUBLIC_KEY_BYTES, params))
            val verifier = EdDSAEngine().apply {
                initVerify(publicKey)
                update("$TOKEN_VERSION.$payloadPart".toByteArray(StandardCharsets.US_ASCII))
            }
            if (!verifier.verify(signature)) throw LicenseException("授权签名无效")
        } catch (error: LicenseException) {
            throw error
        } catch (error: Exception) {
            throw LicenseException("授权签名无效", error)
        }

        val payload = try {
            JSONObject(String(payloadBytes, StandardCharsets.UTF_8))
        } catch (error: Exception) {
            throw LicenseException("授权内容无效", error)
        }
        if (payload.optString("format") != FORMAT_VERSION) throw LicenseException("授权格式不支持")
        if (payload.optString("key_id") != PUBLIC_KEY_ID) throw LicenseException("授权密钥编号不匹配")
        val claims = payload.optJSONObject("claims") ?: throw LicenseException("授权声明缺失")
        if (claims.optInt("schema_version", -1) != 1) throw LicenseException("授权版本不支持")

        val licenseId = claims.optString("license_id").trim()
        val subject = claims.optString("subject").trim()
        val planId = claims.optString("plan_id").trim()
        if (licenseId.isEmpty() || licenseId.length > 128) throw LicenseException("授权编号无效")
        if (subject.isEmpty() || subject.length > 320) throw LicenseException("授权主体无效")
        val plan = PLANS[planId] ?: throw LicenseException("授权套餐不存在")
        val issuedAt = claims.optLong("issued_at", -1L)
        val expiresAt = claims.optLong("expires_at", -1L)
        if (issuedAt < 0L || expiresAt <= issuedAt || nowSeconds() !in issuedAt until expiresAt) {
            throw LicenseException("授权已过期或尚未生效")
        }
        val claimDeviceHash = claims.optString("device_hash", "").takeIf { it.isNotEmpty() }
        if (claimDeviceHash != null) {
            if (!claimDeviceHash.matches(DEVICE_HASH_PATTERN) || claimDeviceHash != deviceHash) {
                throw LicenseException("授权不适用于此设备")
            }
        }
        return State(
            licensed = true,
            planId = planId,
            label = plan.label,
            licenseId = licenseId,
            expiresAt = expiresAt,
            maxBatchImages = plan.maxBatchImages,
            monthlyImages = plan.monthlyImages,
        )
    }

    private fun trialState() = State(
        licensed = false,
        planId = "trial",
        label = "公开试用",
        licenseId = null,
        expiresAt = null,
        maxBatchImages = PLANS.getValue("trial").maxBatchImages,
        monthlyImages = PLANS.getValue("trial").monthlyImages,
    )

    private fun subjectFor(value: State): String = value.licenseId ?: "trial:$deviceHash"

    private fun usageKey(subject: String, period: String): String =
        "${KEY_USAGE_PREFIX}${sha256("$subject|$period")}"

    private fun periodKey(): String {
        val calendar = Calendar.getInstance(java.util.TimeZone.getTimeZone("UTC"), Locale.US)
        return String.format(Locale.US, "%04d-%02d", calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1)
    }

    private fun formatDate(seconds: Long): String {
        val calendar = Calendar.getInstance().apply { timeInMillis = seconds * 1000L }
        return String.format(Locale.US, "%04d-%02d-%02d", calendar.get(Calendar.YEAR), calendar.get(Calendar.MONTH) + 1, calendar.get(Calendar.DAY_OF_MONTH))
    }

    private fun decode(value: String, field: String): ByteArray {
        if (value.isEmpty() || !value.matches(BASE64URL_PATTERN)) throw LicenseException("${field}编码无效")
        return try {
            Base64.decode(value, Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)
        } catch (error: IllegalArgumentException) {
            throw LicenseException("${field}编码无效", error)
        }
    }

    private fun sha256(value: String): String = sha256(value.toByteArray(StandardCharsets.UTF_8))

    private fun sha256(value: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(value)
        .joinToString("") { "%02x".format(it.toInt() and 0xff) }

    private fun nowSeconds(): Long = System.currentTimeMillis() / 1000L

    private fun remoteActive(token: String, product: String): Boolean? {
        var connection: HttpURLConnection? = null
        return try {
            val body = JSONObject()
                .put("license_key", token)
                .put("product", product)
                .toString()
                .toByteArray(StandardCharsets.UTF_8)
            connection = (URL(REMOTE_VERIFY_URL).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                connectTimeout = REMOTE_CONNECT_TIMEOUT_MS
                readTimeout = REMOTE_READ_TIMEOUT_MS
                doOutput = true
                setRequestProperty("Content-Type", "application/json")
                setRequestProperty("Accept", "application/json")
                setFixedLengthStreamingMode(body.size)
            }
            OutputStreamWriter(connection.outputStream, StandardCharsets.UTF_8).use { writer ->
                writer.write(String(body, StandardCharsets.UTF_8))
            }
            if (connection.responseCode !in 200..299) return null
            InputStreamReader(connection.inputStream, StandardCharsets.UTF_8).use { reader ->
                val response = JSONObject(reader.readText())
                if (!response.has("active")) null else response.optBoolean("active")
            }
        } catch (_: Exception) {
            null
        } finally {
            connection?.disconnect()
        }
    }

    class LicenseException(message: String, cause: Throwable? = null) : Exception(message, cause)

    private data class Plan(val label: String, val maxBatchImages: Int, val monthlyImages: Int)

    companion object {
        private const val PREFS = "rembg_license"
        private const val KEY_TOKEN = "offline_token"
        private const val KEY_DEVICE_ID = "install_id"
        private const val KEY_USAGE_PREFIX = "usage_"
        private const val TOKEN_VERSION = "ol1"
        private const val FORMAT_VERSION = "rembg-offline-v1"
        private const val PUBLIC_KEY_ID = "rembg-2026"
        private const val MAX_TOKEN_LENGTH = 65_536
        private const val MAX_RESERVATION = 1_000
        private const val SIGNATURE_BYTES = 64
        private const val REMOTE_VERIFY_URL = "https://lain42.top/studio/api/verify"
        private const val REMOTE_CONNECT_TIMEOUT_MS = 3_000
        private const val REMOTE_READ_TIMEOUT_MS = 5_000
        private val BASE64URL_PATTERN = Regex("[A-Za-z0-9_-]+")
        private val DEVICE_HASH_PATTERN = Regex("[0-9a-f]{64}")
        private val PUBLIC_KEY_BYTES = Base64.decode(
            "ZxjlbtB-cmEwqMIVFjBiCR3C9YWKrRWGI6upwOLBjKI",
            Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP,
        )
        private val PLANS = mapOf(
            "trial" to Plan("公开试用", 10, 30),
            "creator" to Plan("创作者版", 50, 500),
            "studio" to Plan("小团队版", 200, 3_000),
        )

        private fun remoteProductFor(planId: String): String? = when (planId) {
            "creator" -> "rembg_creator"
            "studio" -> "rembg_studio"
            else -> null
        }
    }
}
