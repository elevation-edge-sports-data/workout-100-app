package com.workoutlab.track.ledger

import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

data class DayScore(
    val day: String,
    val rawWorkout: Double,
    val incoming: Double,
    val towardCap: Double,
    val overflowOut: Double,
    val work: Double,
    val reward: Double,
)

fun milesToPoints(miles: Double, milesPerPoint: Double?): Int {
    if (milesPerPoint == null || milesPerPoint <= 0.0 || !miles.isFinite()) return 0
    return floor(miles / milesPerPoint).toInt()
}

fun localDayKey(ts: Long): String {
    val cal = Calendar.getInstance()
    cal.timeInMillis = ts
    return "%04d-%02d-%02d".format(
        Locale.US,
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH) + 1,
        cal.get(Calendar.DAY_OF_MONTH),
    )
}

fun addDays(key: String, n: Int): String {
    val parts = key.split("-")
    val cal = Calendar.getInstance()
    cal.set(Calendar.YEAR, parts[0].toInt())
    cal.set(Calendar.MONTH, parts[1].toInt() - 1)
    cal.set(Calendar.DAY_OF_MONTH, parts[2].toInt())
    cal.set(Calendar.HOUR_OF_DAY, 12)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    cal.add(Calendar.DAY_OF_MONTH, n)
    return localDayKey(cal.timeInMillis)
}

private val DAY_KEY = Regex("""^\d{4}-\d{2}-\d{2}$""")

fun isDayKey(day: String): Boolean = DAY_KEY.matches(day)

/** Minutes since midnight for an `HH:mm` clock. Blank or invalid uses 06:00. */
fun wakeMinutes(wakeTime: String?): Int {
    val fallback = 6 * 60
    if (wakeTime.isNullOrBlank()) return fallback
    val match = Regex("""^(\d{1,2}):(\d{2})$""").matchEntire(wakeTime.trim()) ?: return fallback
    val hour = match.groupValues[1].toInt()
    val minute = match.groupValues[2].toInt()
    if (hour !in 0..23 || minute !in 0..59) return fallback
    return hour * 60 + minute
}

private fun stampCovers(stamp: DayStamp, ts: Long): Boolean {
    if (!isDayKey(stamp.day) || ts < stamp.upAt) return false
    val sleep = stamp.sleepAt ?: return true
    if (sleep <= stamp.upAt) return false
    return ts < sleep
}

/** No stamp covers `ts`. Split at `wakeTime` (default 06:00). Does not write a stamp. */
fun fallbackLabDayKey(ts: Long, wakeTime: String?): String {
    val cal = Calendar.getInstance()
    cal.timeInMillis = ts
    val minutes = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
    val calendar = localDayKey(ts)
    if (minutes < wakeMinutes(wakeTime)) return addDays(calendar, -1)
    return calendar
}

/**
 * Lab day of `ts`. Stamp windows win (`upAt <= ts`, and `sleepAt` missing or `ts < sleepAt`).
 * The latest `upAt` wins; a tie keeps the later stamp. Otherwise `wakeTime`.
 */
fun labDayKey(ts: Long, wakeTime: String?, dayStamps: List<DayStamp>): String {
    var best: DayStamp? = null
    for (stamp in dayStamps) {
        if (!stampCovers(stamp, ts)) continue
        val current = best
        if (current == null || stamp.upAt >= current.upAt) best = stamp
    }
    val chosen = best
    if (chosen != null) return chosen.day
    return fallbackLabDayKey(ts, wakeTime)
}

fun labDayKey(ts: Long, profile: LabProfile): String =
    labDayKey(ts, profile.rules.wakeTime, profile.dayStamps)

/**
 * Set `sleepAt` on every open stamp that has already started (`upAt <= atTs`).
 * Does not create a stamp.
 */
fun closeOpenDay(profile: LabProfile, atTs: Long): LabProfile {
    if (profile.dayStamps.isEmpty()) return profile
    var changed = false
    val next = profile.dayStamps.map { stamp ->
        if (stamp.sleepAt != null || stamp.upAt > atTs) {
            stamp
        } else {
            changed = true
            stamp.copy(sleepAt = atTs)
        }
    }
    if (!changed) return profile
    return profile.copy(dayStamps = next)
}

fun noonOnDay(key: String): Long {
    val parts = key.split("-")
    val cal = Calendar.getInstance()
    cal.set(Calendar.YEAR, parts[0].toInt())
    cal.set(Calendar.MONTH, parts[1].toInt() - 1)
    cal.set(Calendar.DAY_OF_MONTH, parts[2].toInt())
    cal.set(Calendar.HOUR_OF_DAY, 12)
    cal.set(Calendar.MINUTE, 0)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}

private val CLOCK = Regex("""^(\d{1,2}):(\d{2})(?::\d{2})?$""")

/** `HH:mm` on a calendar day. Invalid clocks return null. */
fun timeOnDay(day: String, hhmm: String?): Long? {
    if (!isDayKey(day) || hhmm.isNullOrBlank()) return null
    val match = CLOCK.matchEntire(hhmm.trim()) ?: return null
    val hour = match.groupValues[1].toInt()
    val minute = match.groupValues[2].toInt()
    if (hour !in 0..23 || minute !in 0..59) return null
    val parts = day.split("-")
    val cal = Calendar.getInstance()
    cal.clear()
    cal.set(Calendar.YEAR, parts[0].toInt())
    cal.set(Calendar.MONTH, parts[1].toInt() - 1)
    cal.set(Calendar.DAY_OF_MONTH, parts[2].toInt())
    cal.set(Calendar.HOUR_OF_DAY, hour)
    cal.set(Calendar.MINUTE, minute)
    cal.set(Calendar.SECOND, 0)
    cal.set(Calendar.MILLISECOND, 0)
    return cal.timeInMillis
}

fun formatClock(ts: Long): String {
    val cal = Calendar.getInstance()
    cal.timeInMillis = ts
    return "%02d:%02d".format(Locale.US, cal.get(Calendar.HOUR_OF_DAY), cal.get(Calendar.MINUTE))
}

fun formatDayLabel(day: String): String {
    if (!isDayKey(day)) return day
    return SimpleDateFormat("EEE, MMM d", Locale.getDefault()).format(Date(noonOnDay(day)))
}

fun stampOnDay(dayStamps: List<DayStamp>, day: String): DayStamp? {
    var best: DayStamp? = null
    for (stamp in dayStamps) {
        if (stamp.day != day) continue
        val current = best
        if (current == null || stamp.upAt >= current.upAt) best = stamp
    }
    return best
}

/**
 * Write Up for `day`. A new stamp closes any other open day at `upAt`.
 * Editing the day's existing stamp does not close it.
 */
fun setDayUp(profile: LabProfile, day: String, upAt: Long, newId: String): LabProfile {
    if (!isDayKey(day) || newId.isEmpty()) return profile
    val existing = stampOnDay(profile.dayStamps, day)
    val dayKey = localDayKey(upAt)
    if (existing != null) {
        val keptSleep = existing.sleepAt?.takeIf { it > upAt }
        val updated = existing.copy(day = dayKey, upAt = upAt, sleepAt = keptSleep)
        if (updated == existing) return profile
        return profile.copy(
            dayStamps = profile.dayStamps.map { stamp -> if (stamp.id == existing.id) updated else stamp },
        )
    }
    val closed = closeOpenDay(profile, upAt)
    val stamp = DayStamp(id = newId, day = dayKey, upAt = upAt)
    return closed.copy(dayStamps = closed.dayStamps + stamp)
}

/** Sleep clock on `day`. A clock that is not after Up lands on the next calendar date. */
fun sleepInstant(day: String, hhmm: String, upAt: Long): Long? {
    val same = timeOnDay(day, hhmm) ?: return null
    if (same > upAt) return same
    val next = timeOnDay(addDays(day, 1), hhmm) ?: return null
    return if (next > upAt) next else null
}

/** `sleepAt` null clears Sleep and leaves the stamp open. No stamp yet uses the fallback wake time as Up. */
fun setDaySleep(profile: LabProfile, day: String, sleepAt: Long?, newId: String): LabProfile {
    if (!isDayKey(day)) return profile
    val existing = stampOnDay(profile.dayStamps, day)
    if (sleepAt == null) {
        if (existing == null || existing.sleepAt == null) return profile
        return profile.copy(
            dayStamps = profile.dayStamps.map { stamp ->
                if (stamp.id == existing.id) stamp.copy(sleepAt = null) else stamp
            },
        )
    }
    if (newId.isEmpty()) return profile
    if (existing == null) {
        val upAt = timeOnDay(day, profile.rules.wakeTime) ?: timeOnDay(day, "06:00") ?: return profile
        if (sleepAt <= upAt) return profile
        val stamp = DayStamp(id = newId, day = localDayKey(upAt), upAt = upAt, sleepAt = sleepAt)
        return profile.copy(dayStamps = profile.dayStamps + stamp)
    }
    if (sleepAt <= existing.upAt || existing.sleepAt == sleepAt) return profile
    return profile.copy(
        dayStamps = profile.dayStamps.map { stamp ->
            if (stamp.id == existing.id) stamp.copy(sleepAt = sleepAt) else stamp
        },
    )
}

data class StampedDay(val profile: LabProfile, val day: String)

/**
 * Up at `now`. The stamp day is the local date of that instant.
 * An earlier open stamp is closed at `now`.
 */
fun applyUpNow(profile: LabProfile, now: Long, newId: String): StampedDay {
    val day = localDayKey(now)
    return StampedDay(setDayUp(profile, day, now, newId), day)
}

/** Sleep at `now` on the lab day that contains `now`. */
fun applySleepNow(profile: LabProfile, now: Long, newId: String): LabProfile {
    return setDaySleep(profile, labDayKey(now, profile), now, newId)
}

/**
 * Point time on a lab day. Blank uses noon when that noon belongs to `day`,
 * otherwise Up, otherwise the fallback wake time. A clock uses that time on
 * `day`, or the next calendar date when that is the instant on the lab day.
 * Returns null when the instant would score on a different day.
 */
fun manualPointTimestamp(profile: LabProfile, day: String, hhmm: String?): Long? {
    if (!isDayKey(day)) return null
    val trimmed = hhmm?.trim().orEmpty()
    if (trimmed.isEmpty()) {
        val noon = noonOnDay(day)
        if (labDayKey(noon, profile) == day) return noon
        val stamp = stampOnDay(profile.dayStamps, day)
        if (stamp != null && labDayKey(stamp.upAt, profile) == day) return stamp.upAt
        val wake = timeOnDay(day, profile.rules.wakeTime) ?: timeOnDay(day, "06:00")
        if (wake != null && labDayKey(wake, profile) == day) return wake
        return null
    }
    val same = timeOnDay(day, trimmed) ?: return null
    if (labDayKey(same, profile) == day) return same
    val next = timeOnDay(addDays(day, 1), trimmed)
    if (next != null && labDayKey(next, profile) == day) return next
    return null
}

/** Group events and carry overflow by lab day (Up → Sleep, else wakeTime). */
fun scoreDays(
    events: List<LabEvent>,
    rules: LabRules,
    throughDay: String,
    dayStamps: List<DayStamp> = emptyList(),
): Map<String, DayScore> {
    val cap = rules.cap.coerceAtLeast(1).toDouble()
    val byDay = mutableMapOf<String, MutableList<LabEvent>>()
    var minDay: String? = null
    for (event in events) {
        val day = labDayKey(event.timestamp, rules.wakeTime, dayStamps)
        if (day > throughDay) continue
        byDay.getOrPut(day) { mutableListOf() }.add(event)
        val earliest = minDay
        if (earliest == null || day < earliest) minDay = day
    }
    val start = minDay ?: return mapOf(throughDay to emptyDay(throughDay))
    val out = linkedMapOf<String, DayScore>()
    var carry = 0.0
    var day = start
    var guard = 0
    while (day <= throughDay && guard < 40_000) {
        var rawWorkout = 0.0
        var work = 0.0
        var reward = 0.0
        for (event in byDay[day].orEmpty()) {
            when (event.kind) {
                "workout" -> rawWorkout += event.points
                "work" -> work += event.points
                else -> reward += event.points
            }
        }
        val incoming = if (rules.overflow) carry else 0.0
        val total = rawWorkout + incoming
        val towardCap = min(cap, total)
        val overflowOut = if (rules.overflow) max(0.0, total - cap) else 0.0
        out[day] = DayScore(day, rawWorkout, incoming, towardCap, overflowOut, work, reward)
        carry = overflowOut
        if (day == throughDay) break
        day = addDays(day, 1)
        guard++
    }
    if (throughDay !in out) out[throughDay] = emptyDay(throughDay)
    return out
}

fun scoreOnDay(profile: LabProfile, day: String): DayScore {
    return scoreDays(profile.events, profile.rules, day, profile.dayStamps)[day] ?: emptyDay(day)
}

fun scoreToday(profile: LabProfile, now: Long = System.currentTimeMillis()): DayScore {
    return scoreOnDay(profile, labDayKey(now, profile))
}

fun milesOnDay(profile: LabProfile, day: String): Double {
    var sum = 0.0
    for (event in profile.events) {
        if (event.kind != "workout" || event.source != "tracker") continue
        if (labDayKey(event.timestamp, profile) != day) continue
        sum += event.miles ?: 0.0
    }
    return sum
}

fun milesToday(profile: LabProfile, now: Long = System.currentTimeMillis()): Double {
    return milesOnDay(profile, labDayKey(now, profile))
}

fun trackerEvent(
    sessionId: Long,
    distanceMeters: Double,
    stoppedAtEpochMs: Long?,
    rules: LabRules,
    now: Long = System.currentTimeMillis(),
): LabEvent? {
    val miles = distanceMeters / METERS_PER_MILE
    val points = milesToPoints(miles, rules.milesPerPoint)
    if (points < 1) return null
    return LabEvent(
        id = "trk_$sessionId",
        kind = "workout",
        points = points.toDouble(),
        timestamp = stoppedAtEpochMs ?: now,
        categoryId = "cardio",
        exerciseId = ON_FOOT_ID,
        note = milesNote(miles),
        source = "tracker",
        sessionId = sessionId.toString(),
        miles = miles,
    )
}

/** Same id or same session id is a no-op. Returns the original list when nothing is added. */
fun upsertEvent(events: List<LabEvent>, event: LabEvent): List<LabEvent> {
    val sessionId = event.sessionId
    val duplicate = events.any { existing ->
        existing.id == event.id || (!sessionId.isNullOrEmpty() && existing.sessionId == sessionId)
    }
    if (duplicate) return events
    return events + event
}

fun formatPoints(points: Double): String {
    if (points.isFinite() && points % 1.0 == 0.0) return points.toLong().toString()
    return String.format(Locale.US, "%.1f", points)
}

fun formatMilesShort(miles: Double): String {
    return String.format(Locale.US, "%.2f", miles).trimEnd('0').trimEnd('.')
}

fun milesNote(miles: Double): String {
    val trimmed = String.format(Locale.US, "%.4f", miles).trimEnd('0').trimEnd('.')
    return "$trimmed mi"
}

private fun emptyDay(day: String) = DayScore(day, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)
