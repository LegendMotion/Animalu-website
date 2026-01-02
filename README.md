# Animalu – Static GitHub Pages site

This is a **static** site powered by a single content file:

- `data/artist.md` (single source of truth)

## Upload to GitHub
1. Download the ZIP from ChatGPT.
2. Unzip locally.
3. Upload **all files/folders** into your repo root:
   - `index.html`
   - `assets/`
   - `data/`
   - `robots.txt`
   - `sitemap.xml`
   - `README.md`
4. Commit & push.

## Enable GitHub Pages
Repo → **Settings** → **Pages**
- Source: `Deploy from a branch`
- Branch: `main`
- Folder: `/ (root)`
Save.

## Update content (“set & forget”)
Edit only `data/artist.md`:
- SEO title/description
- social links + embeds (Spotify/TikTok)
- Bandsintown artist id + page link
- Booking contact details
- About text (markdown body)

The site reads the file in the browser and updates automatically.

## Notes
- No hardcoded domain names. Canonical is optional and can be added later via `seo.canonical`.
- Latest release is pulled from **YouTube RSS** for the **music-only topic channel** (with proxy fallbacks for GitHub Pages).
- If something is missing in `artist.md`, the site shows a safe placeholder and logs a console warning.

## Custom domain later
When you’re ready, add a custom domain in GitHub Pages settings. No code changes required.
