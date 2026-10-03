package com.workoutlab.track.ledger

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Assert.assertTrue
import org.junit.Test
import java.util.Calendar

class LabLedgerTest {
    private val rules = LabRules(cap = 100, overflow = true, milesPerPoint = 0.25)

    @Test
    fun milesToPointsFloorsQuarterMile() {
        assertEquals(5, milesToPoints(1.25, 0.25))
        assertEquals(0, milesToPoints(0.2, 0.25))
        assertEquals(0, milesToPoints(1.25, null))
    }

    @Test
    fun duplicateTrackerEventIsNoOp() {
        val event = trackerEvent(
            sessionId = 42,
            distanceMeters = 2011.68,
            stoppedAtEpochMs = 1_700_000_000_000L,
            rules = rules,
        )
        assertEquals("trk_42", event!!.id)
        assertEquals(5.0, event.points, 0.0)
        assertEquals("tracker", event.source)
        assertEquals("on-foot", event.exerciseId)
        assertEquals(1.25, event.miles!!, 0.0000001)
        val events = listOf(event)
        assertSame(events, upsertEvent(events, event))
        val renamed = event.copy(id = "other")
        assertSame(events, upsertEvent(events, renamed))
        assertNull(
            trackerEvent(
                sessionId = 7,
                distanceMeters = 100.0,
                stoppedAtEpochMs = 1L,
                rules = rules,
            ),
        )
    }

    @Test
    fun overflowCarriesIntoTheNextDay() {
        val day1 = "2024-05-01"
        val day2 = addDays(day1, 1)
        assertEquals("2024-05-02", day2)
        val events = listOf(
            LabEvent(id = "a", kind = "workout", points = 120.0, timestamp = noonOnDay(day1)),
            LabEvent(id = "b", kind = "workout", points = 10.0, timestamp = noonOnDay(day2)),
        )
        val scores = scoreDays(events, rules, day2)
        assertEquals(0.0, scores.getValue(day1).incoming, 0.0)
        assertEquals(100.0, scores.getValue(day1).towardCap, 0.0)
        assertEquals(20.0, scores.getValue(day1).overflowOut, 0.0)
        assertEquals(20.0, scores.getValue(day2).incoming, 0.0)
        assertEquals(30.0, scores.getValue(day2).towardCap, 0.0)
        assertEquals(10.0, scores.getValue(day2).rawWorkout, 0.0)
    }

    @Test
    fun mergesDesktopExportAndKeepsLocalWalk() {
        val walk = trackerEvent(42, 2011.68, 1_700_000_000_000L, rules)!!
        val local = LabProfile.seed().copy(events = listOf(walk))
        val text = """
            {
              "version": 1,
              "exportedAt": "2024-05-01T00:00:00.000Z",
              "activeProfileId": "public",
              "profiles": [{
                "id": "public",
                "name": "Public (basic)",
                "visibility": "public",
                "rules": { "cap": 80, "overflow": true, "milesPerPoint": 0.25 },
                "exercises": [{ "id": "squat", "name": "Squat", "categoryId": "legs", "tags": [] }],
                "events": [{
                  "id": "evt-1",
                  "kind": "workout",
                  "points": 4,
                  "timestamp": 1000,
                  "exerciseId": "squat",
                  "categoryId": "legs"
                }],
                "plans": []
              }]
            }
        """.trimIndent()
        val merged = LabJson.merge(local, text)
        assertTrue(merged != null)
        val profile = merged!!.profile
        assertEquals(80, profile.rules.cap)
        assertEquals(1, merged.exercisesAdded)
        assertEquals(1, merged.eventsAdded)
        assertTrue(profile.exercises.any { it.id == "squat" && it.name == "Squat" })
        assertTrue(profile.exercises.any { it.id == "on-foot" })
        assertTrue(profile.events.any { it.id == "evt-1" && it.points == 4.0 })
        assertTrue(profile.events.any { it.id == "trk_42" && it.points == 5.0 })
        val again = LabJson.merge(profile, text)
        assertEquals(0, again!!.eventsAdded)
        assertEquals(0, again.exercisesAdded)
        val exported = LabJson.export(profile, exportedAt = "2024-05-02T00:00:00.000Z")
        assertTrue(exported.contains("\"version\": 1"))
        assertTrue(exported.contains("\"activeProfileId\": \"public\""))
        assertTrue(exported.contains("\"evt-1\""))
        assertTrue(exported.contains("\"trk_42\""))
    }

    @Test
    fun unpacksPackedDesktopWorkouts() {
        val text = """
            {"version":1,"activeProfileId":"public","profiles":[{
              "id":"public",
              "exercises":[{"id":"squat","name":"Squat","categoryId":"legs","tags":[]}],
              "events":[],
              "eventPack":{"ids":["squat"],"days":["2024-05-01"],"triples":[0,0,12]},
              "plans":[]
            }]}
        """.trimIndent()
        val merged = LabJson.merge(LabProfile.seed(), text)!!
        val event = merged.profile.events.single { it.id == "hist-squat-2024-05-01" }
        assertEquals(12.0, event.points, 0.0)
        assertEquals("squat", event.exerciseId)
        assertEquals("legs", event.categoryId)
    }

    @Test
    fun labDayFallsBackBeforeWakeTime() {
        val early = localTs(2026, 9, 25, 2, 0)
        val later = localTs(2026, 9, 25, 10, 0)
        val profile = LabProfile.seed().copy(rules = rules)
        assertEquals("2026-09-25", localDayKey(early))
        assertEquals("2026-09-24", labDayKey(early, profile))
        assertTrue(profile.dayStamps.isEmpty())
        val scored = profile.copy(
            events = listOf(
                LabEvent(id = "a", kind = "workout", points = 120.0, timestamp = early),
                LabEvent(id = "b", kind = "workout", points = 10.0, timestamp = later),
            ),
        )
        val scores = scoreDays(scored.events, scored.rules, "2026-09-25", scored.dayStamps)
        assertEquals(120.0, scores.getValue("2026-09-24").rawWorkout, 0.0)
        assertEquals(20.0, scores.getValue("2026-09-24").overflowOut, 0.0)
        assertEquals(10.0, scores.getValue("2026-09-25").rawWorkout, 0.0)
        assertEquals(20.0, scores.getValue("2026-09-25").incoming, 0.0)
        assertEquals("2026-09-24", scoreToday(scored, early).day)

        val night = localTs(2026, 9, 22, 23, 0)
        val morning = localTs(2026, 9, 23, 2, 10)
        val walked = profile.copy(
            events = listOf(
                LabEvent(
                    id = "trk_1",
                    kind = "workout",
                    points = 5.0,
                    timestamp = night,
                    source = "tracker",
                    miles = 1.25,
                ),
            ),
        )
        assertEquals("2026-09-22", localDayKey(night))
        assertEquals("2026-09-23", localDayKey(morning))
        assertEquals(1.25, milesToday(walked, morning), 0.0001)
    }

    @Test
    fun closedStampKeepsEarlyWednesdayOnTuesday() {
        val up = localTs(2026, 9, 22, 10, 0)
        val sleep = localTs(2026, 9, 23, 2, 40)
        val event = localTs(2026, 9, 23, 1, 15)
        val cal = Calendar.getInstance()
        cal.timeInMillis = up
        assertEquals(Calendar.TUESDAY, cal.get(Calendar.DAY_OF_WEEK))
        val profile = LabProfile.seed().copy(
            rules = rules,
            dayStamps = listOf(DayStamp(id = "tue", day = "2026-09-22", upAt = up, sleepAt = sleep)),
            events = listOf(LabEvent(id = "e", kind = "workout", points = 8.0, timestamp = event)),
        )
        assertEquals("2026-09-22", labDayKey(event, profile))
        val today = scoreToday(profile, event)
        assertEquals("2026-09-22", today.day)
        assertEquals(8.0, today.rawWorkout, 0.0)
        val crossed = profile.copy(
            dayStamps = listOf(DayStamp(id = "tue", day = "2026-09-22", upAt = up, sleepAt = localTs(2026, 9, 23, 8, 0))),
        )
        assertEquals("2026-09-23", localDayKey(localTs(2026, 9, 23, 7, 30)))
        assertEquals("2026-09-22", labDayKey(localTs(2026, 9, 23, 7, 30), crossed))
    }

    @Test
    fun openStampStaysTuesdayPastWake() {
        val up = localTs(2026, 9, 22, 10, 0)
        val early = localTs(2026, 9, 23, 2, 10)
        val later = localTs(2026, 9, 23, 10, 0)
        val profile = LabProfile.seed().copy(
            rules = rules,
            dayStamps = listOf(DayStamp(id = "tue", day = "2026-09-22", upAt = up)),
            events = listOf(
                LabEvent(id = "a", kind = "workout", points = 3.0, timestamp = early),
                LabEvent(id = "b", kind = "workout", points = 4.0, timestamp = later),
            ),
        )
        assertEquals("2026-09-22", labDayKey(early, profile))
        assertEquals("2026-09-23", localDayKey(later))
        assertEquals("2026-09-22", labDayKey(later, profile))
        val today = scoreToday(profile, early)
        assertEquals("2026-09-22", today.day)
        assertEquals(7.0, today.rawWorkout, 0.0)

        val closed = closeOpenDay(profile, localTs(2026, 9, 23, 2, 40))
        assertEquals(localTs(2026, 9, 23, 2, 40), closed.dayStamps.single().sleepAt)
        assertNull(profile.dayStamps.single().sleepAt)
        assertEquals("2026-09-22", labDayKey(early, closed))
        assertEquals("2026-09-23", labDayKey(later, closed))

        val bare = LabProfile.seed()
        assertSame(bare, closeOpenDay(bare, early))
        val future = LabProfile.seed().copy(
            dayStamps = listOf(
                DayStamp(id = "a", day = "2026-09-21", upAt = localTs(2026, 9, 21, 10, 0)),
                DayStamp(id = "b", day = "2026-09-22", upAt = up),
                DayStamp(id = "c", day = "2026-09-24", upAt = localTs(2026, 9, 24, 10, 0)),
            ),
        )
        val shut = closeOpenDay(future, localTs(2026, 9, 23, 2, 40))
        assertEquals(localTs(2026, 9, 23, 2, 40), shut.dayStamps[0].sleepAt)
        assertEquals(localTs(2026, 9, 23, 2, 40), shut.dayStamps[1].sleepAt)
        assertNull(shut.dayStamps[2].sleepAt)
        val already = profile.copy(
            dayStamps = listOf(DayStamp(id = "tue", day = "2026-09-22", upAt = up, sleepAt = localTs(2026, 9, 23, 1, 0))),
        )
        assertSame(already, closeOpenDay(already, localTs(2026, 9, 23, 5, 0)))
    }

    @Test
    fun dayStampsRoundTripAndAreNotEvents() {
        val up = localTs(2026, 9, 22, 10, 0)
        val sleep = localTs(2026, 9, 23, 2, 40)
        val profile = LabProfile.seed().copy(
            dayStamps = listOf(DayStamp(id = "tue", day = "2026-09-22", upAt = up, sleepAt = sleep)),
        )
        val text = LabJson.export(profile, exportedAt = "2026-09-23T12:00:00Z")
        assertTrue(text.contains("\"dayStamps\""))
        assertTrue(text.contains("\"sleepAt\": $sleep"))
        val read = LabJson.readSnapshot(text)!!
        assertEquals(up, read.dayStamps.single().upAt)
        assertEquals(sleep, read.dayStamps.single().sleepAt)
        assertEquals("2026-09-22", read.dayStamps.single().day)
        assertTrue(read.events.none { it.id == "tue" })
        val merged = LabJson.merge(LabProfile.seed(), text)!!
        assertEquals(up, merged.profile.dayStamps.single().upAt)

        val openText = LabJson.export(
            LabProfile.seed().copy(dayStamps = listOf(DayStamp(id = "tue", day = "2026-09-22", upAt = up))),
            exportedAt = "2026-09-23T12:00:00Z",
        )
        assertFalse(openText.contains("sleepAt"))
        assertNull(LabJson.readSnapshot(openText)!!.dayStamps.single().sleepAt)

        val packed = """
            {"version":1,"activeProfileId":"public","profiles":[{
              "id":"public",
              "exercises":[{"id":"squat","name":"Squat","categoryId":"legs","tags":[]}],
              "events":[],
              "eventPack":{"ids":["squat"],"days":["2024-05-01"],"triples":[0,0,12]},
              "dayStamps":[{"id":"tue","day":"2026-09-22","upAt":1000,"sleepAt":2000}],
              "plans":[]
            }]}
        """.trimIndent()
        val beside = LabJson.merge(LabProfile.seed(), packed)!!
        assertEquals(1000L, beside.profile.dayStamps.single().upAt)
        assertEquals(2000L, beside.profile.dayStamps.single().sleepAt)
        assertTrue(beside.profile.events.any { it.id == "hist-squat-2024-05-01" })

        val local = LabProfile.seed().copy(dayStamps = listOf(DayStamp(id = "keep", day = "2026-09-22", upAt = 5L)))
        val noStamps = """
            {"profiles":[{"id":"public","events":[],"exercises":[
              {"id":"squat","name":"Squat","categoryId":"legs","tags":[]}
            ],"eventPack":{"ids":["squat"],"days":["2024-05-01"],"triples":[0,0,12]}}]}
        """.trimIndent()
        val kept = LabJson.merge(local, noStamps)!!
        assertEquals("keep", kept.profile.dayStamps.single().id)
    }

    @Test
    fun upSleepAndBackfill() {
        val plain = LabProfile.seed().copy(rules = rules)
        val up = localTs(2026, 9, 22, 10, 0)
        val started = setDayUp(plain, "2026-09-22", up, "tue")
        assertEquals(1, started.dayStamps.size)
        assertEquals("tue", started.dayStamps.single().id)
        assertEquals("2026-09-22", started.dayStamps.single().day)
        assertEquals(up, started.dayStamps.single().upAt)
        assertNull(started.dayStamps.single().sleepAt)
        assertTrue(plain.dayStamps.isEmpty())

        val edited = setDayUp(started, "2026-09-22", localTs(2026, 9, 22, 11, 0), "other")
        assertEquals(1, edited.dayStamps.size)
        assertEquals("tue", edited.dayStamps.single().id)
        assertEquals(localTs(2026, 9, 22, 11, 0), edited.dayStamps.single().upAt)
        assertNull(edited.dayStamps.single().sleepAt)

        val wed = setDayUp(started, "2026-09-23", localTs(2026, 9, 23, 9, 0), "wed")
        assertEquals(localTs(2026, 9, 23, 9, 0), wed.dayStamps[0].sleepAt)
        assertEquals("wed", wed.dayStamps[1].id)
        assertNull(wed.dayStamps[1].sleepAt)
        assertNull(started.dayStamps.single().sleepAt)

        assertEquals(localTs(2026, 9, 22, 22, 0), sleepInstant("2026-09-22", "22:00", up))
        val nextMorning = sleepInstant("2026-09-22", "02:40", up)
        assertEquals(localTs(2026, 9, 23, 2, 40), nextMorning)
        val slept = setDaySleep(started, "2026-09-22", nextMorning, "x")
        assertEquals(localTs(2026, 9, 23, 2, 40), slept.dayStamps.single().sleepAt)
        val reopened = setDaySleep(slept, "2026-09-22", null, "x")
        assertNull(reopened.dayStamps.single().sleepAt)
        assertEquals("2026-09-22", labDayKey(localTs(2026, 9, 23, 2, 10), reopened))

        val now = localTs(2026, 9, 23, 2, 40)
        val stamped = applyUpNow(started, now, "wed")
        assertEquals("2026-09-23", stamped.day)
        assertEquals(now, stamped.profile.dayStamps[0].sleepAt)
        assertEquals("2026-09-23", stamped.profile.dayStamps[1].day)
        assertEquals(now, stamped.profile.dayStamps[1].upAt)
        assertNull(stamped.profile.dayStamps[1].sleepAt)
        assertEquals("2026-09-23", labDayKey(now, stamped.profile))

        val sameDay = applyUpNow(started, localTs(2026, 9, 22, 9, 30), "nope")
        assertEquals(1, sameDay.profile.dayStamps.size)
        assertEquals("tue", sameDay.profile.dayStamps.single().id)
        assertNull(sameDay.profile.dayStamps.single().sleepAt)

        val sleepNow = applySleepNow(plain, localTs(2026, 9, 22, 23, 15), "s")
        assertEquals(localTs(2026, 9, 22, 6, 0), sleepNow.dayStamps.single().upAt)
        assertEquals(localTs(2026, 9, 22, 23, 15), sleepNow.dayStamps.single().sleepAt)
        assertEquals("2026-09-22", sleepNow.dayStamps.single().day)

        assertEquals(noonOnDay("2026-09-24"), manualPointTimestamp(plain, "2026-09-24", ""))
        assertEquals(localTs(2026, 9, 24, 15, 0), manualPointTimestamp(plain, "2026-09-24", "15:00"))
        val early = manualPointTimestamp(plain, "2026-09-24", "02:00")
        assertEquals(localTs(2026, 9, 25, 2, 0), early)
        assertEquals("2026-09-24", labDayKey(early!!, plain))
        val during = manualPointTimestamp(started, "2026-09-22", "01:15")
        assertEquals(localTs(2026, 9, 23, 1, 15), during)
        assertEquals("2026-09-22", labDayKey(during!!, started))
        assertNull(manualPointTimestamp(plain, "2026-09-24", "25:00"))

        val late = plain.copy(rules = rules.copy(wakeTime = "18:00"))
        assertEquals(localTs(2026, 9, 24, 18, 0), manualPointTimestamp(late, "2026-09-24", ""))

        val scored = plain.copy(
            events = listOf(
                LabEvent(
                    id = "walk",
                    kind = "workout",
                    points = 120.0,
                    timestamp = localTs(2026, 9, 25, 2, 0),
                    source = "tracker",
                    miles = 1.25,
                ),
            ),
        )
        assertEquals(120.0, scoreOnDay(scored, "2026-09-24").rawWorkout, 0.0)
        assertEquals(1.25, milesOnDay(scored, "2026-09-24"), 0.0001)
    }

    private fun localTs(year: Int, month: Int, day: Int, hour: Int, minute: Int): Long {
        val cal = Calendar.getInstance()
        cal.clear()
        cal.set(Calendar.YEAR, year)
        cal.set(Calendar.MONTH, month - 1)
        cal.set(Calendar.DAY_OF_MONTH, day)
        cal.set(Calendar.HOUR_OF_DAY, hour)
        cal.set(Calendar.MINUTE, minute)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }
}
