# Quran Player

A tiny, simple web app made for my grandmother, who can't really operate a phone. It has just two giant buttons: one plays **Surah Yaseen**, and one plays the **complete Quran** (four recordings stitched together so it feels like one continuous recitation). Tap a button once to start playing; tap the same button again to pause. Whichever one she uses, the app remembers exactly where playback stopped and picks up again from there (just a few seconds earlier, so nothing is missed) the next time it's opened. No menus, no searching, no accounts — just tap and listen.

## How to put it online (GitHub Pages)

You don't need any special tools or hosting — GitHub will host it for free.

1. Go to [github.com](https://github.com) and create a **new public repository** (for example, name it `quran-player`).
2. Upload all the project files into it:
   - `index.html`
   - `manifest.webmanifest`
   - `sw.js`
   - `icon-192.png`
   - `icon-512.png`
   - `apple-touch-icon.png`
   - `README.md`

   The easiest way: on the repository page, click **"Add file" → "Upload files"**, then drag and drop all the files in at once, and click **"Commit changes"**.

   If you prefer using Git from the command line instead, you can do it this way:
   ```
   git add -A
   git commit -m "Quran player"
   git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   git push -u origin main
   ```
3. Once the files are uploaded, go to the repository's **Settings → Pages**.
4. Under "Build and deployment", choose **"Deploy from a branch"**, set the branch to **`main`** and the folder to **`/ (root)`**, then click **Save**.
5. Wait a few minutes for GitHub to publish the site. Your app will then be live at:
   ```
   https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
   ```

## How to add it to grandma's phone

Once the app is online, add it to the home screen so it looks and feels like a normal app icon — no browser bars, no typing web addresses.

**Android (Chrome):**
1. Open the app's URL in Chrome.
2. Tap the **⋮** menu (three dots, top right).
3. Tap **"Add to Home screen"** (it may instead say **"Install app"**).

**iPhone (Safari):**
1. Open the app's URL in Safari.
2. Tap the **Share** button (the square with an arrow pointing up).
3. Tap **"Add to Home Screen"**.

After this, an icon appears on the home screen just like any other app. Tapping it opens the player full-screen, with no address bar or browser controls visible.

## How it works / important notes

- **Internet is required to play** — the audio streams live from YouTube, so the phone needs a working internet or Wi-Fi connection.
- **Resume position is saved on the phone itself**, separately for each button (Yaseen and the complete Quran), updated every few seconds while something is playing.
- **Leaving the app pauses playback** — the position is saved the moment the app goes to the background, so reopening it continues from the same spot.
- **The screen is kept awake while playing** so the audio doesn't get interrupted. For long listening sessions, it's best to keep the phone plugged into its charger. If the phone's power button is pressed to turn the screen off, YouTube will pause the audio — this is a limitation of YouTube itself, not a bug in the app.
- **When a recitation finishes completely**, the app resets back to the beginning and stops, ready to be played again from the start next time.

## Changing the videos

The list of videos lives near the top of the `<script>` section inside `index.html`, in a block that looks like this:

```js
const CONTENT = {
  yaseen: {
    title: 'Surah Yaseen',
    videos: ['CrmJL_hLA9U'],
  },
  quran: {
    title: 'Full Quran',
    videos: ['3E6iTiXAY90', 'DnkwOoBaXBo', 'p7coOkhBZGk', 'XNsqEdtfWTY'],
  },
};
```

Each entry in the `videos` list is just a YouTube **video ID** — the string of letters and numbers that appears after `watch?v=` in a YouTube video's URL. For example, in `https://www.youtube.com/watch?v=CrmJL_hLA9U`, the ID is `CrmJL_hLA9U`.

To change what plays, edit these lists: add a new ID, remove one, or replace one with another. The `quran` list can hold as many video IDs as needed — they'll all play back-to-back as one continuous recitation. After editing, save the file and re-upload `index.html` to the GitHub repository (using the same "Upload files" method as before) to update the live app.
