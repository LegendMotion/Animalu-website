# Animalu – Static GitHub Pages Website

This repo contains a **fully static** artist website for **Animalu**, designed to run on **GitHub Pages**.

✅ **Single source of truth:** `data/artist.md`  
✅ **No frameworks:** plain HTML/CSS/JS  
✅ **Auto-updates latest release:** from YouTube **music-only** RSS (Topic/auto-generated channel ID in `artist.md`)  
✅ **Lazy-loaded embeds:** YouTube, Spotify, TikTok, Bandsintown

---

## 1) Upload the ZIP contents to the repo

1. Download the ZIP from this chat.
2. Unzip it locally.
3. Copy **all files and folders** into your repo:
   - `index.html`
   - `assets/`
   - `data/`
   - `robots.txt`
   - `sitemap.xml`
   - `README.md`
4. Commit & push to GitHub.

> Tip: You can also upload the ZIP in GitHub’s web UI by dragging the unzipped files into the repo.

---

## 2) Enable GitHub Pages

1. Open the repo on GitHub
2. Go to **Settings → Pages**
3. Under **Build and deployment**
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or your default branch) and `/ (root)`
4. Save

After it deploys, your site will be available on your `*.github.io` URL.

---

## 3) Update content (set & forget)

**Edit only this file:**

`/data/artist.md`

What it controls:
- Artist name & tagline
- SEO title + description + OG image path
- Social links
- Spotify embed + artist URL
- TikTok profile embed config
- Bandsintown widget config
- Booking contact info
- The “About” section (markdown body)

### Latest release (music-only)

The site fetches:
`https://www.youtube.com/feeds/videos.xml?channel_id=CHANNEL_ID`

Where `CHANNEL_ID` comes from:
`youtube.latest_release.channel_id` in `data/artist.md`

**Important:** The official YouTube channel is only used as a social icon link.

---

## 4) Adding a custom domain later

When you add a custom domain in GitHub Pages:
- GitHub will create/update a `CNAME` file automatically (or you can add it).
- You can optionally set `seo.canonical` in `data/artist.md` to your final domain URL.

This project intentionally does **not** hardcode any domain name.

---

## Notes

- If some fields are missing in `artist.md`, the site shows a graceful placeholder and logs a console warning.
- If the phrase **“Intellectual Dummy”** ever appears inside the markdown body, it will be replaced with **“Animalu”** before rendering.

