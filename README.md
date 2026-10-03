# Workout Lab 100

Local-only ledger. The phone records miles. The desktop app scores the same walks. There is no server.

- Desktop: [desktop/README.md](desktop/README.md)
- Tracker: [tracker/README.md](tracker/README.md)

## Part 1 — Desktop ledger

`desktop/` is the ledger on main: engine, views, and one empty Public profile. The rules are cap 100, overflow on, and 0.25 mi = 1 pt. The wider public catalog ships empty on purpose, and no workout history ships.

```bash
cd desktop
npm install
npm run dev
```

## Part 2 — Phone and desktop ledger

The uncommitted prototype shares one local ledger. Desktop ingests a `session.v2` walk as one unpacked workout (`trk_<sessionId>`), bound to On foot unless the file sets `exerciseId`. The phone adds a Ledger tab, stores the lab snapshot on the device, and scores lab days from Up to Sleep the same way. The public catalog seeds On foot, and the author palette adds misc.

Notes for that work: [docs/V2.md](docs/V2.md) and [docs/V2.1-days.md](docs/V2.1-days.md).

```bash
cd tracker
.\gradlew.bat :app:installDebug
```

Open `tracker/` in Android Studio, then run the app.

## Part 3 — Shared export

Both sides aim at one version-1 JSON document: profile, rules, exercises, and events. Track points stay optional and are not in that document yet. Points are `floor(miles / 0.25)`. Desktop writes it from Settings. The phone Ledger writes the same shape. There is no separate schema file.
