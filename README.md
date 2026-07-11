# Quran Player

A tiny, one-screen web app built for my grandmother in Romania, who can't really operate a phone. There's nothing to navigate — just two giant buttons:

- **Sura Yasin** — Surah Yaseen, about 24 minutes.
- **Coranul complet** — the complete Quran, about 43 hours, recited by Mahmoud Khalil Al-Hussary.

Tap a button to play it. Tap the same button again to pause. Tap the *other* button and it saves your exact spot in the first one and switches over. Each button remembers exactly where it left off (the position is saved every few seconds) and picks back up there — a few seconds earlier, so you don't lose your place — the next time the app is opened, even after the phone was closed or restarted. When a recitation plays all the way to the end, it resets back to the beginning and stops.

The interface is entirely in Romanian, since that's what she reads.

## It works fully offline

This app does not use YouTube or stream from the internet during normal listening. The audio lives as actual files inside the app itself. The first time the app is opened, it automatically downloads all the audio to the phone's storage. While that's happening, a small line under the title shows progress in Romanian, e.g. "Se descarcă pentru offline: 12 din 45", and it changes to "✓ Disponibil offline" once everything is downloaded.

**Important — one-time setup step:** the first time the app is used, open it while connected to Wi-Fi and leave it open until that checkmark appears. It downloads about 770 MB total, so the phone needs roughly 1 GB of free space. After that one-time download, the app plays with no internet connection at all.

If the download gets interrupted partway through (app closed, Wi-Fi drops, etc.), it automatically picks up where it left off the next time the app is opened — you'll see the message "Descărcarea continuă la următoarea deschidere" ("The download continues the next time you open it").

Because playback now uses real audio files instead of a YouTube embed, the audio also **keeps playing when the screen is locked or turned off**, and simple play/pause controls show up right on the lock screen.

## Project files

- `index.html` — the entire app (markup, styling, and logic all in one file).
- `manifest.webmanifest` — lets the app be installed like a native app.
- `sw.js` — the service worker; it makes the app shell load offline and serves up the downloaded audio files.
- `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — app icons.
- `audio/` — the actual audio files:
  - `audio/yaseen.m4a` — Surah Yaseen.
  - `audio/quran-001.m4a` through `audio/quran-044.m4a` — the complete 43-hour recitation, split into roughly one-hour chunks (~18 MB each, mono AAC at 40 kbps) so they download smoothly. All chunks together total about 770 MB.

The `.work/` folder is a local build area only, and it's gitignored (not part of the published site). It contains `pipeline.sh`, the script used to download the original audio from YouTube with `yt-dlp`, re-encode it with `ffmpeg`, and split it into the hourly chunks above. Re-run it if the source audio ever needs to be regenerated.

## How to put it online (GitHub Pages)

1. Create a new **public** repository on github.com (an empty one — don't add a README, license, or .gitignore through the GitHub website).
2. Because of the audio files, the upload is around 770 MB, which is too much for GitHub's web drag-and-drop uploader. Push it from the command line instead. From inside this project folder:

   ```
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git push -u origin main
   ```

   (The commit already exists locally — these two commands just connect it to GitHub and upload it.) On a slow upload connection this push can take a while; that's normal, just let it finish.

3. On GitHub, go to the repo's **Settings → Pages**, and under "Build and deployment" choose **Deploy from a branch**, then set the branch to **main** and the folder to **/ (root)**, and click **Save**.
4. After a few minutes, the app will be live at:

   ```
   https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
   ```

Note: every individual file in this project is under GitHub's 100 MB per-file limit, and the whole site fits comfortably under GitHub Pages' roughly 1 GB size limit. Don't add other large files to the repo, or it may go over that limit.

## Setting up grandma's phone

**Android (Chrome):**
1. Open the site's URL in Chrome.
2. Tap the **⋮** menu in the top corner.
3. Tap **"Add to Home screen"** (sometimes shown as **"Install app"**).

**iPhone (Safari):**
1. Open the site's URL in Safari.
2. Tap the **Share** icon.
3. Tap **"Add to Home Screen"**.

Either way, this adds a normal-looking app icon to the home screen — no browser bars, no address bar, just the two big buttons.

**Then, the one and only setup step:** open the app once while on Wi-Fi and leave it open until the "✓ Disponibil offline" message appears under the title (see above). After that, everything works without any internet connection.

## How it works / notes

- **Resuming:** every few seconds, the app saves exactly how far into the recitation you are. When you come back — even after fully closing the app or restarting the phone — it resumes from a few seconds before that saved spot, so you never lose your place.
- **Pausing / switching:** tapping the button that's currently playing pauses it immediately. Tapping the other button instantly saves the current position and switches to it. Leaving or closing the app also saves the position right away, so nothing is ever lost.
- **Background & lock-screen playback:** since the audio is played from real files (not a YouTube video), it keeps playing when the screen turns off or locks, and basic play/pause controls appear on the lock screen.
- **Offline behavior:** after the one-time download finishes, the app needs no internet connection at all to play either recitation.
- **If the phone is too full:** if the phone doesn't have enough free space to store the downloaded audio, the app still works fine — it just falls back to streaming over the internet instead of playing from local storage.

## Changing the audio

To swap out the audio, replace the relevant files inside the `audio/` folder (keeping the same file names, or updating the code to match new ones).

If the number of hourly chunks for the complete Quran recitation ever changes (currently 44, named `quran-001.m4a` through `quran-044.m4a`), update the `QURAN_SEGMENTS = 44` constant near the top of the script in `index.html` to match.

`.work/pipeline.sh` can regenerate all of the audio from scratch given the original YouTube source URLs — it re-downloads with `yt-dlp`, re-encodes with `ffmpeg`, and re-splits into the hourly chunks described above.
