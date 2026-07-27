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
is a stub that removes the old service worker that was registered at that address.

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

## How an update reaches her phone

This matters: once an app is on her home screen, I cannot ask her to reinstall it.

1. Make the change.
2. **Bump the cache version** in the service worker you touched —
   `CACHE_VERSION` in `prayer/sw.js`, `SHELL_CACHE` in `quran/sw.js`.
   Skipping this is the usual reason an update seems not to arrive.
3. Commit and `git push`. GitHub Pages redeploys in a couple of minutes.

`prayer/` then updates itself: it re-checks on every open, on returning to the
app, and every 15 minutes; a new version takes over and the page reloads on its
own. `quran/` deliberately does **not** auto-reload (that would cut the
recitation off mid-verse) — it installs the update quietly and shows it the next
time she opens the app.

## Prayer times data

`prayer/times.json` is generated, not hand-written. Do not edit it directly.

- Source of truth: `prayer/data/mangalia-prayer-times-365.md` — Diyanet
  (Namaz Vaktim) sheets for **Mangalia only**, one row per calendar day,
  year-agnostic.
- Generator: `node prayer/data/build-times.js`

The generator exists because the raw sheets have two problems it fixes:

1. They store **local clock times**, which break whenever daylight saving moves
   to a different calendar date in a different year. Everything is converted to
   **UTC** using the offset that was really in force on the source date, and the
   app re-applies the current year's Romanian rules via `Europe/Bucharest`. This
   is verified: all 176 official days re-render exactly, and the spring switch
   lands correctly on 30 Mar 2025, 29 Mar 2026, 28 Mar 2027.
2. Only **176 of 366** days are covered. The rest are computed with a solar model
   calibrated against the official days (residual sd < 1 minute; fitted angles
   18.05° Fajr / 16.6° Isha, standard Asr). Each day is tagged `src: "d"`
   (Diyanet sheet) or `src: "c"` (computed), so real data always wins.

**When new sheets arrive:** paste the new rows into the markdown table (replacing
the `N/A`s), re-run the generator, bump `CACHE_VERSION` in `prayer/sw.js`, push.
The computed days for those dates are replaced by the official ones automatically.

Prayer window rules used (deliberate choices, do not "fix" them):
Fajr ends at **sunrise**; Asr is the **standard** opinion, not Hanafi, and runs
to **Maghrib**; Isha runs until the **next Fajr**. Sunrise is a boundary and is
never shown as a row.

## Quran audio

`quran/audio/` holds the recitation as 45 local files (~767 MB): `yaseen.m4a`
plus `quran-001.m4a` … `quran-044.m4a`, one hour each, mono AAC 40 kbps, from
Mahmoud Khalil Al-Hussary. They were produced from YouTube sources with
`yt-dlp` + `ffmpeg`; the script is in `.work/` (gitignored, local only).

The app downloads all of it into Cache Storage on first launch, then never needs
the network. Constraints to respect: GitHub caps files at 100 MB and Pages sites
at about 1 GB, so do not raise the bitrate or add large files.

## How I like to work here

- Don't ask me questions — make the call and tell me what you assumed.
- Use **Sonnet** subagents for the grunt work (docs, icons, sweeps) and **Opus**
  agents when precision matters (reviewing logic, verifying claims). Keep the
  decisions yourself.
- Verify things for real — run the code, check the live URL — rather than
  reasoning about whether it probably works.
