package com.workoutlab.track

import android.app.Application
import com.workoutlab.track.ledger.LedgerStore
import com.workoutlab.track.map.MapSettings
import com.workoutlab.track.map.OsmTileLoader
import com.workoutlab.track.recording.RecordingRepository
import com.workoutlab.track.settings.TrackSettings

class WorkoutLabApp : Application() {
    lateinit var repository: RecordingRepository
        private set
    lateinit var mapSettings: MapSettings
        private set
    lateinit var trackSettings: TrackSettings
        private set
    lateinit var ledger: LedgerStore
        private set
    lateinit var tileLoader: OsmTileLoader
        private set

    override fun onCreate() {
        super.onCreate()
        trackSettings = TrackSettings(this)
        ledger = LedgerStore(this)
        repository = RecordingRepository(this, trackSettings) { session ->
            ledger.recordFinished(session)
        }
        mapSettings = MapSettings(this)
        tileLoader = OsmTileLoader(cacheDir)
        tileLoader.networkAllowed = mapSettings.tilesEnabled.value
    }
}
