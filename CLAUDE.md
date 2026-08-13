# CLAUDE.md

Notes for whoever (or whatever) works in this repository next.

## What this is

Two tiny web apps built for **my grandmother**, who lives in Mangalia, Romania and
**cannot operate a phone**. They are installed on her home screen as PWAs and are
hosted for free on GitHub Pages out of this one repository:

| Folder | App | Live at |
|---|---|---|
| `quran/` | Quran audio player | https://enislucas.github.io/quran-player/quran/ |
| `prayer/` | Prayer times | https://enislucas.github.io/quran-player/prayer/ |

`index.html` at the root is only a redirect to `quran/`, because the Quran player
used to live at the root and a shortcut may still point there. `sw.js` at the root
is a compatibility worker that keeps those old root shortcuts working offline.

## The prime directive

**Simplicity for her beats every other consideration.** She cannot read menus,
cannot search, cannot recover from an error state, and will not ask for help.
Resist adding features, settings, or controls. If a change adds a decision for
her to make, it is the wrong change.

Concretely:

- **`quran/`** has exactly two giant buttons and nothing else. Tap = play,
  tap the same button again = pause. Each button remembers its exact position
  and resumes there. Never add a third button.
- **`prayer/`** has *no* controls at all — it is a display. It shows the prayer
  window that is open right now inside a glowing "aura", and below a line, the
  day's five windows.
- UI text is **Romanian**. Prayer names are shown in **both** Arabic
  transliteration and Turkish (Fajr/Sabah, Dhuhr/Öğle, Asr/İkindi,
  Maghrib/Akşam, Isha/Yatsı), because those are the words she knows.
- Both apps must work **fully offline** — assume her phone has no data.
- Text is deliberately enormous. Keep it that way.

Each app also has a small **"Instalează" bar** at the top (`#install`). It is
**not** a third control: it only appears in a *browser* tab where the app is not
yet installed, and disappears for good once the app is on the home screen — so
the person using the installed app never sees it. It exists only so someone the
link is shared with can install in one tap (Android) or gets the manual steps
(iPhone). Don't remove it thinking it violates the rules above; for her, nothing
changed.

## How an update reaches her phone

This matters: once an app is on her home screen, I cannot ask her to reinstall it.

1. Make the change.
2. **Bump the cache version** in the service worker you touched —
   `CACHE_VERSION` in `prayer/sw.js`, `SHELL_CACHE` in `quran/sw.js`.
   Skipping this is the usual reason an update seems not to arrive.
3. Commit and `git push`. GitHub Pages redeploys in a couple of minutes.

`prayer/` then updates itself: it re-checks on every open, on returning to the
app, and every 15 minutes; a new version takes over and the page reloads on its
own. `quran/` also re-checks on open, foreground, restored connectivity, and
every 15 minutes, but deliberately does **not** auto-reload (that would cut the
recitation off mid-verse). It installs quietly and shows the update the next
time she opens the app.

## Prayer times data

`prayer/times.json` is generated, not hand-written. Do not edit it directly.
Generator: `node prayer/data/build-times.js`. Sources, in precedence order:

1. `prayer/data/mangalia-diyanet-<year>.json` — **a whole year published by
   Diyanet**, downloaded by `node prayer/data/fetch-year.js`. Ground truth.
2. `prayer/data/mangalia-prayer-times-365.md` — the Diyanet PDF sheets typed up
   by hand; covers whatever the yearly feed is missing.
3. A calibrated solar model — only for days neither source has.

Currently **365 of 366 days are official Diyanet data**; only 29 February is
computed (Diyanet publishes a year at a time and 2026 is not a leap year).
Each day is tagged `src: "d"` (Diyanet) or `src: "c"` (computed).

The generator exists because the raw times need two fixes:

1. They are **local clock times**, which break whenever daylight saving moves to
   a different calendar date in a different year. Everything is converted to
   **UTC** using the offset really in force on its source date, and the app
   re-applies the current year's Romanian rules via `Europe/Bucharest`. Verified:
   all 2184 values of the 2026 feed re-render exactly, and the spring switch
   lands correctly on 30 Mar 2025, 29 Mar 2026, 28 Mar 2027, 26 Mar 2028.
2. Gaps must never reach her screen, hence the model fallback (residual sd
   ~1 minute; fitted 18.05° Fajr / 16° Isha, standard Asr).

**Once a year, when Diyanet publishes the next one:**

```
node prayer/data/fetch-year.js 2027     # refuses a partial year
node prayer/data/build-times.js
```

then bump `CACHE_VERSION` in `prayer/sw.js`, commit and push. Mangalia is Diyanet
district **15952**; there is no way to get years further ahead — they are simply
not published yet. Hand-typed sheets can still be pasted into the markdown table
for anything a feed is missing.

Prayer window rules used (deliberate choices, do not "fix" them):
Fajr ends at **sunrise**; Asr is the **standard** opinion, not Hanafi, and runs
to **Maghrib**; Isha runs until the **next Fajr**. Sunrise is a boundary and is
never shown as a row.

## Quran audio

`quran/audio/` holds the recitation as 31 local files (~767 MiB): `yaseen.m4a`
plus `juz-001.m4a` … `juz-030.m4a`, mono AAC 40 kbps, from Mahmoud Khalil
Al-Hussary. These are genuine canonical Juz boundaries, not equal-duration
chunks. `quran/juz-manifest.json` records each first/last verse, duration, size,
and SHA-256.

The full Quran preserves the exact recording previously published as 44 hourly
transport chunks. `quran/tools/build-juz.ps1` losslessly stream-cuts those old
files at acoustically verified verse boundaries; it does not re-encode them.
The original YouTube sources and old pipeline remain in `.work/` (gitignored),
and the 44 old files remain recoverable from Git history and the pre-change
archive described below. Never relabel arbitrary time chunks as Juz.

The app downloads all of it into Cache Storage on first launch, then never needs
the network. Constraints to respect: GitHub caps files at 100 MB and Pages sites
at about 1 GB, so do not raise the bitrate or add large files.

## Codex handoff — 6 August 2026

User report: Yasin played, but the complete Quran showed `Problemă la redare —
apasă din nou pe buton`; the UI also misleadingly called the 44 technical hourly
chunks “parts.”

Root cause: the July 27 folder-move change left `DIR` undefined in `quran/sw.js`.
Any audio cache miss threw before the network fallback, so cached Yasin worked
while an uncached Quran file failed. The fix defines `DIR` from the worker URL,
bumps `SHELL_CACHE` to `quran-shell-v3`, and moves audio to `quran-audio-v2`.
Activation preserves cached Yasin, then deletes the obsolete 44-file cache before
the new 30-Juz download so phones do not briefly need about 1.6 GB.

The player now shows `Juzul N din 30`, advances through 30 real Juz files, and
migrates a saved position from the old 44-file timeline to the same point in the
new layout. Exactly two giant buttons remain. The prayer app was deliberately
left unchanged.

Pre-change safety copies on this machine:

- Full archive: `D:\Library\Other People\Ani - Quran App Archives\Ani-Quran-App-before-Codex-20260806.tar`
- Archive SHA-256: `74849C65404FEAFEE42A7EB83936B5A295AA2C9685C5DD27790BEB2FC9F1538B`
- Working copy used for this change: `D:\Library\Other People\Ani - Quran App - Codex Work 20260806`

Important deployment truth: a PWA cannot mutate a phone while it is closed or
offline. The pushed worker is discovered when each phone next opens/foregrounds
the app while online; because Quran never force-reloads during recitation, the
new UI appears on the following open. Leave it open on Wi-Fi until it says
`✓ Disponibil offline` so all 30 new files finish downloading.

## How I like to work here

- Don't ask me questions — make the call and tell me what you assumed.
- Use **Sonnet** subagents for the grunt work (docs, icons, sweeps) and **Opus**
  agents when precision matters (reviewing logic, verifying claims). Keep the
  decisions yourself.
- Verify things for real — run the code, check the live URL — rather than
  reasoning about whether it probably works.
