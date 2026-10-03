package com.workoutlab.track.ledger

import java.time.Instant

data class LabMerge(
    val profile: LabProfile,
    val exercisesAdded: Int,
    val eventsAdded: Int,
)

object LabJson {
    fun export(profile: LabProfile, exportedAt: String = Instant.now().toString()): String {
        return renderExport(ensureOnFoot(profile), exportedAt)
    }

    /** Desktop lab pack: `{ profiles }` or `{ profile }`. Null when it is not that shape. */
    fun merge(local: LabProfile, text: String): LabMerge? {
        val picked = pick(text) ?: return null
        val imported = picked.profile
        val exercises = LinkedHashMap<String, LabExercise>()
        for (exercise in local.exercises) exercises[exercise.id] = exercise
        var exercisesAdded = 0
        for (exercise in imported.exercises) {
            if (exercise.id !in exercises) exercisesAdded++
            exercises[exercise.id] = exercise
        }
        var events = local.events
        var eventsAdded = 0
        for (event in imported.events) {
            val next = upsertEvent(events, event)
            if (next !== events) {
                events = next
                eventsAdded++
            }
        }
        val merged = ensureOnFoot(
            imported.copy(
                exercises = exercises.values.toList(),
                events = events,
                dayStamps = if (picked.dayStampsPresent) imported.dayStamps else local.dayStamps,
            ),
        )
        return LabMerge(merged, exercisesAdded, eventsAdded)
    }

    fun readSnapshot(text: String): LabProfile? = pick(text)?.profile?.let { ensureOnFoot(it) }

    private data class PickedProfile(val profile: LabProfile, val dayStampsPresent: Boolean)

    private fun pick(text: String): PickedProfile? {
        val root = parseJson(text) as? Jv.Obj ?: return null
        val profiles = when (val raw = root.fields["profiles"]) {
            is Jv.Arr -> raw.items.mapNotNull { it as? Jv.Obj }
            else -> {
                val one = root.fields["profile"] as? Jv.Obj ?: return null
                listOf(one)
            }
        }
        if (profiles.isEmpty()) return null
        val active = root.fields["activeProfileId"].stringOrNull().orEmpty()
        val chosen = profiles.firstOrNull { it.str("id") == active && active.isNotEmpty() }
            ?: profiles.firstOrNull { it.str("id") == "public" }
            ?: profiles.first()
        return PickedProfile(readProfile(chosen), chosen.fields.containsKey("dayStamps"))
    }

    private fun readProfile(obj: Jv.Obj): LabProfile {
        val exercises = readExercises(obj.fields["exercises"] as? Jv.Arr)
        return LabProfile(
            id = obj.str("id").ifBlank { "public" },
            name = obj.str("name").ifBlank { "Public (basic)" },
            visibility = obj.str("visibility").ifBlank { "public" },
            rules = readRules(obj.fields["rules"] as? Jv.Obj),
            exercises = exercises,
            events = readEvents(obj, exercises),
            plans = readPlans(obj.fields["plans"] as? Jv.Arr),
            pinnedPlanId = obj.fields["pinnedPlanId"].stringOrNull(),
            dayStamps = readDayStamps(obj.fields["dayStamps"]),
        )
    }

    private fun readRules(obj: Jv.Obj?): LabRules {
        if (obj == null) return LabRules()
        val miles = when (val raw = obj.fields["milesPerPoint"]) {
            null -> 0.25
            Jv.Null -> null
            else -> raw.doubleOrNull()?.takeIf { it > 0.0 }
        }
        val categories = readCategories(obj.fields["categories"] as? Jv.Arr)
        return LabRules(
            cap = (obj.fields["cap"].doubleOrNull()?.toInt() ?: 100).coerceAtLeast(1),
            overflow = obj.fields["overflow"].boolOrNull() ?: true,
            milesPerPoint = miles,
            categories = categories.ifEmpty { defaultCategories() },
            wakeTime = obj.str("wakeTime").ifBlank { "06:00" },
            sleepTime = obj.str("sleepTime").ifBlank { "22:00" },
        )
    }

    private fun readCategories(array: Jv.Arr?): List<LabCategory> {
        if (array == null) return emptyList()
        return array.items.mapNotNull { item ->
            val obj = item as? Jv.Obj ?: return@mapNotNull null
            val id = obj.str("id")
            if (id.isBlank()) null
            else LabCategory(id, obj.str("name").ifBlank { id }, obj.str("color").ifBlank { "#888888" })
        }
    }

    private fun readExercises(array: Jv.Arr?): List<LabExercise> {
        if (array == null) return emptyList()
        return array.items.mapNotNull { item ->
            val obj = item as? Jv.Obj ?: return@mapNotNull null
            val id = obj.str("id")
            val name = obj.str("name")
            if (id.isBlank() || name.isBlank()) return@mapNotNull null
            val tags = (obj.fields["tags"] as? Jv.Arr)?.items?.mapNotNull { it.stringOrNull() }.orEmpty()
            LabExercise(
                id = id,
                name = name,
                categoryId = obj.str("categoryId").ifBlank { "cardio" },
                tags = tags,
            )
        }
    }

    /**
     * Desktop export keeps tracker rows in `events` and packs other workouts into `eventPack`.
     * Both become ledger events. GPS paths are not copied.
     */
    private fun readEvents(profile: Jv.Obj, exercises: List<LabExercise>): List<LabEvent> {
        val rest = readEventArray(profile.fields["events"] as? Jv.Arr)
        val pack = profile.fields["eventPack"] as? Jv.Obj ?: return rest
        val ids = (pack.fields["ids"] as? Jv.Arr)?.items?.map { it.stringOrNull().orEmpty() } ?: return rest
        val days = (pack.fields["days"] as? Jv.Arr)?.items?.map { it.stringOrNull().orEmpty() } ?: return rest
        val triples = (pack.fields["triples"] as? Jv.Arr)?.items ?: return rest
        val categoryByExercise = exercises.associate { it.id to it.categoryId }
        val out = rest.toMutableList()
        var i = 0
        while (i + 2 < triples.size) {
            val exerciseIndex = triples[i].doubleOrNull()?.toInt() ?: -1
            val dayIndex = triples[i + 1].doubleOrNull()?.toInt() ?: -1
            val points = triples[i + 2].doubleOrNull() ?: 0.0
            val exerciseId = ids.getOrNull(exerciseIndex).orEmpty()
            val day = days.getOrNull(dayIndex).orEmpty()
            if (exerciseId.isNotBlank() && day.isNotBlank() && points > 0.0) {
                out += LabEvent(
                    id = "hist-$exerciseId-$day",
                    kind = "workout",
                    points = points,
                    timestamp = noonOnDay(day),
                    exerciseId = exerciseId,
                    categoryId = categoryByExercise[exerciseId],
                )
            }
            i += 3
        }
        return out
    }

    private fun readEventArray(array: Jv.Arr?): List<LabEvent> {
        if (array == null) return emptyList()
        return array.items.mapNotNull { item ->
            val obj = item as? Jv.Obj ?: return@mapNotNull null
            val id = obj.str("id")
            val points = obj.fields["points"].doubleOrNull() ?: return@mapNotNull null
            if (id.isBlank()) return@mapNotNull null
            LabEvent(
                id = id,
                kind = obj.str("kind").ifBlank { "workout" },
                points = points,
                timestamp = obj.fields["timestamp"].doubleOrNull()?.toLong() ?: 0L,
                categoryId = obj.fields["categoryId"].stringOrNull(),
                exerciseId = obj.fields["exerciseId"].stringOrNull(),
                note = obj.fields["note"].stringOrNull(),
                source = obj.fields["source"].stringOrNull(),
                sessionId = obj.fields["sessionId"].stringOrNull(),
                miles = obj.fields["miles"].doubleOrNull()?.takeIf { it >= 0.0 },
            )
        }
    }

    private fun readDayStamps(value: Jv?): List<DayStamp> {
        val array = value as? Jv.Arr ?: return emptyList()
        return array.items.mapNotNull { item ->
            val obj = item as? Jv.Obj ?: return@mapNotNull null
            val id = obj.str("id")
            val day = obj.str("day")
            if (id.isBlank() || !isDayKey(day)) return@mapNotNull null
            val upAt = obj.fields["upAt"].doubleOrNull()?.toLong() ?: return@mapNotNull null
            val sleepAt = when (val sleepRaw = obj.fields["sleepAt"]) {
                null, Jv.Null -> null
                else -> sleepRaw.doubleOrNull()?.toLong() ?: return@mapNotNull null
            }
            DayStamp(id = id, day = day, upAt = upAt, sleepAt = sleepAt)
        }
    }

    private fun readPlans(array: Jv.Arr?): List<LabPlan> {
        if (array == null) return emptyList()
        return array.items.mapNotNull { item ->
            val obj = item as? Jv.Obj ?: return@mapNotNull null
            val id = obj.str("id")
            if (id.isBlank()) return@mapNotNull null
            val items = (obj.fields["items"] as? Jv.Arr)?.items?.mapNotNull { raw ->
                val itemObj = raw as? Jv.Obj ?: return@mapNotNull null
                val itemId = itemObj.str("id")
                val exerciseId = itemObj.str("exerciseId")
                if (itemId.isBlank() || exerciseId.isBlank()) null else LabPlanItem(itemId, exerciseId)
            }.orEmpty()
            LabPlan(id = id, name = obj.str("name").ifBlank { "Plan" }, items = items)
        }
    }

    private fun renderExport(profile: LabProfile, exportedAt: String): String = buildString {
        append("{\n")
        append("  \"version\": 1,\n")
        append("  \"exportedAt\": ").append(quote(exportedAt)).append(",\n")
        append("  \"activeProfileId\": ").append(quote(profile.id)).append(",\n")
        append("  \"profiles\": [\n")
        append("    {\n")
        append("      \"id\": ").append(quote(profile.id)).append(",\n")
        append("      \"name\": ").append(quote(profile.name)).append(",\n")
        append("      \"visibility\": ").append(quote(profile.visibility)).append(",\n")
        append("      \"rules\": ").append(renderRules(profile.rules)).append(",\n")
        append("      \"exercises\": ").append(renderExercises(profile.exercises)).append(",\n")
        append("      \"events\": ").append(renderEvents(profile.events)).append(",\n")
        append("      \"plans\": ").append(renderPlans(profile.plans)).append(",\n")
        append("      \"pinnedPlanId\": ")
        if (profile.pinnedPlanId == null) append("null") else append(quote(profile.pinnedPlanId))
        if (profile.dayStamps.isNotEmpty()) {
            append(",\n")
            append("      \"dayStamps\": ").append(renderDayStamps(profile.dayStamps))
        }
        append("\n")
        append("    }\n")
        append("  ]\n")
        append("}\n")
    }

    private fun renderRules(rules: LabRules): String = buildString {
        append("{\n")
        append("        \"cap\": ").append(rules.cap).append(",\n")
        append("        \"overflow\": ").append(rules.overflow).append(",\n")
        append("        \"milesPerPoint\": ")
        if (rules.milesPerPoint == null) append("null") else append(num(rules.milesPerPoint))
        append(",\n")
        append("        \"categories\": ").append(renderCategories(rules.categories)).append(",\n")
        append("        \"wakeTime\": ").append(quote(rules.wakeTime)).append(",\n")
        append("        \"sleepTime\": ").append(quote(rules.sleepTime)).append("\n")
        append("      }")
    }

    private fun renderCategories(categories: List<LabCategory>): String = buildString {
        append("[")
        categories.forEachIndexed { index, category ->
            if (index > 0) append(",")
            append("{\"id\": ").append(quote(category.id))
            append(", \"name\": ").append(quote(category.name))
            append(", \"color\": ").append(quote(category.color)).append("}")
        }
        append("]")
    }

    private fun renderExercises(exercises: List<LabExercise>): String = buildString {
        append("[")
        exercises.forEachIndexed { index, exercise ->
            if (index > 0) append(",")
            append("{\"id\": ").append(quote(exercise.id))
            append(", \"name\": ").append(quote(exercise.name))
            append(", \"categoryId\": ").append(quote(exercise.categoryId))
            append(", \"tags\": [")
            exercise.tags.forEachIndexed { tagIndex, tag ->
                if (tagIndex > 0) append(",")
                append(quote(tag))
            }
            append("]}")
        }
        append("]")
    }

    private fun renderEvents(events: List<LabEvent>): String = buildString {
        append("[")
        events.forEachIndexed { index, event ->
            if (index > 0) append(",")
            append("{\"id\": ").append(quote(event.id))
            append(", \"kind\": ").append(quote(event.kind))
            append(", \"points\": ").append(num(event.points))
            append(", \"timestamp\": ").append(event.timestamp)
            event.categoryId?.let { append(", \"categoryId\": ").append(quote(it)) }
            event.exerciseId?.let { append(", \"exerciseId\": ").append(quote(it)) }
            event.note?.let { append(", \"note\": ").append(quote(it)) }
            event.source?.let { append(", \"source\": ").append(quote(it)) }
            event.sessionId?.let { append(", \"sessionId\": ").append(quote(it)) }
            event.miles?.let { append(", \"miles\": ").append(num(it)) }
            append("}")
        }
        append("]")
    }

    private fun renderDayStamps(stamps: List<DayStamp>): String = buildString {
        append("[")
        stamps.forEachIndexed { index, stamp ->
            if (index > 0) append(",")
            append("{\"id\": ").append(quote(stamp.id))
            append(", \"day\": ").append(quote(stamp.day))
            append(", \"upAt\": ").append(stamp.upAt)
            if (stamp.sleepAt != null) append(", \"sleepAt\": ").append(stamp.sleepAt)
            append("}")
        }
        append("]")
    }

    private fun renderPlans(plans: List<LabPlan>): String = buildString {
        append("[")
        plans.forEachIndexed { index, plan ->
            if (index > 0) append(",")
            append("{\"id\": ").append(quote(plan.id))
            append(", \"name\": ").append(quote(plan.name))
            append(", \"items\": [")
            plan.items.forEachIndexed { itemIndex, item ->
                if (itemIndex > 0) append(",")
                append("{\"id\": ").append(quote(item.id))
                append(", \"exerciseId\": ").append(quote(item.exerciseId)).append("}")
            }
            append("]}")
        }
        append("]")
    }

    private fun quote(value: String): String = buildString {
        append('"')
        for (ch in value) {
            when (ch) {
                '\\' -> append("\\\\")
                '"' -> append("\\\"")
                '\n' -> append("\\n")
                '\r' -> append("\\r")
                '\t' -> append("\\t")
                else -> append(ch)
            }
        }
        append('"')
    }

    private fun num(value: Double): String {
        if (value.isFinite() && value % 1.0 == 0.0 && value <= Long.MAX_VALUE.toDouble() && value >= Long.MIN_VALUE.toDouble()) {
            return value.toLong().toString()
        }
        return value.toString()
    }
}

private sealed interface Jv {
    data class Obj(val fields: Map<String, Jv>) : Jv
    data class Arr(val items: List<Jv>) : Jv
    data class Str(val value: String) : Jv
    data class Num(val value: Double) : Jv
    data class Bool(val value: Boolean) : Jv
    data object Null : Jv
}

private fun Jv?.stringOrNull(): String? = (this as? Jv.Str)?.value?.ifBlank { null }

private fun Jv?.doubleOrNull(): Double? = (this as? Jv.Num)?.value?.takeIf { it.isFinite() }

private fun Jv?.boolOrNull(): Boolean? = (this as? Jv.Bool)?.value

private fun Jv.Obj.str(key: String): String = fields[key].stringOrNull().orEmpty()

private fun parseJson(text: String): Jv? = try {
    val parser = JsonParser(text)
    val value = parser.value()
    parser.skip()
    if (parser.ended()) value else null
} catch (_: Exception) {
    null
}

private class JsonParser(private val text: String) {
    private var i = 0

    fun ended(): Boolean = i >= text.length

    fun skip() {
        while (i < text.length && text[i].isWhitespace()) i++
    }

    fun value(): Jv {
        skip()
        if (i >= text.length) error("empty json")
        return when (text[i]) {
            '{' -> obj()
            '[' -> arr()
            '"' -> Jv.Str(string())
            't' -> { literal("true"); Jv.Bool(true) }
            'f' -> { literal("false"); Jv.Bool(false) }
            'n' -> { literal("null"); Jv.Null }
            else -> number()
        }
    }

    private fun obj(): Jv.Obj {
        expect('{')
        val fields = linkedMapOf<String, Jv>()
        skip()
        if (peek('}')) {
            i++
            return Jv.Obj(fields)
        }
        while (true) {
            skip()
            val key = string()
            skip()
            expect(':')
            fields[key] = value()
            skip()
            when {
                peek(',') -> i++
                peek('}') -> {
                    i++
                    break
                }
                else -> error("object")
            }
        }
        return Jv.Obj(fields)
    }

    private fun arr(): Jv.Arr {
        expect('[')
        val items = mutableListOf<Jv>()
        skip()
        if (peek(']')) {
            i++
            return Jv.Arr(items)
        }
        while (true) {
            items += value()
            skip()
            when {
                peek(',') -> i++
                peek(']') -> {
                    i++
                    break
                }
                else -> error("array")
            }
        }
        return Jv.Arr(items)
    }

    private fun string(): String {
        skip()
        expect('"')
        val out = StringBuilder()
        while (i < text.length) {
            val ch = text[i++]
            when (ch) {
                '"' -> return out.toString()
                '\\' -> {
                    if (i >= text.length) error("escape")
                    when (val esc = text[i++]) {
                        '"', '\\', '/' -> out.append(esc)
                        'b' -> out.append('\b')
                        'f' -> out.append('\u000C')
                        'n' -> out.append('\n')
                        'r' -> out.append('\r')
                        't' -> out.append('\t')
                        'u' -> {
                            if (i + 4 > text.length) error("unicode")
                            out.append(text.substring(i, i + 4).toInt(16).toChar())
                            i += 4
                        }
                        else -> out.append(esc)
                    }
                }
                else -> out.append(ch)
            }
        }
        error("string")
    }

    private fun number(): Jv.Num {
        val start = i
        if (peek('-')) i++
        if (i >= text.length || !text[i].isDigit()) error("number")
        while (i < text.length && text[i].isDigit()) i++
        if (peek('.')) {
            i++
            while (i < text.length && text[i].isDigit()) i++
        }
        if (i < text.length && (text[i] == 'e' || text[i] == 'E')) {
            i++
            if (peek('+') || peek('-')) i++
            while (i < text.length && text[i].isDigit()) i++
        }
        return Jv.Num(text.substring(start, i).toDouble())
    }

    private fun literal(word: String) {
        if (!text.startsWith(word, i)) error(word)
        i += word.length
    }

    private fun expect(ch: Char) {
        if (!peek(ch)) error(ch.toString())
        i++
    }

    private fun peek(ch: Char): Boolean = i < text.length && text[i] == ch
}
