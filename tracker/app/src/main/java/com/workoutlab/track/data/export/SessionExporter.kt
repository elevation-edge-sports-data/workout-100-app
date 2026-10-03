package com.workoutlab.track.data.export

import com.workoutlab.track.data.db.PointEntity
import com.workoutlab.track.data.db.SessionEntity
import java.time.Instant
import java.util.Locale

object SessionExporter {
    private const val METERS_PER_MILE = 1609.344
    private const val FEET_PER_METER = 3.28084

    /**
     * Old keys stay: startedAt/stoppedAt are ISO, points[] is the track.
     * Desktop reads schema session.v2 plus startedAtMs/endedAtMs and miles.
     * The share picker and SessionArchive both call this.
     */
    fun toJson(session: SessionEntity, points: List<PointEntity>): String {
        val endedMs = session.stoppedAtEpochMs ?: session.startedAtEpochMs
        val miles = session.workoutDistanceMeters / METERS_PER_MILE
        val sessionId = session.id.toString()
        val sb = StringBuilder()
        sb.append("{\n")
        sb.append("  \"app\": \"workout-lab-100\",\n")
        sb.append("  \"type\": \"workout_session\",\n")
        sb.append("  \"schema\": \"session.v2\",\n")
        sb.append("  \"sessionId\": ").append(jsonString(sessionId)).append(",\n")
        sb.append("  \"id\": ").append(jsonString(sessionId)).append(",\n")
        sb.append("  \"startedAt\": ").append(jsonString(iso(session.startedAtEpochMs))).append(",\n")
        sb.append("  \"stoppedAt\": ")
        val stopped = session.stoppedAtEpochMs
        if (stopped == null) sb.append("null") else sb.append(jsonString(iso(stopped)))
        sb.append(",\n")
        sb.append("  \"startedAtMs\": ").append(session.startedAtEpochMs).append(",\n")
        sb.append("  \"endedAtMs\": ").append(endedMs).append(",\n")
        sb.append("  \"endedAt\": ").append(endedMs).append(",\n")
        sb.append("  \"workoutDistanceMeters\": ").append(num(session.workoutDistanceMeters)).append(",\n")
        sb.append("  \"miles\": ").append(num(miles)).append(",\n")
        sb.append("  \"exerciseId\": \"on-foot\",\n")
        sb.append("  \"categoryId\": \"cardio\",\n")
        sb.append("  \"finishReason\": ").append(jsonString(session.status)).append(",\n")
        sb.append("  \"pointCount\": ").append(session.pointCount).append(",\n")
        sb.append("  \"excludedSampleCount\": ").append(session.excludedSampleCount).append(",\n")
        appendPath(sb, points)
        sb.append("  \"points\": [\n")
        points.forEachIndexed { index, point ->
            sb.append("    { \"lat\": ").append(num(point.latitude))
                .append(", \"lon\": ").append(num(point.longitude))
            if (point.altitudeMeters != null) {
                sb.append(", \"ele\": ").append(num(point.altitudeMeters))
            }
            sb.append(", \"time\": \"").append(iso(point.timestampEpochMs)).append("\"")
            sb.append(", \"acc\": ").append(num(point.accuracyMeters.toDouble()))
            if (point.speedMps != null) {
                sb.append(", \"speed\": ").append(num(point.speedMps.toDouble()))
            }
            sb.append(" }")
            if (index < points.lastIndex) sb.append(",")
            sb.append("\n")
        }
        sb.append("  ]\n")
        sb.append("}\n")
        return sb.toString()
    }

    private fun appendPath(sb: StringBuilder, points: List<PointEntity>) {
        sb.append("  \"path\": [\n")
        points.forEachIndexed { index, point ->
            sb.append("    { \"t\": ").append(point.timestampEpochMs)
                .append(", \"lat\": ").append(num(point.latitude))
                .append(", \"lon\": ").append(num(point.longitude))
                .append(", \"accFt\": ").append(num(point.accuracyMeters.toDouble() * FEET_PER_METER))
                .append(" }")
            if (index < points.lastIndex) sb.append(",")
            sb.append("\n")
        }
        sb.append("  ],\n")
    }

    fun toGpx(session: SessionEntity, points: List<PointEntity>): String {
        val sb = StringBuilder()
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
        sb.append("<gpx version=\"1.1\" creator=\"Workout Lab Track\" xmlns=\"http://www.topografix.com/GPX/1/1\">\n")
        sb.append("  <metadata>\n")
        sb.append("    <name>Workout Lab Track</name>\n")
        sb.append("    <time>").append(iso(session.startedAtEpochMs)).append("</time>\n")
        sb.append("  </metadata>\n")
        sb.append("  <trk>\n")
        sb.append("    <name>Workout</name>\n")
        sb.append("    <trkseg>\n")
        for (point in points) {
            sb.append("      <trkpt lat=\"").append(num(point.latitude))
                .append("\" lon=\"").append(num(point.longitude)).append("\">")
            if (point.altitudeMeters != null) {
                sb.append("<ele>").append(num(point.altitudeMeters)).append("</ele>")
            }
            sb.append("<time>").append(iso(point.timestampEpochMs)).append("</time>")
            sb.append("</trkpt>\n")
        }
        sb.append("    </trkseg>\n")
        sb.append("  </trk>\n")
        sb.append("</gpx>\n")
        return sb.toString()
    }

    private fun iso(epochMs: Long): String = Instant.ofEpochMilli(epochMs).toString()

    private fun num(value: Double): String = String.format(Locale.US, "%.7f", value)

    private fun jsonString(value: String): String = buildString {
        append('"')
        for (ch in value) {
            when (ch) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                else -> append(ch)
            }
        }
        append('"')
    }
}
