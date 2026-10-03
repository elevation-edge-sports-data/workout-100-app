package com.workoutlab.track.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.workoutlab.track.ledger.LabEvent
import com.workoutlab.track.ledger.LabExercise
import com.workoutlab.track.ledger.LabProfile
import com.workoutlab.track.ledger.ON_FOOT_ID
import com.workoutlab.track.ledger.addDays
import com.workoutlab.track.ledger.formatClock
import com.workoutlab.track.ledger.localDayKey
import com.workoutlab.track.ledger.formatDayLabel
import com.workoutlab.track.ledger.formatMilesShort
import com.workoutlab.track.ledger.formatPoints
import com.workoutlab.track.ledger.isDayKey
import com.workoutlab.track.ledger.labDayKey
import com.workoutlab.track.ledger.manualPointTimestamp
import com.workoutlab.track.ledger.milesOnDay
import com.workoutlab.track.ledger.scoreOnDay
import com.workoutlab.track.ledger.sleepInstant
import com.workoutlab.track.ledger.stampOnDay
import com.workoutlab.track.ledger.timeOnDay
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun LedgerScreen(
    profile: LabProfile,
    status: String,
    onAdd: (exerciseId: String, points: Double, timestamp: Long) -> Unit,
    onDayUp: (day: String, upAt: Long) -> Unit,
    onDaySleep: (day: String, sleepAt: Long?) -> Unit,
    onUpNow: (now: Long) -> Unit,
    onSleepNow: (now: Long) -> Unit,
    onMessage: (String) -> Unit,
    onImport: () -> Unit,
    onExport: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val exercises = profile.exercises.sortedWith(
        compareBy<LabExercise>({ if (it.id == ON_FOOT_ID) 0 else 1 }, { it.name }),
    )
    var selectedId by rememberSaveable { mutableStateOf(ON_FOOT_ID) }
    val resolvedId = if (exercises.any { it.id == selectedId }) {
        selectedId
    } else {
        exercises.firstOrNull()?.id ?: ON_FOOT_ID
    }
    var pointsText by rememberSaveable { mutableStateOf("") }
    var pointTime by rememberSaveable { mutableStateOf("") }
    var picked by rememberSaveable { mutableStateOf("") }
    var dayDraft by remember { mutableStateOf<String?>(null) }
    var upDraft by remember { mutableStateOf<String?>(null) }
    var sleepDraft by remember { mutableStateOf<String?>(null) }
    val liveDay = labDayKey(System.currentTimeMillis(), profile)
    val day = picked.takeIf { isDayKey(it) } ?: liveDay
    val stamp = stampOnDay(profile.dayStamps, day)
    val score = scoreOnDay(profile, day)
    val miles = milesOnDay(profile, day)
    val dayLabel = formatDayLabel(day)
    val names = profile.exercises.associate { it.id to it.name }
    val dayEvents = profile.events
        .filter { labDayKey(it.timestamp, profile) == day }
        .sortedByDescending { it.timestamp }
    val labels = exercises.map { exercise ->
        val dup = exercises.count { it.name == exercise.name } > 1
        exercise.id to if (dup) "${exercise.name} (${exercise.id})" else exercise.name
    }
    val selectedLabel = labels.find { it.first == resolvedId }?.second ?: "On foot"

    Column(
        modifier = modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp),
    ) {
        Text(
            text = "Ledger",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
        )
        Text(
            text = "Finished walks and added points share this ledger.",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(12.dp))

        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    OutlinedButton(onClick = {
                        dayDraft = null
                        upDraft = null
                        sleepDraft = null
                        picked = addDays(day, -1)
                    }) { Text("Previous") }
                    Column(Modifier.weight(1f)) {
                        Text(dayLabel, fontWeight = FontWeight.SemiBold)
                        Text(
                            if (stamp != null && stamp.sleepAt == null) "$day · Open" else day,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    OutlinedButton(onClick = {
                        dayDraft = null
                        upDraft = null
                        sleepDraft = null
                        picked = addDays(day, 1)
                    }) { Text("Next") }
                }
                OutlinedTextField(
                    value = dayDraft ?: day,
                    onValueChange = { text ->
                        val trimmed = text.trim()
                        if (isDayKey(trimmed)) {
                            picked = trimmed
                            dayDraft = null
                            upDraft = null
                            sleepDraft = null
                        } else {
                            dayDraft = text
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Day") },
                )
                OutlinedTextField(
                    value = upDraft ?: stamp?.let { formatClock(it.upAt) }.orEmpty(),
                    onValueChange = { text ->
                        val trimmed = text.trim()
                        val upAt = timeOnDay(day, trimmed)
                        if (upAt != null && CLOCK_TEXT.matches(trimmed)) {
                            onDayUp(day, upAt)
                            upDraft = null
                        } else {
                            upDraft = text
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .onFocusChanged { focus ->
                            if (!focus.isFocused && upDraft != null && timeOnDay(day, upDraft) == null) {
                                upDraft = null
                            }
                        },
                    singleLine = true,
                    label = { Text("Up") },
                )
                OutlinedTextField(
                    value = sleepDraft ?: stamp?.sleepAt?.let { formatClock(it) }.orEmpty(),
                    onValueChange = { text ->
                        if (text.isBlank()) {
                            sleepDraft = text
                            return@OutlinedTextField
                        }
                        val trimmed = text.trim()
                        val upAt = stamp?.upAt
                            ?: timeOnDay(day, profile.rules.wakeTime)
                            ?: timeOnDay(day, "06:00")
                        val sleepAt = if (upAt != null && CLOCK_TEXT.matches(trimmed)) {
                            sleepInstant(day, trimmed, upAt)
                        } else {
                            null
                        }
                        if (sleepAt != null) {
                            onDaySleep(day, sleepAt)
                            sleepDraft = null
                        } else {
                            sleepDraft = text
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .onFocusChanged { focus ->
                            if (!focus.isFocused && sleepDraft != null && sleepDraft!!.isBlank()) {
                                onDaySleep(day, null)
                                sleepDraft = null
                            } else if (!focus.isFocused && sleepDraft != null && timeOnDay(day, sleepDraft) == null) {
                                sleepDraft = null
                            }
                        },
                    singleLine = true,
                    label = { Text("Sleep") },
                )
                if (day == liveDay) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                        Button(
                            onClick = {
                                val now = System.currentTimeMillis()
                                val stampedDay = localDayKey(now)
                                if (stampedDay != day) picked = stampedDay
                                upDraft = null
                                sleepDraft = null
                                onUpNow(now)
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text("Up") }
                        Button(
                            onClick = {
                                sleepDraft = null
                                onSleepNow(System.currentTimeMillis())
                            },
                            modifier = Modifier.weight(1f),
                        ) { Text("Sleep") }
                    }
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(dayLabel, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(
                    "${formatPoints(score.towardCap)} / ${profile.rules.cap}",
                    style = MaterialTheme.typography.headlineSmall,
                )
                if (score.incoming > 0.0) {
                    Text(
                        "Incoming ${formatPoints(score.incoming)}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                if (miles > 0.0) {
                    Text("${formatMilesShort(miles)} mi on foot")
                }
                Text(
                    "${formatPoints(score.rawWorkout)} pt workout",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }

        Spacer(Modifier.height(12.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Add", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                if (labels.isEmpty()) {
                    Text(
                        "No exercises yet.",
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                } else {
                    SimpleDropdown(
                        label = "Exercise",
                        value = selectedLabel,
                        options = labels.map { it.second },
                        onSelected = { chosen ->
                            selectedId = labels.find { it.second == chosen }?.first ?: ON_FOOT_ID
                        },
                    )
                }
                OutlinedTextField(
                    value = pointsText,
                    onValueChange = { pointsText = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Points") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                )
                OutlinedTextField(
                    value = pointTime,
                    onValueChange = { pointTime = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text("Time") },
                    placeholder = { Text("Blank uses noon") },
                )
                Button(
                    onClick = {
                        val parsed = pointsText.trim().toDoubleOrNull()
                        if (parsed == null || parsed == 0.0) {
                            onMessage("Enter a point value other than 0.")
                        } else {
                            val timestamp = manualPointTimestamp(profile, day, pointTime)
                            if (timestamp == null) {
                                onMessage("That time is outside this lab day. Set Up, or pick a time inside the day.")
                            } else {
                                val exerciseId = labels.find { it.first == resolvedId }?.first ?: ON_FOOT_ID
                                onAdd(exerciseId, parsed, timestamp)
                                pointsText = ""
                            }
                        }
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Add")
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Text(
            dayLabel,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        if (dayEvents.isEmpty()) {
            Text(
                if (day == liveDay) "No walks or logs today." else "No walks or logs this day.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        } else {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                for (event in dayEvents) {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp)) {
                            Text(
                                formatWhen(event.timestamp),
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Text(eventLine(event, names), style = MaterialTheme.typography.bodyLarge)
                        }
                    }
                }
            }
        }

        Spacer(Modifier.height(16.dp))
        Card(modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Sync", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(onClick = onImport, modifier = Modifier.weight(1f)) {
                        Text("Import lab JSON")
                    }
                    OutlinedButton(onClick = onExport, modifier = Modifier.weight(1f)) {
                        Text("Export lab JSON")
                    }
                }
                if (status.isNotBlank()) {
                    Text(
                        status,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
        Spacer(Modifier.height(24.dp))
    }
}

private val CLOCK_TEXT = Regex("""^\d{1,2}:\d{2}$""")

private fun eventLine(event: LabEvent, names: Map<String, String>): String {
    val pts = "${formatPoints(event.points)} pt"
    return if (event.source == "tracker") {
        val miles = event.miles
        if (miles != null && miles > 0.0) "${formatMilesShort(miles)} mi · $pts" else pts
    } else {
        val name = event.exerciseId?.let { names[it] } ?: "Workout"
        "$name · $pts"
    }
}

private fun formatWhen(timestamp: Long): String {
    return SimpleDateFormat("MMM d, yyyy HH:mm", Locale.getDefault()).format(Date(timestamp))
}
