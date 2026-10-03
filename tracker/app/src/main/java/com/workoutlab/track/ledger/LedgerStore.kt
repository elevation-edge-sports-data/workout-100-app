package com.workoutlab.track.ledger

import android.content.Context
import com.workoutlab.track.data.db.SESSION_COMPLETE
import com.workoutlab.track.data.db.SessionEntity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import java.io.File
import java.util.UUID

/** Phone ledger. Snapshot lives in filesDir/lab/lab.json. GPS stays in Room. */
class LedgerStore(context: Context) {
    private val file = File(File(context.applicationContext.filesDir, "lab"), "lab.json")
    private val mutex = Mutex()
    private val _profile = MutableStateFlow(LabProfile.seed())
    val profile: StateFlow<LabProfile> = _profile.asStateFlow()
    private val _status = MutableStateFlow("Ready.")
    val status: StateFlow<String> = _status.asStateFlow()

    init {
        _profile.value = loadOrSeed()
    }

    fun setStatus(message: String) {
        _status.value = message
    }

    suspend fun addManual(exerciseId: String, points: Double, timestamp: Long) {
        if (!points.isFinite() || points == 0.0) {
            _status.value = "Enter a point value other than 0."
            return
        }
        mutex.withLock {
            val exercise = _profile.value.exercises.find { it.id == exerciseId }
                ?: _profile.value.exercises.firstOrNull()
            if (exercise == null) {
                _status.value = "No exercise to log."
                return@withLock
            }
            val event = LabEvent(
                id = "evt_${UUID.randomUUID()}",
                kind = "workout",
                points = points,
                timestamp = timestamp,
                categoryId = exercise.categoryId,
                exerciseId = exercise.id,
                source = "manual",
            )
            val next = ensureOnFoot(_profile.value.copy(events = _profile.value.events + event))
            _profile.value = next
            write(next)
            _status.value = "Added ${formatPoints(points)} pt · ${exercise.name}."
        }
    }

    suspend fun saveDayUp(day: String, upAt: Long) {
        mutex.withLock {
            val current = _profile.value
            val next = setDayUp(current, day, upAt, UUID.randomUUID().toString())
            if (next == current) return@withLock
            _profile.value = next
            write(next)
            _status.value = "Up ${formatClock(upAt)}."
        }
    }

    suspend fun saveDaySleep(day: String, sleepAt: Long?) {
        mutex.withLock {
            val current = _profile.value
            val next = setDaySleep(current, day, sleepAt, UUID.randomUUID().toString())
            if (next == current) return@withLock
            _profile.value = next
            write(next)
            _status.value = if (sleepAt == null) "Sleep cleared." else "Sleep ${formatClock(sleepAt)}."
        }
    }

    suspend fun saveUpNow(now: Long) {
        mutex.withLock {
            val current = _profile.value
            val stamped = applyUpNow(current, now, UUID.randomUUID().toString())
            if (stamped.profile == current) return@withLock
            _profile.value = stamped.profile
            write(stamped.profile)
            _status.value = "Up ${formatClock(now)}."
        }
    }

    suspend fun saveSleepNow(now: Long) {
        mutex.withLock {
            val current = _profile.value
            val next = applySleepNow(current, now, UUID.randomUUID().toString())
            if (next == current) return@withLock
            _profile.value = next
            write(next)
            _status.value = "Sleep ${formatClock(now)}."
        }
    }

    suspend fun recordFinished(session: SessionEntity) {
        reconcile(listOf(session))
    }

    suspend fun reconcile(sessions: List<SessionEntity>) {
        mutex.withLock {
            var events = _profile.value.events
            var added = 0
            for (session in sessions) {
                if (session.status != SESSION_COMPLETE) continue
                val event = trackerEvent(
                    sessionId = session.id,
                    distanceMeters = session.workoutDistanceMeters,
                    stoppedAtEpochMs = session.stoppedAtEpochMs,
                    rules = _profile.value.rules,
                ) ?: continue
                val next = upsertEvent(events, event)
                if (next !== events) {
                    events = next
                    added++
                }
            }
            if (added == 0) return@withLock
            val updated = ensureOnFoot(_profile.value.copy(events = events))
            _profile.value = updated
            write(updated)
        }
    }

    suspend fun importJson(text: String): String {
        val message = mutex.withLock {
            val merged = LabJson.merge(_profile.value, text)
            if (merged == null) {
                "Not a lab export."
            } else {
                _profile.value = merged.profile
                write(merged.profile)
                "Imported ${countLabel(merged.exercisesAdded, "exercise", "exercises")} · " +
                    "${countLabel(merged.eventsAdded, "event", "events")}."
            }
        }
        _status.value = message
        return message
    }

    suspend fun exportJson(): String = mutex.withLock { LabJson.export(_profile.value) }

    private fun loadOrSeed(): LabProfile {
        if (!file.exists()) {
            val seed = LabProfile.seed()
            write(seed)
            return seed
        }
        return try {
            val parsed = LabJson.readSnapshot(file.readText())
            if (parsed == null) {
                val seed = LabProfile.seed()
                write(seed)
                _status.value = "Lab file was reset."
                seed
            } else {
                parsed
            }
        } catch (_: Exception) {
            val seed = LabProfile.seed()
            write(seed)
            _status.value = "Lab file was reset."
            seed
        }
    }

    private fun write(profile: LabProfile) {
        val dir = file.parentFile
        if (dir != null && !dir.exists()) dir.mkdirs()
        file.writeText(LabJson.export(profile))
    }

    private fun countLabel(count: Int, singular: String, plural: String): String {
        return if (count == 1) "1 $singular" else "$count $plural"
    }
}
