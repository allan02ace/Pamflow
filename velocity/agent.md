# agent.md — Velocity Log

Working notes for whoever (human or AI) edits this app next. **Update this file with every new feature or change**, and ship it alongside the changed files.

## What it is
Velocity Log is a single-page PWA speedometer / ride logbook (`velocity.html`, ~4,500 lines, inline CSS + JS) with an offline service worker (`sw.js`). GPS speed gauge, ride history with route maps, ride comparison/playback, **ghost racing**, fuel + oil logs, weather, and a music player.

## Files
| File | Role |
|---|---|
| `velocity.html` | The whole app: markup, CSS, JS (one IIFE after the storage shim) |
| `leaflet-rotate.js` | **New.** Local copy of leaflet-rotate 0.5.4 (minified, sourcemap line removed). Must sit next to `velocity.html`; loaded right after Leaflet. If it fails to load, maps still work, just unrotatable |
| `sw.js` | Workbox 5.1.2 service worker (cache version `v1`). Unchanged by the race/rotation work: `leaflet-rotate.js` is a same-origin script, so the existing StaleWhileRevalidate rule caches it |
| `manifest.json`, `icon-192.png`, `icon-180-maskable.png` | PWA assets (referenced, not in this folder) |
| `assets/music/*.mp3` | Music library (referenced by `MUSIC_TRACKS`) |

External: Leaflet 1.9.4 (cdnjs), Google Fonts (Oswald, Space Mono, Inter), weather API, Workbox CDN.

## Architecture notes
- **Storage shim** (top of script): replaces `window.storage` with IndexedDB (db `velocity-log-db`, store `kv`), falling back to `localStorage` prefix `vlog:`. API: `get/set/delete/list`, string values.
- **Storage keys:** `sessions`, `theme`, `tank-capacity`, `fuel-entries`, `oil-changes`, `weather-last`, `music-last-track`, `music-precache-key`.
- **Units:** km/h and km only (`maxScale()` = 100, redline from 90).
- **Tracking:** `startTracking()` / `stopTracking(shouldSave)`; `handlePosition()` filters GPS (`MAX_ACCURACY_M = 35`, plausibility + accel checks), auto-pause (`PAUSE_SPEED_THRESHOLD_MS = 0.9`, `PAUSE_DELAY_MS = 3000`), manual pause, wake lock. Demo mode (`startDemo`) simulates a ride and is used when the browser has no geolocation.
- **Path `t` is wall-clock seconds since start (includes pauses)**; path points are only sampled while not paused; `d` is cumulative moving distance.
- Sessions capped at 100.

## Ride record shape (`sessions`, newest first)
```js
{
  id, date, startDate, durationSec, distanceM, maxMs, avgMs, unit, note,
  path: [ { lat, lon, t, v, d } ],   // t sec, v m/s, d meters so far
  race: {                            // only on rides ridden as a race
    vsId, vsDate, vsNote,            // the ghost ride it raced
    mode,                            // 'same' | 'diff'
    finished,                        // false = DNF (stopped before the finish)
    ghostTimeSec,                    // ghost's time to the finish
    userTimeSec, marginSec, won,     // finished only; marginSec > 0 = you won by that much
    gapSec                           // DNF only: gap when you stopped (> 0 = behind)
  }
}
```

## Features (current)
- Live gauge + readout, live stats, GPS status, debug panel
- Start/stop, pause (auto + manual), demo mode, wake lock
- Ride history, weekly stats, notes, delete, clear all; history rows show a 🏁 tag for races
- Ride detail modal: route map, ride card, share image, playback; post-ride floating card
- Compare two rides (More menu → Compare) with shared scrubber
- Live mini-map (flip button on gauge)
- **Rotatable maps (ride map + live map):** two-finger twist (touch), Shift + mouse wheel (desktop), or drag the compass button left/right; tap the compass to snap back to north. Options live in `ROTATE_OPTS` (pitch disabled)
- **Race mode** (see below)
- Fuel log + tank, oil log, export/import JSON, light/dark theme, weather chip, music player with offline caching

## Race mode (ghost race against a saved ride)
Start: ride detail modal → **Race this ride** → *Same route* or *Different route* → `raceArm()`. The session button becomes **Start Race**; a race panel (`#raceHud`) sits under the gauge.
- **Same route:** the ghost's recorded course is the track. Rider position is projected onto it (`raceProject`, windowed search of `RACE_WINDOW_SEGS` segments ahead so loops/crossings work; progress never goes backwards). Clock starts when you are within `RACE_START_ZONE_M` (40 m) of the start and move off. Finish line = `RACE_FINISH_ZONE_M` (20 m) before the course end. Off route beyond `RACE_OFFROUTE_M` (60 m): progress freezes and a warning shows; after 3 off fixes it re-acquires anywhere on the course. Ghost dot + dashed gold course appear on the live map when it is flipped open.
- **Different route:** only distance/time count. Your moving distance since move-off is compared with the ghost's; first to cover the ghost's total distance wins. Clock starts when you move off (≥ `RACE_MOVE_MS` 1.5 m/s).
- Both: wall-clock race time (pauses cost time); ghost is trimmed to start at its own move-off point; gap shown as time and distance ahead/behind plus a progress bar; vibration on start/finish. Rides under `RACE_MIN_DIST_M` (200 m) or `RACE_MIN_TIME_S` (20 s) or with no route can't be raced. Finishing does not stop the session: keep riding or tap Stop to save (record gets `race`). Stopping before the finish saves a DNF.
- Cancel with ✕ on the panel (before or during).
- Demo mode: simulated rider tracks the ghost's pace (±10%) and, in same-route races, follows the ghost's course.
- Code map (search for `// ---------- race mode ----------`): `raceBuildGhost`, `raceSAt`, `raceTimeAtS`, `raceProject`, `raceArm/Cancel/End`, `raceOnTrackingStart`, `raceOnFix`, `raceStep` (called from `updateLiveStats`), `raceRenderHud`, `raceMapSync`, `raceBuildRecord`, `raceTag`, `raceLineText`, `setupRaceLaunch`. Hooks: `handlePosition`, `startDemo` tick, `startTracking`, `startDemo`, `stopTracking`, `renderHistory`, `populateRideCard`, `populateFloatCard`, `openRideDetailModal`.

## Testing notes
Headless Chromium (Playwright) with local Leaflet, a mocked `navigator.geolocation`, and Playwright's fake clock works well: seed `sessions` through `window.storage.set`, feed fixes with `window.__feed(lat, lon, speed)`, advance 1 s per fix. Verified so far: same-route win/lose/off-route/rejoin, different-route win, DNF save, cancel, short/no-route rides disabled, saved `race` record, history tag, float-card line, rotation on both maps (shift+wheel, compass drag, compass reset).

## Conventions
- Keep the app in `velocity.html`; the only extra file is the vendored `leaflet-rotate.js`.
- Persist with `window.storage` only, wrapped in try/catch.
- Bump `VERSION` in `sw.js` when cached assets change in a way that needs a refresh.
- Log every change below.

## Changelog
- **2026-11-10** — Created agent.md from the uploaded `velocity.html` and `sw.js`.
- **2026-11-10** — Added ghost race mode with *Same route* and *Different route*, race panel, race results saved on rides (`race` field, 🏁 tag in history, line on ride cards), and user-rotatable ride/live maps via `leaflet-rotate.js`. `sw.js` unchanged. Browser-tested: race scenarios (win, lose, off-route, DNF, cancel), demo-mode races, ghost overlay on live map, regression (normal session, Compare, race-tag persistence), light theme.

## Deploy note
Upload `velocity.html` and `leaflet-rotate.js` together (same folder). Two-finger rotation could only be checked by code, not on a real touch device; shift+wheel and compass drag were tested.
