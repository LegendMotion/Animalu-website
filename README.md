# Animalu — GitHub Pages Site

This repo hosts the static website for **Animalu** on GitHub Pages. The site is powered by a single source of truth: `data/artist.md`.

## What to edit

Update **only** `data/artist.md` to change the content. The frontmatter fields drive:

- SEO title + description
- Social links
- Embeds (YouTube playlist, Spotify, TikTok, Bandsintown)
- Booking contact details

The markdown body of `artist.md` is used for the About text in the hero section.

## Local preview

Open `index.html` directly in your browser or run any static file server (e.g. `python -m http.server`) and visit `http://localhost:8000`.

## GitHub Pages setup

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)` folder.

## Sitemap + robots

- `robots.txt` points to `/sitemap.xml`.
- Update `sitemap.xml` with your final domain when deploying (the file is intentionally domain-agnostic).

## Data model overview

```yaml
artist:
  name: "Animalu"
  tagline: "Raw emotion. Honest lyrics. No filters."

seo:
  title: "Animalu – Official Artist Site"
  description: "..."
  og_image: "/assets/img/og-image.svg"

social:
  spotify: "https://..."
  tiktok: "https://..."
  instagram: "https://..."
  facebook: "https://..."
  youtube: "https://..."

spotify:
  artist_url: "https://..."
  artist_embed: "https://open.spotify.com/embed/..."

tiktok:
  profile_url: "https://www.tiktok.com/@..."
  unique_id: "..."

youtube:
  latest_release:
    channel_id: "UC..."
    label: "Latest release"

concerts:
  artist_name: "Animalu"
  widget_artist_id: "id_..."
  artist_page: "https://www.bandsintown.com/a/..."

booking:
  contact_name: "..."
  email: "..."
  phone: ""
  presskit: ""
```
