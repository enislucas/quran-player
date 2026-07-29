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

## The clock

Everything on screen depends on the phone knowing what time it is, so the app
does not simply trust it. Whenever it can reach the network it compares the
phone's clock against the server's (a `HEAD` request, read from the response's
`Date` header) and stores the difference in `localStorage`. That difference is
applied to every calculation, and it keeps being applied while offline — which
is the case that matters, since a clock that is wrong is usually wrong the same
way tomorrow. If the phone's clock is fine, the difference stays at zero and
nothing changes.

It re-measures on **every** open and every return to the app, never throttled,
because the clock may have been changed between two openings. And a stored
difference is only trusted while the phone's clock keeps running forwards: if
it now reads *earlier* than when the measurement was taken, the clock itself
was changed, the old difference would push a good clock wrong, and it is thrown
away. Anything unreadable in storage is ignored the same way.

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

The times themselves come from a full year published by Diyanet itself, downloaded with `node prayer/data/fetch-year.js`, which writes `prayer/data/mangalia-diyanet-2026.json`. Mangalia is Diyanet district **15952** ([its page](https://namazvakitleri.diyanet.gov.tr/en-US/15952/mangalia-prayer-time)).

The builder draws on three sources, in order of precedence:

1. The downloaded Diyanet year.
2. The hand-typed PDF sheets in `prayer/data/mangalia-prayer-times-365.md`, for anything the year is missing.
3. A calibrated solar model, for any day neither source has.

Right now that means **365 of the 366 days are official Diyanet data**. The only computed day is **29 February**, because Diyanet publishes one calendar year at a time and 2026 is not a leap year. Each day in the output is tagged `d` (Diyanet) or `c` (computed) — official data always wins over computed data.

The downloaded feed was checked against the older hand-typed sheets: all 192 overlapping values matched exactly, confirming it's the same underlying source. And all 2184 values in the 2026 feed re-render exactly after the UTC conversion below.

The generator's other job is fixing a problem the raw published times have: **daylight saving.** They're published as local clock times, which break when daylight saving falls on a different calendar date in a different year. To fix this, every time is stored as UTC and converted back to local time using Romania's current DST rules — so the spring switch correctly lands on 30 March 2025, 29 March 2026, 28 March 2027, and 26 March 2028.

## Refreshing once a year

Diyanet publishes a year at a time, usually late in the preceding year — future years can't be fetched early. Roughly once a year, once the next year is published, run:

```
node prayer/data/fetch-year.js 2027
node prayer/data/build-times.js
```

then bump `CACHE_VERSION` in `prayer/sw.js`, commit and push.

`fetch-year.js` refuses to write a partial year, and will tell you which years are actually published. If a feed is ever missing days, hand-typed sheets can still be pasted into the markdown table to fill the gap.

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
| `data/` | The markdown source sheet, `fetch-year.js` (downloads a published Diyanet year), `mangalia-diyanet-2026.json` (the downloaded year), and the generator script (`build-times.js`) |
