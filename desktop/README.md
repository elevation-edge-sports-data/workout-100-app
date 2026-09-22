# Workout 100 — desktop

Desktop-first local ledger. Part 1 of **workout-100-app**. Sit this folder next to the Android tracker (`app/`). Do not overwrite Gradle files or `app/`.

## What ships

- Engine, views, and one empty **Public (basic)** profile.
- Author rules: **cap 100**, **overflow on**, **0.25 mi = 1 pt**.
- Empty exercise list. Empty events. **No catalog and no workout history ship.**
- Add an exercise in the UI, or Import JSON, to test.

## What does not ship

- The 40-exercise public list (add later if you freeze it).
- The expanded private catalog (~350).
- Dated counts, sample completions, or localStorage dumps.
- GPS / Android tracker code (that lives in `app/` at the repo root).
- Spreadsheets (`.xlsx`).

Private packs stay on your machine. Import them with **Import JSON**. They persist in the browser only and are gitignored under `profiles/private/`.

## Run locally

```bash
cd desktop
npm install
npm run dev
```

Open the URL Vite prints (default `http://localhost:5173`). State is `localStorage` — nothing is sent to a server.

```bash
npm run build    # production bundle in dist/
npm run preview  # serve the bundle
```

## Shared schema (Part 3)

Export JSON from Settings. The same document is what the phone tracker should write: profile + rules + exercises + events (+ optional track points later). Distance converts with the profile rule (`miles / 0.25` floored to points).

## Git hygiene

`desktop/.gitignore` already excludes:

- `profiles/private/`
- `*.xlsx`
- local dumps (`*.db`, `localStorage*.json`, `workout-lab-100*.json`)
- `node_modules`, `dist`

Repo-root additions:

```
desktop/profiles/private/
desktop/node_modules/
desktop/dist/
*.xlsx
```

## License

MIT — see `LICENSE`.
