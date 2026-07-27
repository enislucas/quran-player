# Prayer Times — Mangalia

A tiny prayer-times web app built for the owner's elderly grandmother in Mangalia, Romania, who cannot operate a phone. It lives in this repo alongside the Quran audio player, in the `prayer/` folder.

Live at: https://enislucas.github.io/quran-player/prayer/

Installed on her home screen as a PWA, it is designed to need zero interaction: she just looks at the screen.

## What it does

There are no buttons and nothing to tap — it is purely a display that updates itself.

- **Top of the screen**: inside a softly glowing "aura", the prayer window that is open right now — the prayer's name, the time it started, the time it ends, and how long is left.
- **Below a dividing line**: today's date and the day's five prayers, each shown with its full time window.
- **Prayer names** appear in both Arabic transliteration and Turkish: Fajr/Sabah, Dhuhr/Öğle, Asr/İkindi, Maghrib/Akşam, Isha/Yatsı.
- **Sunrise** is never listed as a prayer — it only appears as the time Fajr ends.
- **Between sunrise and Dhuhr**, no prayer window is open. During those hours the top card switches to a calmer blue style reading "URMEAZĂ" (up next) and shows when Dhuhr begins.

The app's own interface is in Romanian, since that's what she reads.

## Prayer window rules

These are deliberate choices baked into the app:

- **Fajr** runs from Fajr until sunrise.
- **Dhuhr** runs until Asr.
- **Asr** uses the standard (non-Hanafi) opinion and runs until Maghrib.
- **Maghrib** runs until Isha.
- **Isha** runs until the next day's Fajr.

## The data

Times live in `times.json`. **This file is generated — never edit it by hand.**

It's built by running:

```
node prayer/data/build-times.js
```

which reads `prayer/data/mangalia-prayer-times-365.md`, a table holding official Diyanet (Namaz Vaktim) sheets for Mangalia.

The generator fixes two problems with the raw sheets:

1. **Daylight saving.** The sheets store local clock times, which break when daylight saving falls on a different calendar date in a different year. To fix this, every time is stored as UTC and converted back to local time using Romania's current DST rules — so the spring switch correctly lands on 30 March 2025, 29 March 2026, and 28 March 2027.
2. **Missing days.** The sheets only cover 176 of the 366 days in a year. The remaining days are computed with a solar model calibrated against the official days, accurate to better than one minute. Each day in the output is tagged `d` (from a Diyanet sheet) or `c` (computed) — and official data always wins over computed data.

All times are specifically for Mangalia and have been verified astronomically against that location.

## Adding new official sheets when they arrive

1. Paste the new rows into the table in `prayer/data/mangalia-prayer-times-365.md`, replacing the `N/A` entries for those dates. Columns are:

   ```
   Date | İmsak (Fajr) | Güneş (Sunrise) | Öğle (Dhuhr) | İkindi (Asr) | Akşam (Maghrib) | Yatsı (Isha) | Src
   ```

   `Src` is the year the sheet came from — this matters because it determines which daylight-saving offset applies.

2. Run:

   ```
   node prayer/data/build-times.js
   ```

3. Bump `CACHE_VERSION` in `prayer/sw.js`.
4. Commit and push.

## How updates reach her phone

The app checks for a new version every time it is opened, whenever she returns to it, and every 15 minutes while it's open. When a new version is found, it takes over and the screen refreshes by itself — she never has to reinstall anything.

Bumping `CACHE_VERSION` in `sw.js` before pushing is what guarantees this. **Forgetting to bump it is the usual reason an update seems not to arrive.**

## Offline

After the first visit, everything — the page, icons, and times — is stored on the phone, so it keeps working with no internet connection.

The times are good for years, not just the current one, because `times.json` is year-agnostic.

## Installing on the phone

- **Android (Chrome)**: open the URL, tap the ⋮ menu, then "Add to Home screen".
- **iPhone (Safari)**: tap Share, then "Add to Home Screen".

## Files

| File | Purpose |
|---|---|
| `index.html` | The whole app |
| `times.json` | Generated prayer-time data (do not hand-edit) |
| `sw.js` | Service worker: offline support + self-update |
| `manifest.webmanifest` | PWA manifest |
| `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | App icons |
| `data/` | The markdown source sheet and the generator script (`build-times.js`) |
