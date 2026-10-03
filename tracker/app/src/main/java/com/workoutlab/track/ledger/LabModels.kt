package com.workoutlab.track.ledger

const val ON_FOOT_ID = "on-foot"
const val METERS_PER_MILE = 1609.344

data class LabCategory(
    val id: String,
    val name: String,
    val color: String,
)

data class LabRules(
    val cap: Int = 100,
    val overflow: Boolean = true,
    val milesPerPoint: Double? = 0.25,
    val categories: List<LabCategory> = defaultCategories(),
    val wakeTime: String = "06:00",
    val sleepTime: String = "22:00",
)

data class LabExercise(
    val id: String,
    val name: String,
    val categoryId: String,
    val tags: List<String> = emptyList(),
)

data class LabEvent(
    val id: String,
    val kind: String,
    val points: Double,
    val timestamp: Long,
    val categoryId: String? = null,
    val exerciseId: String? = null,
    val note: String? = null,
    val source: String? = null,
    val sessionId: String? = null,
    val miles: Double? = null,
)

data class LabPlanItem(
    val id: String,
    val exerciseId: String,
)

data class LabPlan(
    val id: String,
    val name: String,
    val items: List<LabPlanItem> = emptyList(),
)

/** One lab day, from Up to Sleep. `day` is the local date of `upAt`. */
data class DayStamp(
    val id: String,
    val day: String,
    val upAt: Long,
    val sleepAt: Long? = null,
)

data class LabProfile(
    val id: String = "public",
    val name: String = "Public (basic)",
    val visibility: String = "public",
    val rules: LabRules = LabRules(),
    val exercises: List<LabExercise> = listOf(ON_FOOT),
    val events: List<LabEvent> = emptyList(),
    val plans: List<LabPlan> = emptyList(),
    val pinnedPlanId: String? = null,
    val dayStamps: List<DayStamp> = emptyList(),
) {
    companion object {
        fun seed(): LabProfile = LabProfile(exercises = listOf(ON_FOOT))
    }
}

val ON_FOOT = LabExercise(
    id = ON_FOOT_ID,
    name = "On foot",
    categoryId = "cardio",
    tags = listOf("tracker", "walk", "jog"),
)

fun defaultCategories(): List<LabCategory> = listOf(
    LabCategory("cardio", "cardio", "#FF3399"),
    LabCategory("core", "core", "#ED7D31"),
    LabCategory("legs", "legs", "#009999"),
    LabCategory("arms", "arms", "#0070C0"),
)

fun ensureOnFoot(profile: LabProfile): LabProfile {
    if (profile.exercises.any { it.id == ON_FOOT_ID }) return profile
    return profile.copy(exercises = listOf(ON_FOOT) + profile.exercises)
}
